// Idempotent seed for the THESIS launch coupon (-95%, unlimited use, no
// expiry). Safe to re-run: `upsert` with `update: {}` never resets fields an
// admin already changed via the back-office.
// Usage: pnpm tsx --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/seed-coupon-thesis.ts

import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

interface RunDeps {
  prisma?: Pick<PrismaClient, 'coupon' | '$disconnect'>;
}

export async function main(deps: RunDeps = {}): Promise<number> {
  const prisma = deps.prisma ?? getPrisma();
  try {
    const coupon = await prisma.coupon.upsert({
      where: { code: 'THESIS' },
      create: { code: 'THESIS', discountPercent: 95, isActive: true },
      update: {},
    });
    console.log(
      `✓ Coupon THESIS ready (id=${coupon.id}, discountPercent=${coupon.discountPercent}).`,
    );
    return 0;
  } finally {
    if (!deps.prisma && prismaClient) {
      await prismaClient.$disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
