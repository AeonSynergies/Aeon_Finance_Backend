-- Organizations + configurable roles with per-module Read / Write / Edit permissions.
-- Existing data is moved into a "Default Organization", and the old ADMIN / MANAGER /
-- EXECUTIVE enum becomes three org roles with the same effective access as before.

-- CreateEnum
CREATE TYPE "PermissionModule" AS ENUM ('JOBS', 'UPLOADS', 'VALIDATION', 'APPROVALS', 'AUDIT', 'SETTINGS', 'TEAM');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "PermissionModule" NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Backfill: default org + the three legacy roles.
INSERT INTO "organizations" ("id", "name", "slug", "updatedAt")
VALUES ('org_default', 'Default Organization', 'default', CURRENT_TIMESTAMP);

INSERT INTO "roles" ("id", "orgId", "name", "description", "isSystem", "updatedAt") VALUES
  ('role_default_admin', 'org_default', 'Admin', 'Full access to everything in the organization.', true, CURRENT_TIMESTAMP),
  ('role_default_manager', 'org_default', 'Manager', 'Approves or rejects submitted dates and locks jobs.', false, CURRENT_TIMESTAMP),
  ('role_default_executive', 'org_default', 'Executive', 'Creates jobs, uploads files, validates, overrides and submits dates.', false, CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("id", "roleId", "module", "canRead", "canWrite", "canEdit")
SELECT 'rp_' || r.id || '_' || lower(p.module), r.id, p.module::"PermissionModule", p.r, p.w, p.e
FROM (VALUES
  -- role,                    module,       read,  write, edit
  ('role_default_admin',     'JOBS',       true,  true,  true),
  ('role_default_admin',     'UPLOADS',    true,  true,  false),
  ('role_default_admin',     'VALIDATION', true,  true,  true),
  ('role_default_admin',     'APPROVALS',  true,  true,  true),
  ('role_default_admin',     'AUDIT',      true,  false, false),
  ('role_default_admin',     'SETTINGS',   true,  false, true),
  ('role_default_admin',     'TEAM',       true,  true,  true),
  ('role_default_manager',   'JOBS',       true,  false, true),
  ('role_default_manager',   'UPLOADS',    true,  false, false),
  ('role_default_manager',   'VALIDATION', true,  false, false),
  ('role_default_manager',   'APPROVALS',  true,  false, true),
  ('role_default_manager',   'AUDIT',      true,  false, false),
  ('role_default_manager',   'SETTINGS',   false, false, false),
  ('role_default_manager',   'TEAM',       true,  false, false),
  ('role_default_executive', 'JOBS',       true,  true,  false),
  ('role_default_executive', 'UPLOADS',    true,  true,  false),
  ('role_default_executive', 'VALIDATION', true,  true,  true),
  ('role_default_executive', 'APPROVALS',  true,  true,  false),
  ('role_default_executive', 'AUDIT',      true,  false, false),
  ('role_default_executive', 'SETTINGS',   false, false, false),
  ('role_default_executive', 'TEAM',       false, false, false)
) AS p(role_id, module, r, w, e)
JOIN "roles" r ON r.id = p.role_id;

-- users: enum role → roleId, and org membership.
ALTER TABLE "users"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "orgId" TEXT,
  ADD COLUMN "roleId" TEXT;

UPDATE "users" SET
  "orgId" = 'org_default',
  "roleId" = CASE "role"
    WHEN 'ADMIN' THEN 'role_default_admin'
    WHEN 'MANAGER' THEN 'role_default_manager'
    ELSE 'role_default_executive'
  END;

ALTER TABLE "users"
  ALTER COLUMN "orgId" SET NOT NULL,
  ALTER COLUMN "roleId" SET NOT NULL,
  DROP COLUMN "role";

-- DropEnum
DROP TYPE "Role";

-- jobs: jobId is now unique per organization.
DROP INDEX "jobs_jobId_key";
ALTER TABLE "jobs" ADD COLUMN "orgId" TEXT;
UPDATE "jobs" SET "orgId" = 'org_default';
ALTER TABLE "jobs" ALTER COLUMN "orgId" SET NOT NULL;

-- settings: one row per organization (the old singleton belongs to the default org).
ALTER TABLE "settings" ADD COLUMN "orgId" TEXT, ALTER COLUMN "id" DROP DEFAULT;
UPDATE "settings" SET "orgId" = 'org_default';
DELETE FROM "settings" WHERE "id" <> (SELECT "id" FROM "settings" ORDER BY "updatedAt" DESC LIMIT 1);
ALTER TABLE "settings" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "roles_orgId_name_key" ON "roles"("orgId", "name");
CREATE UNIQUE INDEX "role_permissions_roleId_module_key" ON "role_permissions"("roleId", "module");
CREATE UNIQUE INDEX "jobs_orgId_jobId_key" ON "jobs"("orgId", "jobId");
CREATE UNIQUE INDEX "settings_orgId_key" ON "settings"("orgId");
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
