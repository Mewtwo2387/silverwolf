/** User-facing labels for TCG web clients (bundled into page scripts). */

export function formatSkillCategory(kind) {
  switch (kind) {
    case 'normal': return 'Normal';
    case 'charged': return 'Charged';
    case 'ultimate': return 'Ultimate';
    default: return kind;
  }
}

export function formatBattleSide(side) {
  switch (side) {
    case 'p1': return 'Player 1';
    case 'p2': return 'Player 2';
    default: return side == null ? '' : String(side).toUpperCase();
  }
}

export function formatItemKind(kind) {
  switch (kind) {
    case 'equipment': return 'Equipment';
    case 'consumable': return 'Consumable';
    default: return kind;
  }
}

export function formatRoomStatus(status) {
  switch (status) {
    case 'lobby': return 'Lobby';
    case 'active': return 'In progress';
    case 'ended': return 'Ended';
    default: return status;
  }
}

export function formatRoomMode(mode) {
  switch (mode) {
    case 'pvp': return 'PvP';
    case 'solo': return 'Solo';
    default: return mode;
  }
}
