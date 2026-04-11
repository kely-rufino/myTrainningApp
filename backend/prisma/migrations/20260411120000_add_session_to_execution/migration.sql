-- AlterTable
ALTER TABLE "WorkoutExecution" ADD COLUMN "sessionId" INTEGER REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
