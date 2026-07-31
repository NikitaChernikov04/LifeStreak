-- Days carried over from a tracker the user kept before joining LifeStreak.
-- Included in currentCount; stored separately so the record can mark them.
ALTER TABLE "streaks" ADD COLUMN "importedCount" INTEGER NOT NULL DEFAULT 0;
