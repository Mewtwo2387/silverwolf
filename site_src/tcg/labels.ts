export { elementDisplayName } from '../../tcg/element';

export function formatSkillCategory(kind: string): string {
  switch (kind) {
    case 'normal': return 'Normal';
    case 'charged': return 'Charged';
    case 'ultimate': return 'Ultimate';
    default: return kind;
  }
}

export function formatRoomStatus(status: string): string {
  switch (status) {
    case 'lobby': return 'Lobby';
    case 'active': return 'In progress';
    case 'ended': return 'Ended';
    default: return status;
  }
}

export function formatRoomMode(mode: string): string {
  switch (mode) {
    case 'pvp': return 'PvP';
    case 'solo': return 'Solo';
    default: return mode;
  }
}

export function formatBattleSide(side: string): string {
  switch (side) {
    case 'p1': return 'Player 1';
    case 'p2': return 'Player 2';
    default: return side.toUpperCase();
  }
}

export function formatItemKind(kind: string): string {
  switch (kind) {
    case 'equipment': return 'Equipment';
    case 'consumable': return 'Consumable';
    default: return kind;
  }
}
