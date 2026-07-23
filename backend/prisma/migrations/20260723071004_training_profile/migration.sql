-- CreateTable
CREATE TABLE "TrainingProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "experienceLevel" INTEGER,
    "goal" TEXT,
    "equipment" TEXT,
    "spaceConstraint" TEXT,
    "daysPerWeek" INTEGER,
    "injuries" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProfile_userId_key" ON "TrainingProfile"("userId");
