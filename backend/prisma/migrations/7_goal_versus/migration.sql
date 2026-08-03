-- A group goal can now be a competition instead of a joint hold, scored in
-- sprints, with optional evidence attached to a day.
--
-- Existing rows keep the old behaviour: mode defaults to TOGETHER, and the
-- sprint columns are never read in that mode.

ALTER TABLE "group_goals" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'TOGETHER';
ALTER TABLE "group_goals" ADD COLUMN "sprintDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "group_goals" ADD COLUMN "startDate" DATETIME;
ALTER TABLE "group_goals" ADD COLUMN "settledSprint" INTEGER NOT NULL DEFAULT -1;

ALTER TABLE "group_goal_checkins" ADD COLUMN "proofNote" TEXT;
ALTER TABLE "group_goal_checkins" ADD COLUMN "proofUrl" TEXT;
