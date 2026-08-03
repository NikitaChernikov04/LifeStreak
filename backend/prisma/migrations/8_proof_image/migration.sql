-- Evidence can now be a photo. Only the pathname inside the private blob
-- store is kept here; the bytes never live in the database and the store has
-- no publicly readable address.

ALTER TABLE "group_goal_checkins" ADD COLUMN "proofImage" TEXT;
