-- AlterTable
ALTER TABLE "summary" ADD COLUMN     "job_id" TEXT;

-- CreateIndex
CREATE INDEX "summary_job_id_idx" ON "summary"("job_id");
