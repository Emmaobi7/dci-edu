import { randomBytes } from 'node:crypto';
import path from 'node:path';
import multer, { type FileFilterCallback } from 'multer';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from './HttpError.js';
import { objectStorage, type ObjectBlob, type StorageKind } from './storage.js';

const ALLOWED_MIMETYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set<string>(['.pdf', '.doc', '.docx']);

const ALLOWED_IMAGE_MIMETYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set<string>([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
]);

const ALLOWED_DOC_MIMETYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_DOC_EXTENSIONS = new Set<string>([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_ANNOUNCEMENT_DOC_BYTES = 20 * 1024 * 1024;
const MAX_STUDENT_DOC_BYTES = 5 * 1024 * 1024;
const MAX_PASSPORT_PHOTO_BYTES = 2 * 1024 * 1024;

const ALLOWED_STUDENT_DOC_MIMETYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_STUDENT_DOC_EXTENSIONS = new Set<string>([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp',
]);

function safeBaseName(original: string): string {
  const base = path.basename(original).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
  return base || 'file';
}

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMETYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    cb(new HttpError(400, 'Only PDF, DOC, or DOCX files are allowed'));
    return;
  }
  cb(null, true);
}

function imageFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_MIMETYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    cb(new HttpError(400, 'Only JPG, PNG, WEBP, or GIF images are allowed'));
    return;
  }
  cb(null, true);
}

function documentFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DOC_MIMETYPES.has(file.mimetype) || !ALLOWED_DOC_EXTENSIONS.has(ext)) {
    cb(new HttpError(400, 'Only PDF, Word, PowerPoint, or Excel documents are allowed'));
    return;
  }
  cb(null, true);
}

const memoryStorage = multer.memoryStorage();

export const attachmentUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 10 },
  fileFilter,
});

export const submissionUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter,
});

export const announcementImageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 10 },
  fileFilter: imageFilter,
});

export const announcementDocUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_ANNOUNCEMENT_DOC_BYTES, files: 10 },
  fileFilter: documentFilter,
});

export const resourceDocUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_ANNOUNCEMENT_DOC_BYTES, files: 10 },
  fileFilter: documentFilter,
});

export const avatarUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: imageFilter,
});

function studentDocFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_STUDENT_DOC_MIMETYPES.has(file.mimetype) || !ALLOWED_STUDENT_DOC_EXTENSIONS.has(ext)) {
    cb(new HttpError(400, 'Only PDF, JPG, PNG or WEBP files are allowed'));
    return;
  }
  cb(null, true);
}

export const studentDocumentUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_STUDENT_DOC_BYTES, files: 1 },
  fileFilter: studentDocFilter,
});

export const passportPhotoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_PASSPORT_PHOTO_BYTES, files: 1 },
  fileFilter: imageFilter,
});

export const csvUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okMime = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.mimetype === 'application/csv'
      || file.mimetype === 'text/plain';
    if (!okMime && ext !== '.csv') {
      cb(new HttpError(400, 'Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
});

export function generateStoredName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${randomBytes(12).toString('hex')}${ext}`;
}

export function sanitizeDownloadName(original: string): string {
  return safeBaseName(original);
}

export async function persistUpload(
  kind: StorageKind,
  file: Express.Multer.File,
): Promise<string> {
  const storedName = generateStoredName(file.originalname);
  await objectStorage.upload(kind, storedName, file.buffer, file.mimetype);
  return storedName;
}

export async function removeStoredObject(kind: StorageKind, storedName: string): Promise<void> {
  await objectStorage.remove(kind, storedName);
}

export async function fetchStoredObject(kind: StorageKind, storedName: string): Promise<ObjectBlob> {
  return objectStorage.fetch(kind, storedName);
}

export async function streamStoredObject(
  res: Response,
  kind: StorageKind,
  storedName: string,
  fallbackContentType: string,
): Promise<void> {
  const blob = await objectStorage.fetch(kind, storedName);
  res.type(blob.contentType || fallbackContentType);
  res.setHeader('Content-Length', String(blob.contentLength));
  res.send(blob.body);
}
