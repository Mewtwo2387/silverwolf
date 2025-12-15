import * as readline from 'readline';
import { Battle, BattleStatus } from './battle';
import { KAITLIN, VENFEI } from './characters';
import { CharacterInBattle } from './characterInBattle';

/**
 * Interactive battle example
 */
export function runBattleExample() {
  // Create a battle between Kaitlin (P1) and Venfei (P2)
  const battle = new Battle([KAITLIN, VENFEI, VENFEI], [VENFEI, KAITLIN, KAITLIN]);

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
  console.log('  debug - Give everyone 9999 energy')
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

    // Show a clear message when turn switches
    if (lastPlayer !== null && lastPlayer !== currentSide) {
      console.log(`\n╔════════════════════════════════════════╗`);
      console.log(`║  TURN SWITCHED TO ${currentSide.toUpperCase().padEnd(20)} ║`);
      console.log(`╚════════════════════════════════════════╝`);
      
      // Show energy gains from 2d6 roll
      const energyGainEntries = battle.turnHistory.filter(h => h.includes('Energy gained (2d6)'));
      if (energyGainEntries.length > 0) {
        const latestEnergyGain = energyGainEntries[energyGainEntries.length - 1];
        const energyInfo = latestEnergyGain.replace('Energy gained (2d6): ', '');
        console.log(`Energy gained: ${energyInfo} (2d6 roll)`);
      }
    }
    lastPlayer = currentSide;

    console.log(`\n=== Turn ${battle.currentTurn} - ${currentSide.toUpperCase()}'s Turn ===`);
    console.log(`Your characters:`);
    currentAlly.forEach((char, idx) => {
      console.log(`  [${idx}] ${char.toString()}`);
    });
    console.log(`\nOpponent characters:`);
    currentOpponent.forEach((char, idx) => {
      console.log(`  [${idx}] ${char.toString()}`);
    });
    console.log(`\n(Each character can use 1 skill per turn. Type "end" when done with your turn.)`);

    rl.question('\n> ', (input) => {
      handleCommand(input.trim(), battle, rl, prompt);
    });
  };

  prompt();
}

function handleCommand(input: string, battle: Battle, rl: readline.Interface, promptFn: () => void) {
  const parts = input.split(' ').filter(p => p.length > 0);
  const command = parts[0]?.toLowerCase();
  const previousPlayer = battle.currentPlayer;

  switch (command) {
    case 'status':
      printStatus(battle);
      // Don't re-prompt for status, just show it
      console.log('\n(Still your turn - use commands or type "end" to end turn)');
      break;

    case 'skills':
      if (parts.length < 2) {
        console.log('Usage: skills [p1|p2] [charIndex]');
        break;
      }
      const side = parts[1];
      const charIdx = parts[2] ? parseInt(parts[2]) : 0;
      printSkills(battle, side, charIdx);
      // Don't re-prompt for skills, just show it
      console.log('\n(Still your turn - use commands or type "end" to end turn)');
      break;

    case 'use':
      if (parts.length < 4) {
        console.log('Usage: use [p1|p2] [charIndex] [skillIndex] [targetIndex|self]');
        console.log('  Example: use p1 0 0 0 (P1 character 0 uses skill 0 on target 0)');
        console.log('  Example: use p1 0 2 self (P1 character 0 uses skill 2 on self)');
        break;
      }
      handleUseSkill(parts, battle);
      // After using a skill, show prompt again (same turn, can use more skills)
      break;

    case 'end':
      const playerBeforeEnd = battle.currentPlayer;
      battle.endTurn();
      const playerAfterEnd = battle.currentPlayer;
      if (playerBeforeEnd !== playerAfterEnd) {
        console.log(`✓ Turn ended. Switched from ${playerBeforeEnd.toUpperCase()} to ${playerAfterEnd.toUpperCase()}.`);
      } else {
        console.log(`✓ Turn ended. (Still ${playerAfterEnd.toUpperCase()}'s turn - this shouldn't happen normally)`);
      }
      break;

    case 'help':
      console.log('Commands:');
      console.log('  status - Show battle status');
      console.log('  skills [p1|p2] [index] - Show skills for a character');
      console.log('  use [p1|p2] [charIndex] [skillIndex] [targetIndex] - Use a skill');
      console.log('  end - End current turn (REQUIRED to switch to next player)');
      console.log('  help - Show this help');
      console.log('  quit - Exit');
      console.log('\nNote: You can use multiple skills per turn. Type "end" when done.');
      // Don't re-prompt for help
      break;
    
    case 'debug':
      battle.p1cards.forEach(char => {
        char.gainEnergy(9999);
      });
      battle.p2cards.forEach(char => {
        char.gainEnergy(9999);
      });
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

  // Only re-prompt for commands that don't show info (use, end) or if turn changed
  if (battle.status === BattleStatus.Ongoing && command !== 'quit' && command !== 'exit') {
    if (command === 'use' || command === 'end' || previousPlayer !== battle.currentPlayer) {
      promptFn();
    } else {
      // For info commands (status, skills, help), wait for next input
      rl.question('\n> ', (input) => {
        handleCommand(input.trim(), battle, rl, promptFn);
      });
    }
  }
}

function printStatus(battle: Battle) {
  console.log('\n=== Battle Status ===');
  console.log(battle.toString());
}

function printSkills(battle: Battle, side: string, charIndex: number) {
  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (charIndex < 0 || charIndex >= allies.length) {
    console.log(`Invalid character index: ${charIndex}`);
    return;
  }

  const char = allies[charIndex];
  if (char.isKnockedOut) {
    console.log(`${char.character.name} is knocked out.`);
    return;
  }

  console.log(`\n${char.character.name}'s skills:`);
  const activeSkills = char.getActiveSkills();
  char.character.skills.forEach((skill, idx) => {
    const isActive = activeSkills.includes(skill);
    const canUse = isActive && char.energy >= skill.cost;
    const status = isActive ? (canUse ? '[AVAILABLE]' : `[LOCKED - Need ${skill.cost} energy, have ${char.energy}]`) : '[FORM LOCKED]';
    console.log(`  [${idx}] ${skill.toString()} - ${status}`);
    console.log(`      Description: ${skill.description}`);
  });
}

function handleUseSkill(parts: string[], battle: Battle) {
  const side = parts[1];
  const charIndex = parseInt(parts[2]);
  const skillIndex = parseInt(parts[3]);
  const targetStr = parts[4]?.toLowerCase();

  if (side !== 'p1' && side !== 'p2') {
    console.log('Side must be p1 or p2');
    return;
  }

  if (side !== battle.currentPlayer) {
    console.log(`It's not ${side}'s turn. Current player: ${battle.currentPlayer}`);
    return;
  }

  const allies = side === 'p1' ? battle.p1cards : battle.p2cards;
  if (charIndex < 0 || charIndex >= allies.length) {
    console.log(`Invalid character index: ${charIndex}`);
    return;
  }

  const character = allies[charIndex];
  if (character.isKnockedOut) {
    console.log(`${character.character.name} is knocked out.`);
    return;
  }

  // Get target
  let target: CharacterInBattle | null = null;
  if (targetStr === 'self' || targetStr === '-1' || targetStr === 'null') {
    target = null; // Self-targeting
  } else {
    const targetIndex = parseInt(targetStr || '0');
    const opponents = battle.getAliveOpponent(side);
    if (targetIndex >= 0 && targetIndex < opponents.length) {
      target = opponents[targetIndex];
    } else {
      // Also allow targeting allies
      const allAllies = battle.getAliveAlly(side);
      if (targetIndex >= 0 && targetIndex < allAllies.length) {
        target = allAllies[targetIndex];
      } else {
        console.log(`Invalid target index: ${targetIndex}`);
        return;
      }
    }
  }

  const success = battle.useSkill(character, skillIndex, target);
  if (success) {
    const targetName = target ? target.character.name : character.character.name;
    console.log(`${character.character.name} used ${character.character.skills[skillIndex]?.name || `skill ${skillIndex}`} on ${targetName}!`);
  } else {
    console.log(`Failed to use skill. Possible reasons:`);
    if (character.hasUsedSkillThisTurn) {
      console.log(`  - Character has already used a skill this turn (1 skill per character per turn)`);
    }
    const activeSkills = character.getActiveSkills();
    const skill = character.character.skills[skillIndex];
    if (skill && !activeSkills.includes(skill)) {
      console.log(`  - Skill not available in current form`);
    }
    if (skill && character.energy < skill.cost) {
      console.log(`  - Not enough energy (need ${skill.cost}, have ${character.energy})`);
    }
    if (!skill) {
      console.log(`  - Invalid skill index`);
    }
    if (character.isKnockedOut) {
      console.log(`  - Character is knocked out`);
    }
  }

  // Check if battle ended
  if (battle.status !== BattleStatus.Ongoing) {
    console.log(`\n=== Battle Ended: ${battle.status} ===`);
  }
}

runBattleExample();