import type { TableDefinition } from '../types';

export interface FootballMatchAnnouncementRow {
  match_id: string;
  pre_match_sent: number;
  last_home_score: number | null;
  last_away_score: number | null;
  full_time_sent: number;
}

const footballMatchAnnouncementTable: TableDefinition = {
  name: 'FootballMatchAnnouncement',
  columns: [
    { name: 'match_id', type: 'VARCHAR NOT NULL' },
    { name: 'pre_match_sent', type: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'last_home_score', type: 'INTEGER' },
    { name: 'last_away_score', type: 'INTEGER' },
    { name: 'full_time_sent', type: 'INTEGER NOT NULL DEFAULT 0' },
  ],
  primaryKey: ['match_id'],
  specialConstraints: ['PRIMARY KEY (match_id)'],
  constraints: [],
};

export default footballMatchAnnouncementTable;
