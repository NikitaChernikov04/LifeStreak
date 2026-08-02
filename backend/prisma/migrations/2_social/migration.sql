-- Social layer: one-way follows, per-profile and per-streak visibility, reactions.

ALTER TABLE "users" ADD COLUMN "profileVisibility" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "users" ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "streaks" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "follows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "follows"("followerId", "followingId");
CREATE INDEX "follows_followingId_status_idx" ON "follows"("followingId", "status");
CREATE INDEX "follows_followerId_status_idx" ON "follows"("followerId", "status");

CREATE TABLE "reactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reactions_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "daily_checkins" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "reactions_checkinId_userId_key" ON "reactions"("checkinId", "userId");
CREATE INDEX "reactions_checkinId_idx" ON "reactions"("checkinId");
