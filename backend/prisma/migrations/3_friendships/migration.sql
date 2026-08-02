-- Mutual friendship replaces one-way follows. Both tables were empty in every
-- environment when this shipped, so the old one is dropped rather than migrated.

DROP TABLE IF EXISTS "follows";

CREATE TABLE "friendships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");
CREATE INDEX "friendships_addresseeId_status_idx" ON "friendships"("addresseeId", "status");
CREATE INDEX "friendships_requesterId_status_idx" ON "friendships"("requesterId", "status");

-- Consent now lives in accepting a request, so a separate visibility mode
-- has nothing left to decide.
ALTER TABLE "users" DROP COLUMN "profileVisibility";
