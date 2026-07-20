-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "actorLineUserId" TEXT,
ADD COLUMN     "actorName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false;
