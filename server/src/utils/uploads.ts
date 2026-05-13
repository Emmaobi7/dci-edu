import { randomBytes } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { HttpError } from './HttpError.js';

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const UPLOAD_ROOT = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.resolve(process.cwd(), env.UPLOAD_DIR);

export const ATTACHMENTS_DIR = path.join(UPLOAD_ROOT, 'attachments');
export const SUBMISSIONS_DIR = path.join(UPLOAD_ROOT, 'submissions');
export const ANNOUNCEMENT_IMAGES_DIR = path.join(UPLOAD_ROOT, 'announcement-images');

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

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

function buildStorage(targetDir: string) {
  return multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureDir(targetDir);
        cb(null, targetDir);
      } catch (err) {
        cb(err as Error, targetDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const id = randomBytes(12).toString('hex');
      cb(null, `${id}${ext}`);
    },
  });
}

export const attachmentUpload = multer({
  storage: buildStorage(ATTACHMENTS_DIR),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 10 },
  fileFilter,
});

export const submissionUpload = multer({
  storage: buildStorage(SUBMISSIONS_DIR),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter,
});

export const announcementImageUpload = multer({
  storage: buildStorage(ANNOUNCEMENT_IMAGES_DIR),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 10 },
  fileFilter: imageFilter,
});

export function attachmentPath(storedName: string): string {
  return path.join(ATTACHMENTS_DIR, storedName);
}

export function submissionPath(storedName: string): string {
  return path.join(SUBMISSIONS_DIR, storedName);
}

export function announcementImagePath(storedName: string): string {
  return path.join(ANNOUNCEMENT_IMAGES_DIR, storedName);
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn('Failed to delete upload:', filePath, err);
    }
  }
}

export function sanitizeDownloadName(original: string): string {
  return safeBaseName(original);
}
