const footballMatchAnnouncementQueries = {
  GET: `
    SELECT * FROM FootballMatchAnnouncement WHERE match_id = ?
  `,
  UPSERT_PRE_MATCH: `
    INSERT INTO FootballMatchAnnouncement (match_id, pre_match_sent)
    VALUES (?, 1)
    ON CONFLICT(match_id)
    DO UPDATE SET pre_match_sent = 1
  `,
  UPSERT_SCORE: `
    INSERT INTO FootballMatchAnnouncement (match_id, last_home_score, last_away_score)
    VALUES (?, ?, ?)
    ON CONFLICT(match_id)
    DO UPDATE SET
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score
  `,
  UPSERT_GOAL_ANNOUNCED: `
    INSERT INTO FootballMatchAnnouncement (
      match_id, last_home_score, last_away_score, last_announced_goal_count
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(match_id)
    DO UPDATE SET
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score,
      last_announced_goal_count = excluded.last_announced_goal_count
  `,
  UPSERT_BASELINE_WITH_SCORE: `
    INSERT INTO FootballMatchAnnouncement (
      match_id, pre_match_sent, last_home_score, last_away_score, last_announced_goal_count
    )
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(match_id)
    DO UPDATE SET
      pre_match_sent = 1,
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score,
      last_announced_goal_count = excluded.last_announced_goal_count
  `,
  UPSERT_FULL_TIME: `
    INSERT INTO FootballMatchAnnouncement (
      match_id, pre_match_sent, last_home_score, last_away_score, last_announced_goal_count, full_time_sent
    )
    VALUES (?, 1, ?, ?, ?, 1)
    ON CONFLICT(match_id)
    DO UPDATE SET
      pre_match_sent = 1,
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score,
      last_announced_goal_count = excluded.last_announced_goal_count,
      full_time_sent = 1
  `,
  UPSERT_SHOOTOUT_SYNC: `
    INSERT INTO FootballMatchAnnouncement (
      match_id, last_shootout_kick_count, shootout_message_ids, last_home_score, last_away_score
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(match_id)
    DO UPDATE SET
      last_shootout_kick_count = excluded.last_shootout_kick_count,
      shootout_message_ids = excluded.shootout_message_ids,
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score
  `,
  UPSERT_SHOOTOUT_FINISHED: `
    INSERT INTO FootballMatchAnnouncement (
      match_id, pre_match_sent, last_shootout_kick_count, shootout_message_ids,
      last_home_score, last_away_score, full_time_sent
    )
    VALUES (?, 1, ?, ?, ?, ?, 1)
    ON CONFLICT(match_id)
    DO UPDATE SET
      pre_match_sent = 1,
      last_shootout_kick_count = excluded.last_shootout_kick_count,
      shootout_message_ids = excluded.shootout_message_ids,
      last_home_score = excluded.last_home_score,
      last_away_score = excluded.last_away_score,
      full_time_sent = 1
  `,
};

export default footballMatchAnnouncementQueries;
