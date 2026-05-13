import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const TEST_UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), 'wapcharm-uploads-'));
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

afterAll(() => {
  try {
    rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
