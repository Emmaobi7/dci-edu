import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export type StorageKind =
  | 'attachments'
  | 'submissions'
  | 'announcement-images'
  | 'announcement-docs'
  | 'resource-docs'
  | 'avatars'
  | 'student-documents';

export interface ObjectBlob {
  body: Buffer;
  contentType: string;
  contentLength: number;
}

export interface ObjectStorage {
  upload(kind: StorageKind, storedName: string, body: Buffer, contentType: string): Promise<void>;
  remove(kind: StorageKind, storedName: string): Promise<void>;
  fetch(kind: StorageKind, storedName: string): Promise<ObjectBlob>;
}

function objectKey(kind: StorageKind, storedName: string): string {
  return `${kind}/${storedName}`;
}

class SupabaseObjectStorage implements ObjectStorage {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = bucket;
  }

  async upload(kind: StorageKind, storedName: string, body: Buffer, contentType: string): Promise<void> {
    const key = objectKey(kind, storedName);
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, body, { contentType, upsert: false });
    if (error) {
      throw new Error(`Supabase upload failed for ${this.bucket}/${key}: ${describeStorageError(error)}`);
    }
  }

  async remove(kind: StorageKind, storedName: string): Promise<void> {
    const key = objectKey(kind, storedName);
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('Supabase remove failed:', `${this.bucket}/${key}`, describeStorageError(error));
    }
  }

  async fetch(kind: StorageKind, storedName: string): Promise<ObjectBlob> {
    const key = objectKey(kind, storedName);
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) {
      throw new Error(`Supabase download failed for ${this.bucket}/${key}: ${describeStorageError(error)}`);
    }
    const ab = await data.arrayBuffer();
    const buf = Buffer.from(ab);
    return {
      body: buf,
      contentType: data.type || 'application/octet-stream',
      contentLength: buf.byteLength,
    };
  }
}

function describeStorageError(error: unknown): string {
  if (!error) return 'no data returned';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object') {
    const e = error as { message?: string; error?: string; statusCode?: string | number; status?: number };
    const parts: string[] = [];
    if (e.statusCode ?? e.status) parts.push(`status=${e.statusCode ?? e.status}`);
    if (e.error) parts.push(e.error);
    if (e.message) parts.push(e.message);
    if (parts.length) return parts.join(' ');
    try { return JSON.stringify(error); } catch { /* ignore */ }
  }
  return String(error);
}

class MemoryObjectStorage implements ObjectStorage {
  private readonly store = new Map<string, { body: Buffer; contentType: string }>();

  async upload(kind: StorageKind, storedName: string, body: Buffer, contentType: string): Promise<void> {
    this.store.set(objectKey(kind, storedName), { body: Buffer.from(body), contentType });
  }

  async remove(kind: StorageKind, storedName: string): Promise<void> {
    this.store.delete(objectKey(kind, storedName));
  }

  async fetch(kind: StorageKind, storedName: string): Promise<ObjectBlob> {
    const hit = this.store.get(objectKey(kind, storedName));
    if (!hit) throw new Error(`Object not found: ${objectKey(kind, storedName)}`);
    return { body: hit.body, contentType: hit.contentType, contentLength: hit.body.byteLength };
  }
}

function createObjectStorage(): ObjectStorage {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseObjectStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_BUCKET);
  }
  if (env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set; uploads will use an in-memory store that does not persist.',
    );
  }
  return new MemoryObjectStorage();
}

export const objectStorage: ObjectStorage = createObjectStorage();
