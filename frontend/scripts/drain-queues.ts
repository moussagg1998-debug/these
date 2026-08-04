// frontend/scripts/drain-queues.ts
//
// Manually triggers the outbox-drain + email-queue-drain cron routes against
// a running dev server. In production these run on a Vercel Cron schedule
// (every 1 min); `next dev` has no cron, so a signup's verification email
// (or a forgot-password reset code) sits queued until something invokes
// these routes. This script is that "something" for local testing.
//
// Usage: pnpm cron:drain   (after `pnpm dev` in another terminal)

import { pathToFileURL } from 'node:url';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

async function drain(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const text = await res.text();
  console.log(`${path} → ${res.status} ${text}`);
  if (!res.ok) throw new Error(`${path} failed with status ${res.status}`);
}

async function main(): Promise<number> {
  if (!CRON_SECRET) {
    console.error('CRON_SECRET is not set in your environment (.env.local).');
    return 1;
  }
  try {
    await drain('/api/cron/outbox-drain');
    await drain('/api/cron/email-queue-drain');
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
