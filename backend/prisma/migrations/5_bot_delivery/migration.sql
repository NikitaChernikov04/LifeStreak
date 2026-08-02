-- Messages from the bot. `dmEnabled` is the user's choice; `botBlocked` is an
-- observation written by the delivery layer when Telegram answers 403, which
-- covers both "never pressed Start" and "blocked the bot".

ALTER TABLE "users" ADD COLUMN "dmEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "botBlocked" BOOLEAN NOT NULL DEFAULT false;

-- Records the message that actually left, so throttling counts deliveries
-- rather than rows: a notification we chose not to send must not silence the
-- next one.
ALTER TABLE "notifications" ADD COLUMN "deliveredAt" DATETIME;
