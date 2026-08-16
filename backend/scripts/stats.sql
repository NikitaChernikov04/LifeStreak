-- Сколько людей в приложении и сколько из них живые.
--
-- Вставить в Supabase → SQL Editor и сохранить как snippet: тогда это две
-- кнопки, без установки чего-либо.
--
-- Почему активность считается по отметкам, а не по «последнему заходу»:
-- users."lastSeenAt" обновляется только при входе, а сессия лежит в
-- localStorage — вернувшийся человек логин не повторяет, и его lastSeenAt
-- остаётся датой первого дня. То есть это «когда зарегистрировался/перезашёл»,
-- а не «когда был». Отметка дня — однозначный след: человек открыл приложение
-- и сделал то, ради чего оно есть.
--
-- Демо-персонажи (см. scripts/seed-demo-world.ts) исключены везде: их
-- telegramId начинается с demo-, а у настоящего аккаунта Telegram id числовой.

WITH people AS (
  SELECT * FROM users WHERE "telegramId" NOT LIKE 'demo-%'
),
marks AS (
  SELECT c.* FROM daily_checkins c JOIN people p ON p.id = c."userId"
)
SELECT
  (SELECT COUNT(*) FROM people)                                                        AS "зарегистрировано",
  (SELECT COUNT(*) FROM people WHERE "createdAt" > NOW() - INTERVAL '7 days')           AS "новых за неделю",
  (SELECT COUNT(DISTINCT "userId") FROM marks WHERE date = date_trunc('day', NOW()))    AS "отметились сегодня",
  (SELECT COUNT(DISTINCT "userId") FROM marks WHERE date > NOW() - INTERVAL '7 days')   AS "активны за неделю",
  (SELECT COUNT(DISTINCT "userId") FROM marks WHERE date > NOW() - INTERVAL '30 days')  AS "активны за месяц",
  (SELECT COUNT(DISTINCT "userId") FROM marks)                                          AS "отметились хоть раз",
  (SELECT COUNT(*) FROM marks)                                                          AS "отметок всего",
  (SELECT COUNT(*) FROM streaks s JOIN people p ON p.id = s."userId"
    WHERE s.status = 'ACTIVE')                                                          AS "живых серий";


-- Регистрации по дням — видно, что дала каждая раздача ссылки.
SELECT
  to_char(date_trunc('day', "createdAt"), 'DD.MM')  AS "день",
  COUNT(*)                                          AS "новых"
FROM users
WHERE "telegramId" NOT LIKE 'demo-%'
GROUP BY date_trunc('day', "createdAt")
ORDER BY date_trunc('day', "createdAt") DESC
LIMIT 30;


-- Воронка. Здесь видно не «сколько людей», а где они отваливаются, и это
-- единственное число, которое стоит смотреть каждый день на таком масштабе.
SELECT
  COUNT(*)                                                              AS "всего",
  COUNT(*) FILTER (WHERE st.n IS NULL)                                  AS "не завели серию",
  COUNT(*) FILTER (WHERE st.n >= 1 AND COALESCE(ck.n, 0) = 0)            AS "завели, но не отметились",
  COUNT(*) FILTER (WHERE COALESCE(ck.n, 0) BETWEEN 1 AND 3)              AS "1-3 отметки",
  COUNT(*) FILTER (WHERE COALESCE(ck.n, 0) > 3)                          AS "больше 3"
FROM users u
LEFT JOIN (SELECT "userId", COUNT(*) n FROM streaks GROUP BY 1) st ON st."userId" = u.id
LEFT JOIN (SELECT "userId", COUNT(*) n FROM daily_checkins GROUP BY 1) ck ON ck."userId" = u.id
WHERE u."telegramId" NOT LIKE 'demo-%';
