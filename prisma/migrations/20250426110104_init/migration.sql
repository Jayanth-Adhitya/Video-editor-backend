-- CreateEnum
CREATE TYPE "Status" AS ENUM ('UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "EditType" AS ENUM ('TRIM', 'SUBTITLE');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "processedFileName" TEXT,
    "processedFilePath" TEXT,
    "size" BIGINT NOT NULL,
    "duration" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditOperation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "type" "EditType" NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "text" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "EditOperation_videoId_idx" ON "EditOperation"("videoId");

-- CreateIndex
CREATE INDEX "EditOperation_videoId_order_idx" ON "EditOperation"("videoId", "order");

-- AddForeignKey
ALTER TABLE "EditOperation" ADD CONSTRAINT "EditOperation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
