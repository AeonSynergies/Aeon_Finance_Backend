-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXECUTIVE', 'MANAGER');

-- CreateEnum
CREATE TYPE "DateApprovalStatus" AS ENUM ('IN_PROGRESS', 'SENT_FOR_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UploadDocType" AS ENUM ('PAYROLL_TIMECARD', 'AMAZON_ACTIVITY', 'AMAZON_BREAK', 'EMPLOYEE_MASTER', 'PHYSICAL_TIMESHEET', 'WAVE_SCHEDULE');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('UPLOADED', 'PENDING', 'MISSING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dlNumber" TEXT,
    "phone" TEXT,
    "position" TEXT NOT NULL DEFAULT 'DA',
    "station" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'TIMECARD',
    "frequency" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "processDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_approvals" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DateApprovalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionComments" TEXT,

    CONSTRAINT "date_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_documents" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "docType" "UploadDocType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UploadStatus" NOT NULL DEFAULT 'UPLOADED',

    CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timecard_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeId" TEXT,
    "rawPayrollName" TEXT NOT NULL,
    "earnCode" TEXT,
    "payLogin" TEXT,
    "payLogout" TEXT,
    "payBreakOut" TEXT,
    "payBreakIn" TEXT,
    "payLogins" JSONB NOT NULL DEFAULT '[]',
    "payLogouts" JSONB NOT NULL DEFAULT '[]',
    "payBreaks" JSONB NOT NULL DEFAULT '[]',
    "appLogin" TEXT,
    "appLogout" TEXT,
    "physicalLogin" TEXT,
    "lastStop" TEXT,
    "amazonBreaks" JSONB NOT NULL DEFAULT '[]',
    "validationStatus" TEXT NOT NULL,
    "triggeredRule" INTEGER,
    "detail" TEXT,
    "overrideNote" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timecard_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overrides" (
    "id" TEXT NOT NULL,
    "timecardRowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "timecardRowId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeId_key" ON "employees"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_dlNumber_key" ON "employees"("dlNumber");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobId_key" ON "jobs"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "date_approvals_jobId_date_key" ON "date_approvals"("jobId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_documents_jobId_docType_checksum_key" ON "uploaded_documents"("jobId", "docType", "checksum");

-- CreateIndex
CREATE INDEX "timecard_rows_jobId_date_idx" ON "timecard_rows"("jobId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "timecard_rows_jobId_date_rawPayrollName_key" ON "timecard_rows"("jobId", "date", "rawPayrollName");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_approvals" ADD CONSTRAINT "date_approvals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_approvals" ADD CONSTRAINT "date_approvals_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_approvals" ADD CONSTRAINT "date_approvals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timecard_rows" ADD CONSTRAINT "timecard_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timecard_rows" ADD CONSTRAINT "timecard_rows_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timecard_rows" ADD CONSTRAINT "timecard_rows_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_timecardRowId_fkey" FOREIGN KEY ("timecardRowId") REFERENCES "timecard_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
