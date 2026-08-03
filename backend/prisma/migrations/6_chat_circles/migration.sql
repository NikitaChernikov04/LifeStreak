-- CreateTable
CREATE TABLE "chat_circles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramChatId" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastDigestDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chat_circle_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_circle_members_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "chat_circles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_circle_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_circles_telegramChatId_key" ON "chat_circles"("telegramChatId");

-- CreateIndex
CREATE INDEX "chat_circles_isActive_idx" ON "chat_circles"("isActive");

-- CreateIndex
CREATE INDEX "chat_circle_members_userId_idx" ON "chat_circle_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_circle_members_circleId_userId_key" ON "chat_circle_members"("circleId", "userId");
