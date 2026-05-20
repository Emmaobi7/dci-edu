import { Prisma, type AuditAction } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export interface AuditInput {
  action: AuditAction;
  actorId: string;
  summary: string;
  targetUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        summary: input.summary,
        targetUserId: input.targetUserId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record event', input.action, err);
  }
}
