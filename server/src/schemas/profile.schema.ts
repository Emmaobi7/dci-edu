import { z } from 'zod';

// A nullable trimmed string field. Three legal client states:
//   - field omitted   → undefined (no update)
//   - field is null   → null      (clear column)
//   - field is ""     → null      (clear column)
//   - non-empty       → trimmed string
function nullableTrimmed(max: number) {
  return z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const t = v.trim();
      return t.length === 0 ? null : t;
    });
}

export const updateProfileSchema = z.object({
  title: nullableTrimmed(40),
  firstName: nullableTrimmed(60),
  surname: nullableTrimmed(60),
  name: nullableTrimmed(100),
  phone: nullableTrimmed(30),
  country: nullableTrimmed(80),
  placeOfWork: nullableTrimmed(120),
  positionAtWapcp: nullableTrimmed(100),
  matriculationNumber: nullableTrimmed(40),
  topics: nullableTrimmed(200),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Fields each role may modify via PATCH /api/me/profile.
export const STUDENT_PROFILE_FIELDS = [
  'title', 'firstName', 'surname', 'phone', 'country',
  'placeOfWork', 'positionAtWapcp', 'matriculationNumber',
] as const;

export const TEACHER_PROFILE_FIELDS = [
  'title', 'name', 'phone', 'country', 'topics',
] as const;
