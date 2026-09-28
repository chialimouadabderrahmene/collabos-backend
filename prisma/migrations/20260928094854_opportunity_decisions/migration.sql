-- CreateEnum
CREATE TYPE "OpportunityDecisionStatus" AS ENUM ('GO', 'HOLD', 'NO_GO');

-- AlterEnum
ALTER TYPE "OpportunityActivityType" ADD VALUE 'DECISION_RECORDED';

-- CreateTable
CREATE TABLE "opportunity_decisions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "OpportunityDecisionStatus" NOT NULL,
    "rationale" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunity_decisions_opportunityId_idx" ON "opportunity_decisions"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_decisions_versionId_idx" ON "opportunity_decisions"("versionId");

-- AddForeignKey
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "opportunity_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
