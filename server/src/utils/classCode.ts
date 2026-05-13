import { randomInt } from 'node:crypto';
import { prisma } from '../db/prisma.js';

// Unambiguous alphabet: no 0/1/O/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function generate(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export async function generateUniqueClassCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generate();
    const clash = await prisma.classroom.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new Error('Could not generate a unique class code; please try again.');
}
