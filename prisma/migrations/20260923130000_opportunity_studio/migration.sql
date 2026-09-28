-- Opportunity Creation Studio (additive, backward-compatible).
-- Creates new enums/tables only; no existing table, column or row is altered
-- or removed. Existing brands get an OWNER BrandMember row (backfill below).

-- CreateEnum
CREATE TYPE "BrandMemberRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityMemberRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "OpportunityAssetKind" AS ENUM ('IMAGE', 'SKETCH', 'REFERENCE');

-- CreateEnum
CREATE TYPE "OpportunityAiSuggestionKind" AS ENUM ('GENERATE_COPY', 'REWRITE', 'SUMMARIZE', 'STRUCTURE', 'TITLES');

-- CreateEnum
CREATE TYPE "OpportunityAiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "OpportunityActivityType" AS ENUM ('CREATED', 'UPDATED', 'ARCHIVED', 'ASSET_UPLOADED', 'ASSET_DELETED', 'PUBLISHED', 'SHARE_LINK_CREATED', 'SHARE_LINK_REVOKED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'AI_SUGGESTION_REQUESTED');

-- CreateTable
CREATE TABLE "brand_members" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BrandMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "latestVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "lastPublishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_members" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OpportunityMemberRole" NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_drafts" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_versions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "draftRevision" INTEGER NOT NULL,
    "notes" TEXT,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_version_assets" (
    "versionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "altText" TEXT,

    CONSTRAINT "opportunity_version_assets_pkey" PRIMARY KEY ("versionId","assetId")
);

-- CreateTable
CREATE TABLE "opportunity_assets" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "kind" "OpportunityAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT NOT NULL,
    "originalFilename" TEXT,
    "altText" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_share_links" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdById" TEXT NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_ai_suggestions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "kind" "OpportunityAiSuggestionKind" NOT NULL,
    "status" "OpportunityAiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activities" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "OpportunityActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_members_userId_idx" ON "brand_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_members_brandId_userId_key" ON "brand_members"("brandId", "userId");

-- CreateIndex
CREATE INDEX "opportunities_brandId_status_idx" ON "opportunities"("brandId", "status");

-- CreateIndex
CREATE INDEX "opportunities_createdById_idx" ON "opportunities"("createdById");

-- CreateIndex
CREATE INDEX "opportunity_members_userId_idx" ON "opportunity_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_members_opportunityId_userId_key" ON "opportunity_members"("opportunityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_drafts_opportunityId_key" ON "opportunity_drafts"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_versions_opportunityId_versionNumber_key" ON "opportunity_versions"("opportunityId", "versionNumber");

-- CreateIndex
CREATE INDEX "opportunity_version_assets_assetId_idx" ON "opportunity_version_assets"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_assets_storageKey_key" ON "opportunity_assets"("storageKey");

-- CreateIndex
CREATE INDEX "opportunity_assets_opportunityId_deletedAt_idx" ON "opportunity_assets"("opportunityId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_share_links_tokenHash_key" ON "opportunity_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "opportunity_share_links_opportunityId_idx" ON "opportunity_share_links"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_share_links_versionId_idx" ON "opportunity_share_links"("versionId");

-- CreateIndex
CREATE INDEX "opportunity_ai_suggestions_opportunityId_createdAt_idx" ON "opportunity_ai_suggestions"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "opportunity_activities_opportunityId_createdAt_idx" ON "opportunity_activities"("opportunityId", "createdAt");

-- AddForeignKey
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_members" ADD CONSTRAINT "opportunity_members_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_members" ADD CONSTRAINT "opportunity_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_drafts" ADD CONSTRAINT "opportunity_drafts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_drafts" ADD CONSTRAINT "opportunity_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_version_assets" ADD CONSTRAINT "opportunity_version_assets_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "opportunity_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_version_assets" ADD CONSTRAINT "opportunity_version_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "opportunity_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assets" ADD CONSTRAINT "opportunity_assets_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assets" ADD CONSTRAINT "opportunity_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_share_links" ADD CONSTRAINT "opportunity_share_links_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_share_links" ADD CONSTRAINT "opportunity_share_links_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "opportunity_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_share_links" ADD CONSTRAINT "opportunity_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_ai_suggestions" ADD CONSTRAINT "opportunity_ai_suggestions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_ai_suggestions" ADD CONSTRAINT "opportunity_ai_suggestions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every existing brand owner becomes an OWNER member of their brand.
-- Idempotent (ON CONFLICT) and non-destructive: only inserts into the new table.
INSERT INTO "brand_members" ("id", "brandId", "userId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."id", b."ownerId", 'OWNER'::"BrandMemberRole", NOW(), NOW()
FROM "brands" b
ON CONFLICT ("brandId", "userId") DO NOTHING;

-- Immutability guard for published versions and their pinned assets.
-- The application never updates or deletes these rows; this trigger makes the
-- database reject it too, so a bug or ad-hoc query cannot alter a publication.
-- (A DBA can still perform a deliberate, audited removal by disabling the
-- trigger inside a maintenance transaction.)
CREATE OR REPLACE FUNCTION "opportunity_published_rows_immutable"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Published opportunity data is immutable: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "opportunity_versions_immutable"
BEFORE UPDATE OR DELETE ON "opportunity_versions"
FOR EACH ROW EXECUTE FUNCTION "opportunity_published_rows_immutable"();

CREATE TRIGGER "opportunity_version_assets_immutable"
BEFORE UPDATE OR DELETE ON "opportunity_version_assets"
FOR EACH ROW EXECUTE FUNCTION "opportunity_published_rows_immutable"();
