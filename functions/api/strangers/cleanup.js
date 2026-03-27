// Cron-triggered cleanup for stranger matching tables
// Also available as GET /api/strangers/cleanup for manual trigger

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function runCleanup(db) {
  // Expire stale queue entries
  const expired = await db.prepare(
    `UPDATE match_queue SET status = 'expired' WHERE status = 'waiting' AND expires_at < datetime('now')`
  ).run();

  // Abandon matches with no activity for 10 minutes
  const abandoned = await db.prepare(
    `UPDATE stranger_matches SET state = 'resolved', result = 'abandoned'
     WHERE state = 'playing' AND created_at < datetime('now', '-10 minutes')`
  ).run();

  // Expire unresolved votes past deadline
  const votesExpired = await db.prepare(
    `UPDATE stranger_matches SET state = 'resolved', result = 'expired'
     WHERE state = 'voting' AND vote_deadline < datetime('now')`
  ).run();

  // Hard delete old records
  const queueDeleted = await db.prepare(
    `DELETE FROM match_queue WHERE created_at < datetime('now', '-1 day')`
  ).run();

  const matchesDeleted = await db.prepare(
    `DELETE FROM stranger_matches WHERE created_at < datetime('now', '-7 days')`
  ).run();

  return {
    expired_queue: expired.meta.changes,
    abandoned_matches: abandoned.meta.changes,
    expired_votes: votesExpired.meta.changes,
    deleted_queue: queueDeleted.meta.changes,
    deleted_matches: matchesDeleted.meta.changes,
  };
}

// Manual trigger via GET
export async function onRequestGet(context) {
  const result = await runCleanup(context.env.DB);
  return json(result);
}

// Cron trigger
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCleanup(env.DB));
  },
};
