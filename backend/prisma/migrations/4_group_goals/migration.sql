-- Group goals: a streak several friends hold together.

CREATE TABLE "group_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCountedDate" DATETIME,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "group_goals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "group_goals_ownerId_status_idx" ON "group_goals"("ownerId", "status");

CREATE TABLE "group_goal_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "joinedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_goal_members_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "group_goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_goal_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "group_goal_members_goalId_userId_key" ON "group_goal_members"("goalId", "userId");
CREATE INDEX "group_goal_members_userId_status_idx" ON "group_goal_members"("userId", "status");

CREATE TABLE "group_goal_checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "usedHeart" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_goal_checkins_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "group_goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_goal_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "group_goal_checkins_goalId_userId_date_key" ON "group_goal_checkins"("goalId", "userId", "date");
CREATE INDEX "group_goal_checkins_goalId_date_idx" ON "group_goal_checkins"("goalId", "date");
