import footballTeamsData from '../data/football-teams.json';

export interface FootballTeamDisplay {
  nickname: string;
  flag: string;
}

type FootballTeamsFile = Record<string, FootballTeamDisplay>;

const teams = footballTeamsData as FootballTeamsFile;

export function getFootballTeamDisplay(sourceName: string): FootballTeamDisplay {
  const entry = teams[sourceName];
  if (entry) {
    return {
      nickname: entry.nickname || sourceName,
      flag: entry.flag ?? '',
    };
  }
  return { nickname: sourceName, flag: '' };
}

export function formatFootballTeam(sourceName: string, position: 'before' | 'after' = 'before'): string {
  const { nickname, flag } = getFootballTeamDisplay(sourceName);
  if (!flag) return nickname;
  return position === 'before' ? `${flag} ${nickname}` : `${nickname} ${flag}`;
}
