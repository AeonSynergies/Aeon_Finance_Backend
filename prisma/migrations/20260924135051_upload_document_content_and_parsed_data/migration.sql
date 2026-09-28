/*
  Warnings:

  - Added the required column `fileContent` to the `uploaded_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "uploaded_documents" ADD COLUMN     "date" DATE,
ADD COLUMN     "fileContent" BYTEA NOT NULL,
ADD COLUMN     "parsedData" JSONB;
