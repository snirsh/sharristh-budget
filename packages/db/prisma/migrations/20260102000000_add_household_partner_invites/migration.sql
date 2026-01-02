-- AlterTable
ALTER TABLE "invite_codes" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'global',
ADD COLUMN "householdId" TEXT,
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member',
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "invite_codes_householdId_idx" ON "invite_codes"("householdId");

-- CreateIndex
CREATE INDEX "invite_codes_createdByUserId_idx" ON "invite_codes"("createdByUserId");

-- CreateIndex
CREATE INDEX "invite_codes_expiresAt_idx" ON "invite_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
