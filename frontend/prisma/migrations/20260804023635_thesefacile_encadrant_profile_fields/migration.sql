-- AlterTable
ALTER TABLE "User" ADD COLUMN     "academicGrade" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
