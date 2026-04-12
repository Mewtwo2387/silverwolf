import * as readline from 'readline';
import type { Battle } from '../battle';
import { BattleStatus } from '../battle';
import {
  createDemoBattle,
  debugMaxEnergy,
  endTurnAsCurrentPlayer,
  executeUseSkill,
  formatBattleStatus,
  formatSkillsForSide,
  formatUseSkillMessage,
  getLatestEnergyGainSummary,
  parseBattleSide,
} from '../battleInterface';

function handleCommand(input: string, battle: Battle, rl: readline.Interface, promptFn: () => void) {
  const parts = input.split(' ').filter((p) => p.length > 0);
  const command = parts[0]?.toLowerCase();
  const previousPlayer = battle.currentPlayer;

  switch (command) {
    case 'status':
      console.log('\n=== Battle Status ===');
      console.log(formatBattleStatus(battle));
      console.log('\n(Still your turn - use commands or type "end" to end turn)');
      break;

    case 'skills':
      if (parts.length < 2) {
        console.log('Usage: skills [p1|p2] [charIndex]');
        break;
      }
      {
        const side = parseBattleSide(parts[1]);
        if (!side) {
          console.log('Side must be p1 or p2');
          break;
        }
        const charIdx = parts[2] ? parseInt(parts[2], 10) : 0;
        const r = formatSkillsForSide(battle, side, charIdx, 'cli');
        console.log(r.ok ? r.text : r.error);
        console.log('\n(Still your turn - use commands or type "end" to end turn)');
      }
      break;

    case 'use':
      if (parts.length < 4) {
        console.log('Usage: use [p1|p2] [charIndex] [skillIndex] [targetIndex|self]');
        console.log('  Example: use p1 0 0 0 (P1 character 0 uses skill 0 on target 0)');
        console.log('  Example: use p1 0 2 self (P1 character 0 uses skill 2 on self)');
        break;
      }
      {
        const side = parseBattleSide(parts[1]);
        if (!side) {
          console.log('Side must be p1 or p2');
          break;
        }
        const charIndex = parseInt(parts[2], 10);
        const skillIndex = parseInt(parts[3], 10);
        const targetRaw = parts[4] ?? null;
        const r = executeUseSkill(battle, side, charIndex, skillIndex, targetRaw);
        if (r.ok) {
          console.log(formatUseSkillMessage(r.detail, 'cli'));
        } else if (r.hints?.length) {
          console.log('Failed to use skill. Possible reasons:');
          r.hints.forEach((h) => {
            console.log(`  - ${h}`);
          });
        } else {
          console.log(r.error);
        }
        if (battle.status !== BattleStatus.Ongoing) {
          console.log(`\n=== Battle Ended: ${battle.status} ===`);
        }
      }
      break;

    case 'end': {
      const et = endTurnAsCurrentPlayer(battle, battle.currentPlayer);
      if (!et.ok) {
        console.log(et.error);
        break;
      }
      if (et.switched) {
        console.log(`✓ Turn ended. Switched from ${et.previous.toUpperCase()} to ${et.next.toUpperCase()}.`);
      } else {
        console.log(`✓ Turn ended. (Still ${et.next.toUpperCase()}'s turn - unexpected)`);
      }
      break;
    }

    case 'help':
      console.log('Commands:');
      console.log('  status - Show battle status');
      console.log('  skills [p1|p2] [index] - Show skills for a character');
      console.log('  use [p1|p2] [charIndex] [skillIndex] [targetIndex] - Use a skill');
      console.log('  end - End current turn (REQUIRED to switch to next player)');
      console.log('  help - Show this help');
      console.log('  quit - Exit');
      console.log('\nNote: You can use multiple skills per turn. Type "end" when done.');
      break;

    case 'debug':
      debugMaxEnergy(battle);
      console.log('Gave everyone 9999 energy.');
      break;

    case 'quit':
    case 'exit':
      console.log('Goodbye!');
      rl.close();
      return;

    default:
      console.log(`Unknown command: ${command}. Type "help" for commands.`);
  }

  if (battle.status === BattleStatus.Ongoing && command !== 'quit' && command !== 'exit') {
    if (command === 'use' || command === 'end' || previousPlayer !== battle.currentPlayer) {
      promptFn();
    } else {
      rl.question('\n> ', (line) => {
        handleCommand(line.trim(), battle, rl, promptFn);
      });
    }
  }
}

/**
 * Interactive battle example (CLI). Uses the same battle logic as `/tcgbattle` via `battleInterface`.
 */
export function runBattleExample() {
  const battle = createDemoBattle();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('=== Interactive Battle ===');
  console.log('Commands:');
  console.log('  status - Show battle status');
  console.log('  skills [p1|p2] [index] - Show skills for a character');
  console.log('  use [p1|p2] [charIndex] [skillIndex] [targetIndex] - Use a skill');
  console.log('    (use "self" or -1 for targetIndex if self-targeting)');
  console.log('  debug - Give everyone 9999 energy');
  console.log('  end - End current turn');
  console.log('  help - Show this help');
  console.log('  quit - Exit\n');

  let lastPlayer: string | null = null;

  const prompt = () => {
    if (battle.status !== BattleStatus.Ongoing) {
      console.log(`\n=== Battle Ended: ${battle.status} ===\n`);
      rl.close();
      return;
    }

    const currentSide = battle.currentPlayer;
    const currentAlly = battle.getAliveAlly(currentSide);
    const currentOpponent = battle.getAliveOpponent(currentSide);

    if (lastPlayer !== null && lastPlayer !== currentSide) {
      console.log('\n╔════════════════════════════════════════╗');
      console.log(`║  TURN SWITCHED TO ${currentSide.toUpperCase().padEnd(20)} ║`);
      console.log('╚════════════════════════════════════════╝');

      const energyInfo = getLatestEnergyGainSummary(battle);
      if (energyInfo) {
        console.log(`Energy gained: ${energyInfo} (2d6 roll)`);
      }
    }
    lastPlayer = currentSide;

    console.log(`\n=== Turn ${battle.currentTurn} - ${currentSide.toUpperCase()}'s Turn ===`);
    console.log('Your characters:');
    currentAlly.forEach((char, idx) => {
      console.log(`  [${idx}] ${char.toString()}\n`);
    });
    console.log('\nOpponent characters:');
    currentOpponent.forEach((char, idx) => {
      console.log(`  [${idx}] ${char.toString()}\n`);
    });
    console.log('\n(Each character can use 1 skill per turn. Type "end" when done with your turn.)');

    rl.question('\n> ', (input) => {
      handleCommand(input.trim(), battle, rl, prompt);
    });
  };

  prompt();
}

runBattleExample();
