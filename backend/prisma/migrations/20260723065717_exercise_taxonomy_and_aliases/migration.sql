-- CreateTable
CREATE TABLE "ExerciseAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "alias" TEXT NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    CONSTRAINT "ExerciseAlias_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "videoUrl" TEXT,
    "equipment" TEXT,
    "primaryMuscle" TEXT,
    "secondaryMuscles" TEXT,
    "movementPattern" TEXT,
    "spaceFootprint" TEXT,
    "difficulty" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "license" TEXT,
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME
);
INSERT INTO "new_Exercise" ("description", "id", "image", "name", "videoUrl") SELECT "description", "id", "image", "name", "videoUrl" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");
CREATE INDEX "Exercise_isCurated_idx" ON "Exercise"("isCurated");
CREATE INDEX "Exercise_movementPattern_idx" ON "Exercise"("movementPattern");
CREATE INDEX "Exercise_primaryMuscle_idx" ON "Exercise"("primaryMuscle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAlias_alias_key" ON "ExerciseAlias"("alias");
