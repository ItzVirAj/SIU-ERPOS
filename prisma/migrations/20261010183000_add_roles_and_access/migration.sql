-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('NONE', 'VIEW', 'WRITE', 'MANAGE');

-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('WORK', 'COLLAB', 'CRM', 'FINANCE', 'PRODUCTS', 'REPORTS', 'AUTOMATIONS', 'EMPLOYEES', 'ROLES', 'DEV_SETTINGS', 'COMPANY_SETTINGS', 'AUDIT_LOGS');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "legacyTeamRole" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_access" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "level" "AccessLevel" NOT NULL,

    CONSTRAINT "role_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "role_access_module_idx" ON "role_access"("module");

-- CreateIndex
CREATE UNIQUE INDEX "role_access_roleId_module_key" ON "role_access"("roleId", "module");

-- AddForeignKey
ALTER TABLE "role_access" ADD CONSTRAINT "role_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
