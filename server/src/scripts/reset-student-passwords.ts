/**
 * Bulk-reset every STUDENT's password to env.DEFAULT_STUDENT_PASSWORD.
 *
 * Usage (on the server, from the repo root):
 *   npm --workspace server exec -- tsx src/scripts/reset-student-passwords.ts             # dry run
 *   npm --workspace server exec -- tsx src/scripts/reset-student-passwords.ts --yes       # apply
 *   npm --workspace server exec -- tsx src/scripts/reset-student-passwords.ts --yes --include-disabled
 *
 * Or via the package.json alias:
 *   npm --workspace server run script:reset-students -- --yes
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

async function main(): Promise<void> {
  const argv = new Set(process.argv.slice(2));
  const apply = argv.has('--yes');
  const includeDisabled = argv.has('--include-disabled');

  const where = {
    role: 'STUDENT' as const,
    ...(includeDisabled ? {} : { disabledAt: null }),
  };

  const count = await prisma.user.count({ where });
  const skippedDisabled = includeDisabled
    ? 0
    : await prisma.user.count({ where: { role: 'STUDENT', disabledAt: { not: null } } });

  // eslint-disable-next-line no-console
  console.log(
    `[reset-student-passwords] mode=${apply ? 'APPLY' : 'DRY RUN'}  ` +
      `target=${count} student(s)  ` +
      `default="${env.DEFAULT_STUDENT_PASSWORD}"  ` +
      `${includeDisabled ? '(including disabled)' : `(skipping ${skippedDisabled} disabled)`}`,
  );

  if (count === 0) {
    // eslint-disable-next-line no-console
    console.log('[reset-student-passwords] Nothing to do.');
    return;
  }

  const sample = await prisma.user.findMany({
    where,
    select: { email: true },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });
  // eslint-disable-next-line no-console
  console.log(`[reset-student-passwords] sample: ${sample.map((u) => u.email).join(', ')}${count > 5 ? `, … (+${count - 5} more)` : ''}`);

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log('[reset-student-passwords] Dry run — re-run with --yes to apply.');
    return;
  }

  const passwordHash = await bcrypt.hash(env.DEFAULT_STUDENT_PASSWORD, 12);
  const result = await prisma.user.updateMany({ where, data: { passwordHash } });
  // eslint-disable-next-line no-console
  console.log(`[reset-student-passwords] Updated ${result.count} student record(s).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[reset-student-passwords] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
