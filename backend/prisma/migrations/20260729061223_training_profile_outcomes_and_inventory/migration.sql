-- Training profile: outcome/modality split, equipment inventory, exclusions,
-- adherence state and recovery context (knowledge-base-r3-amendment.md §8.1).
--
-- Additive only: every statement is an ADD COLUMN or a guarded UPDATE, so
-- SQLite never rebuilds the table. That matters because this runs against a
-- live volume, and §8 exists precisely to avoid a second migration here later.

-- AlterTable
ALTER TABLE "TrainingProfile" ADD COLUMN "adherenceTier" TEXT;
ALTER TABLE "TrainingProfile" ADD COLUMN "consecutiveWeeksOk" INTEGER;
ALTER TABLE "TrainingProfile" ADD COLUMN "excludedExercises" TEXT;
ALTER TABLE "TrainingProfile" ADD COLUMN "lifeStressLevel" TEXT;
ALTER TABLE "TrainingProfile" ADD COLUMN "minutesPerSession" INTEGER;
ALTER TABLE "TrainingProfile" ADD COLUMN "primaryOutcome" TEXT;
ALTER TABLE "TrainingProfile" ADD COLUMN "secondaryOutcomes" TEXT;
ALTER TABLE "TrainingProfile" ADD COLUMN "typicalSleepHours" REAL;

-- Backfill primaryOutcome from the deprecated goal, 1:1. Only `general_fitness`
-- changes name — it becomes `general_health`, the WHO-floor outcome. `goal` is
-- left in place as a read-only alias for one release.
UPDATE "TrainingProfile"
SET "primaryOutcome" = CASE "goal"
    WHEN 'general_fitness' THEN 'general_health'
    ELSE "goal"
  END
WHERE "goal" IS NOT NULL AND "primaryOutcome" IS NULL;

-- `equipment` is deliberately NOT rewritten here. Schema-1 rows are bare JSON
-- tag arrays and are upgraded to the schema-2 inventory on read, then written
-- back in the new shape on the next profile update
-- (backend/src/lib/equipmentInventory.ts). A read-time upgrade reaches the same
-- end state as a bulk rewrite without a data migration that can half-apply, and
-- the `schema` discriminant keeps the two shapes distinguishable meanwhile.
