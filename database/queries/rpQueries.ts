const rpQueries = {
  // ── Characters ────────────────────────────────────────────────────────────
  INSERT_CHARACTER: `
    INSERT INTO RpCharacter
      (char_id, creator_id, name, name_lower, details, starting_message, pfp_url, pfp_message_id, pfp_channel_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  GET_CHARACTER_BY_ID: 'SELECT * FROM RpCharacter WHERE char_id = ?',
  COUNT_CHARACTERS_BY_CREATOR: 'SELECT COUNT(*) AS count FROM RpCharacter WHERE creator_id = ?',
  // Ownership is enforced in the WHERE clause: a non-owner update changes 0 rows.
  UPDATE_CHARACTER: `
    UPDATE RpCharacter
    SET name = ?, name_lower = ?, details = ?, starting_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE char_id = ? AND creator_id = ?
  `,
  UPDATE_CHARACTER_PFP: `
    UPDATE RpCharacter
    SET pfp_url = ?, pfp_message_id = ?, pfp_channel_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE char_id = ?
  `,
  CLEAR_CHARACTER_PFP_URL: 'UPDATE RpCharacter SET pfp_url = NULL WHERE char_id = ?',
  // Substring search over name, plus id prefix. Caller passes ('%term%', 'term%').
  SEARCH_CHARACTERS: `
    SELECT char_id, creator_id, name, name_lower
    FROM RpCharacter
    WHERE name_lower LIKE ? OR char_id LIKE ?
    ORDER BY name_lower ASC
    LIMIT 25
  `,
  // Same search, scoped to one creator — so the owner's matches aren't crowded out of
  // the top-25 by other users' characters. Caller passes (creatorId, '%term%', 'term%').
  SEARCH_OWN_CHARACTERS: `
    SELECT char_id, creator_id, name, name_lower
    FROM RpCharacter
    WHERE creator_id = ? AND (name_lower LIKE ? OR char_id LIKE ?)
    ORDER BY name_lower ASC
    LIMIT 25
  `,

  // ── Spawns ────────────────────────────────────────────────────────────────
  GET_SPAWN: 'SELECT * FROM RpSpawn WHERE channel_id = ? AND char_id = ?',
  GET_SPAWN_BY_ID: 'SELECT * FROM RpSpawn WHERE spawn_id = ?',
  INSERT_SPAWN: `
    INSERT INTO RpSpawn (channel_id, guild_id, char_id, spawner_id, interactability, compaction_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  // Re-spawn / reconfigure: reactivate and overwrite the live params (never the
  // character definition). Compaction state and history are left untouched.
  // A deliberate re-spawn also clears a stale compaction_failed flag, so an all-mode
  // character that previously hit a compaction failure can re-enter the proactive
  // scheduler (GET_ACTIVE_ALL_SPAWNS filters out compaction_failed = 1).
  REACTIVATE_SPAWN: `
    UPDATE RpSpawn
    SET active = 1, spawner_id = ?, interactability = ?, compaction_enabled = ?,
        compaction_failed = 0,
        last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE spawn_id = ?
  `,
  DEACTIVATE_SPAWN: 'UPDATE RpSpawn SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE spawn_id = ?',
  COUNT_ACTIVE_SPAWNS_IN_CHANNEL: 'SELECT COUNT(*) AS count FROM RpSpawn WHERE channel_id = ? AND active = 1',
  // Active spawns in a channel + their character definition, for the mention router.
  GET_ACTIVE_SPAWNS_IN_CHANNEL: `
    SELECT s.*, c.name AS char_name, c.name_lower AS char_name_lower, c.details AS char_details,
           c.starting_message AS char_starting_message, c.creator_id AS char_creator_id,
           c.pfp_url AS char_pfp_url, c.pfp_message_id AS char_pfp_message_id,
           c.pfp_channel_id AS char_pfp_channel_id
    FROM RpSpawn s
    JOIN RpCharacter c ON c.char_id = s.char_id
    WHERE s.channel_id = ? AND s.active = 1
  `,
  // Every active "all"-mode spawn across all channels, for the proactive scheduler.
  GET_ACTIVE_ALL_SPAWNS: `
    SELECT s.*, c.name AS char_name, c.details AS char_details,
           c.starting_message AS char_starting_message,
           c.pfp_url AS char_pfp_url, c.pfp_message_id AS char_pfp_message_id,
           c.pfp_channel_id AS char_pfp_channel_id
    FROM RpSpawn s
    JOIN RpCharacter c ON c.char_id = s.char_id
    WHERE s.active = 1 AND s.interactability = 'all' AND s.compaction_failed = 0
  `,
  TOUCH_SPAWN_ACTIVITY: 'UPDATE RpSpawn SET last_activity_at = CURRENT_TIMESTAMP WHERE spawn_id = ?',
  // Channels with at least one active spawn — used to build the in-memory fast-path set.
  GET_DISTINCT_ACTIVE_CHANNELS: 'SELECT DISTINCT channel_id FROM RpSpawn WHERE active = 1',
  SET_COMPACTION_STATE: `
    UPDATE RpSpawn
    SET compacted_memory = ?, compacted_upto_id = ?, compaction_failed = 0, updated_at = CURRENT_TIMESTAMP
    WHERE spawn_id = ?
  `,
  SET_COMPACTION_FAILED: 'UPDATE RpSpawn SET compaction_failed = ? WHERE spawn_id = ?',
  RESET_COMPACTION: `
    UPDATE RpSpawn
    SET compacted_memory = NULL, compacted_upto_id = NULL, compaction_failed = 0, updated_at = CURRENT_TIMESTAMP
    WHERE spawn_id = ?
  `,

  // ── History ───────────────────────────────────────────────────────────────
  ADD_HISTORY: `
    INSERT INTO RpHistory (spawn_id, role, speaker_id, speaker_name, message, from_bot)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  // The un-compacted tail (rows newer than compacted_upto_id), oldest first.
  GET_HISTORY_AFTER: 'SELECT * FROM RpHistory WHERE spawn_id = ? AND id > ? ORDER BY id ASC',
  // Role of the newest turn — 'user' means the character has something to respond to.
  GET_LAST_HISTORY_ROLE: 'SELECT role FROM RpHistory WHERE spawn_id = ? ORDER BY id DESC LIMIT 1',
  // Is there a *human* (from_bot = 0) user turn the character hasn't replied to yet?
  // Bot/webhook turns (other characters, other apps) are context only — they never
  // count as unanswered, so the proactive scheduler can't set off a bot-to-bot loop.
  // Params: (spawnId, spawnId).
  HAS_UNANSWERED_HUMAN_TURN: `
    SELECT EXISTS(
      SELECT 1 FROM RpHistory
      WHERE spawn_id = ? AND role = 'user' AND from_bot = 0
        AND id > COALESCE((SELECT MAX(id) FROM RpHistory WHERE spawn_id = ? AND role = 'model'), 0)
    ) AS has
  `,
  COUNT_HISTORY: 'SELECT COUNT(*) AS count FROM RpHistory WHERE spawn_id = ?',
  // Whole-table footprint (row count + total message bytes) for /memstats diagnostics.
  HISTORY_STATS: 'SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(message)), 0) AS bytes FROM RpHistory',
  DELETE_HISTORY_BY_SPAWN: 'DELETE FROM RpHistory WHERE spawn_id = ?',

  // ── Indexes (run on init) ─────────────────────────────────────────────────
  CREATE_INDEX_SPAWN_CHANNEL: 'CREATE INDEX IF NOT EXISTS idx_rpspawn_channel_active ON RpSpawn (channel_id, active)',
  CREATE_INDEX_SPAWN_ALL: 'CREATE INDEX IF NOT EXISTS idx_rpspawn_active_interact ON RpSpawn (active, interactability)',
  CREATE_INDEX_HISTORY_SPAWN: 'CREATE INDEX IF NOT EXISTS idx_rphistory_spawn_id ON RpHistory (spawn_id, id)',
  // Covers HAS_UNANSWERED_HUMAN_TURN (filters by role, runs per all-mode spawn each tick).
  CREATE_INDEX_HISTORY_SPAWN_ROLE: 'CREATE INDEX IF NOT EXISTS idx_rphistory_spawn_role_id ON RpHistory (spawn_id, role, id)',
  CREATE_INDEX_CHAR_NAME: 'CREATE INDEX IF NOT EXISTS idx_rpcharacter_name_lower ON RpCharacter (name_lower)',
  CREATE_INDEX_CHAR_CREATOR: 'CREATE INDEX IF NOT EXISTS idx_rpcharacter_creator ON RpCharacter (creator_id)',
};

export default rpQueries;
