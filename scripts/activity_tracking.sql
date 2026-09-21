-- Daily per-user Discord message counts for the channels listed under
-- `activity_watchlist_channels` in riskbot_config.json.
--
-- Written by modules/activityTracker.js. The bot has no MessageContent intent, so no
-- message text exists to store - one row per (day, server, channel, user) with a count.
--
-- Run as a MySQL user that has CREATE (the `riskbot` user only has DML):
--   mysql -u root -p friendsofrisk < scripts/activity_tracking.sql

CREATE TABLE IF NOT EXISTS `activity__discord_daily` (
  `day` date NOT NULL,
  `serverid` bigint NOT NULL,
  `channelid` bigint NOT NULL,
  `userid` bigint NOT NULL,
  `messages` int NOT NULL DEFAULT '0',
  `firstmessage` datetime NOT NULL,
  `lastmessage` datetime NOT NULL,
  PRIMARY KEY (`day`,`serverid`,`channelid`,`userid`),
  KEY `idx_user_day` (`userid`,`day`),
  KEY `idx_server_day` (`serverid`,`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The `riskbot` user already holds SELECT/INSERT/UPDATE/DELETE on `friendsofrisk`.*,
-- so no extra grants are needed.


-- Example queries for the website
-- ------------------------------------------------------------------
-- Messages per user per server, last 24h (calendar-day buckets):
--   SELECT `serverid`, `userid`, SUM(`messages`) AS `messages`
--   FROM `activity__discord_daily`
--   WHERE `day` = CURDATE()
--   GROUP BY `serverid`, `userid`
--   ORDER BY `messages` DESC;
--
-- Top 25 posters on one server over the last 30 days:
--   SELECT `userid`, SUM(`messages`) AS `messages`, COUNT(DISTINCT `day`) AS `active_days`
--   FROM `activity__discord_daily`
--   WHERE `serverid` = 465846009164070912 AND `day` >= CURDATE() - INTERVAL 30 DAY
--   GROUP BY `userid`
--   ORDER BY `messages` DESC
--   LIMIT 25;
--
-- Daily totals per server, for a chart:
--   SELECT `day`, `serverid`, SUM(`messages`) AS `messages`,
--          COUNT(DISTINCT `userid`) AS `active_users`
--   FROM `activity__discord_daily`
--   WHERE `day` >= CURDATE() - INTERVAL 90 DAY
--   GROUP BY `day`, `serverid`
--   ORDER BY `day`;
--
-- Busiest channels on one server this month:
--   SELECT `channelid`, SUM(`messages`) AS `messages`
--   FROM `activity__discord_daily`
--   WHERE `serverid` = 465846009164070912 AND `day` >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
--   GROUP BY `channelid`
--   ORDER BY `messages` DESC;
