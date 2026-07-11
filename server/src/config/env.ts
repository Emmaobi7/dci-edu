import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('wapcharm_token'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(process.env.NODE_ENV === 'production')
    .transform((v) => v === true || v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default(process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_BUCKET: z.string().min(1).default('wapcharm'),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).max(128).optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(100).optional(),
  // Role-based default passwords used by admin user creation + CSV import when no password is supplied.
  // The length minimum that applies to user-typed passwords does NOT apply to these.
  DEFAULT_STUDENT_PASSWORD: z.string().min(1).max(128).default('Stud123'),
  DEFAULT_FACULTY_PASSWORD: z.string().min(1).max(128).default('faculty123'),
  // Outbound email (Brevo SMTP). All optional; missing config disables sending.
  SMTP_HOST: z.string().min(1).default('smtp-relay.brevo.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
