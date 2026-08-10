-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'long',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Dakar';
