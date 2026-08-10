/**
 * Security event log — Admin → Sécurité. Call from self-service auth flows
 * (login, password reset) to record LOGIN_SUCCESS / LOGIN_FAILED /
 * PASSWORD_CHANGED events:
 *
 *   await logSecurityEvent(prisma, {
 *     type: 'LOGIN_SUCCESS',
 *     userId: user.id,
 *     email: user.email,
 *     ip: clientIp(req),
 *     userAgent: req.headers.get('user-agent'),
 *   });
 *
 * Distinct from `admin/audit.ts::logAdminAction` — that one records an admin
 * acting on a target; this one records a user's own auth activity (which may
 * have no matching account at all, e.g. a failed login against an unknown
 * email — `userId` is null in that case, `email` is always captured).
 */
import type { Prisma, PrismaClient } from '@prisma/client';

export type SecurityEventType = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_CHANGED';

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: string | null;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export type SecurityEventClient = Pick<PrismaClient, 'securityEvent'>;

export async function logSecurityEvent(
  prisma: SecurityEventClient,
  input: SecurityEventInput,
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      type: input.type,
      userId: input.userId ?? null,
      email: input.email.trim().toLowerCase(),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: (input.metadata ?? null) as unknown as Prisma.InputJsonValue,
    },
  });
}
