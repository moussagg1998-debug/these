/**
 * Admin → Sécurité — simple, transparent, rule-based anomaly detection
 * computed live from SecurityEvent. Not ML, not a black box — every rule
 * is a documented threshold check, consistent with the project's "never
 * fabricate a status" monitoring ethos (see lib/server/monitoring/).
 *
 * Rules (each threshold env-overridable, matching the MONITORING_*_THRESHOLD
 * convention already used in this repo):
 *
 *   REPEATED_FAILED_LOGIN — same email, >= SECURITY_FAILED_LOGIN_THRESHOLD
 *     (default 5) LOGIN_FAILED events in the last hour.
 *   IP_SPRAY — same IP, >= SECURITY_IP_SPRAY_THRESHOLD (default 10)
 *     LOGIN_FAILED events across DISTINCT emails in the last hour
 *     (credential-stuffing / spray signal).
 *   NEW_IP_ADMIN_LOGIN — an ADMIN/SUPERADMIN LOGIN_SUCCESS in the last hour
 *     from an IP that user has never logged in from before.
 */
import type { PrismaClient } from '@prisma/client';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function failedLoginThreshold(): number {
  return Number(process.env.SECURITY_FAILED_LOGIN_THRESHOLD ?? 5);
}

function ipSprayThreshold(): number {
  return Number(process.env.SECURITY_IP_SPRAY_THRESHOLD ?? 10);
}

export type AnomalyKind = 'REPEATED_FAILED_LOGIN' | 'IP_SPRAY' | 'NEW_IP_ADMIN_LOGIN';

export interface AnomalyFlag {
  kind: AnomalyKind;
  detail: string;
  count: number;
  since: string;
  email?: string;
  ip?: string;
  userId?: string;
}

export type AnomalyClient = Pick<PrismaClient, 'securityEvent'>;

export async function detectAnomalies(prisma: AnomalyClient): Promise<AnomalyFlag[]> {
  const since = new Date(Date.now() - WINDOW_MS);
  const flags: AnomalyFlag[] = [];

  // REPEATED_FAILED_LOGIN — group failed logins by email.
  const failedByEmail = await prisma.securityEvent.groupBy({
    by: ['email'],
    where: { type: 'LOGIN_FAILED', createdAt: { gte: since } },
    _count: { _all: true },
  });
  const failThreshold = failedLoginThreshold();
  for (const row of failedByEmail) {
    if (row._count._all >= failThreshold) {
      flags.push({
        kind: 'REPEATED_FAILED_LOGIN',
        detail: `${row._count._all} tentatives de connexion échouées pour ${row.email} depuis 1h`,
        count: row._count._all,
        since: since.toISOString(),
        email: row.email,
      });
    }
  }

  // IP_SPRAY — group failed logins by IP, count distinct emails per IP.
  // Bounded to the 1h failed-login window, aggregated in JS since Prisma
  // has no single-query "count distinct within a group" primitive.
  const failedRows = await prisma.securityEvent.findMany({
    where: { type: 'LOGIN_FAILED', createdAt: { gte: since }, ip: { not: null } },
    select: { ip: true, email: true },
  });
  const emailsByIp = new Map<string, Set<string>>();
  for (const row of failedRows) {
    if (!row.ip || row.ip === 'unknown') continue;
    const set = emailsByIp.get(row.ip) ?? new Set<string>();
    set.add(row.email);
    emailsByIp.set(row.ip, set);
  }
  const sprayThreshold = ipSprayThreshold();
  for (const [ip, emails] of emailsByIp) {
    if (emails.size >= sprayThreshold) {
      flags.push({
        kind: 'IP_SPRAY',
        detail: `${emails.size} comptes différents ciblés en échec de connexion depuis l'IP ${ip} en 1h`,
        count: emails.size,
        since: since.toISOString(),
        ip,
      });
    }
  }

  // NEW_IP_ADMIN_LOGIN — an admin login from an IP not seen before for that user.
  const recentAdminLogins = await prisma.securityEvent.findMany({
    where: {
      type: 'LOGIN_SUCCESS',
      createdAt: { gte: since },
      ip: { not: null },
      user: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
    },
    select: { id: true, userId: true, ip: true, email: true, createdAt: true },
  });
  for (const row of recentAdminLogins) {
    if (!row.ip || row.ip === 'unknown' || !row.userId) continue;
    const priorSameIp = await prisma.securityEvent.findFirst({
      where: {
        type: 'LOGIN_SUCCESS',
        userId: row.userId,
        ip: row.ip,
        createdAt: { lt: row.createdAt },
      },
      select: { id: true },
    });
    if (!priorSameIp) {
      flags.push({
        kind: 'NEW_IP_ADMIN_LOGIN',
        detail: `Connexion admin de ${row.email} depuis une IP inédite (${row.ip})`,
        count: 1,
        since: row.createdAt.toISOString(),
        email: row.email,
        ip: row.ip,
        userId: row.userId,
      });
    }
  }

  return flags;
}

export async function countAnomalies(prisma: AnomalyClient): Promise<number> {
  return (await detectAnomalies(prisma)).length;
}
