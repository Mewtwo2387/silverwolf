const SIMULATION_TIMES = 1000000;
const GROUP_SIZE = 2000;

const smugs = [
  { emote: '<:1yanfeismug:1136925353651228775>', value: 12 },
  { emote: '<:1silverwolfsmug1:1212343617113559051>', value: 8 },
  { emote: '<:1keqingsmug:1139794287337414766>', value: 2 },
  { emote: '<:4meltsmug:1141012813997932555>', value: 1 },
  { emote: '<:0mysticsmuguwu:1181410473695002634>', value: 0.5 },
  { emote: '<:1yanfeismug3:1181812629451317298>', value: 0.5 },
  { emote: '<:1gumsiefnay:1140883820795666463>', value: 0.5 },
];

const winningsCount = {};
let totalWinnings = 0;
let winningGroups = 0;
let winningsinGroup = 0;

for (let t = 0; t < SIMULATION_TIMES; t++) {
  const results = [[], [], []];

  for (var i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
      results[i].push(smugs[Math.floor(Math.random() * smugs.length)]);
    }
  }

  let winnings = 0;

  const lines = [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [0, 0, 0, 1, 2], [2, 2, 2, 1, 0]];

  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote && results[line[2]][2].emote === results[line[3]][3].emote && results[line[3]][3].emote === results[line[4]][4].emote) {
      winnings += results[line[0]][0].value * 20;
    } else if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote && results[line[2]][2].emote === results[line[3]][3].emote) {
      winnings += results[line[0]][0].value * 4;
    } else if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote) {
      winnings += results[line[1]][1].value;
    }
  }

  // console.log(`${t}: ${winnings}`);

  totalWinnings += winnings;
  winningsinGroup += winnings;

  if (winningsCount[winnings]) {
    winningsCount[winnings]++;
  } else {
    winningsCount[winnings] = 1;
  }

  if ((t + 1) % GROUP_SIZE === 0) {
    if (winningsinGroup > 0) {
      winningGroups++;
    }
    console.log(`Group ${(t + 1) / GROUP_SIZE}: ${winningsinGroup}`);
    winningsinGroup = -GROUP_SIZE;
  }
}

// for (const [winnings, count] of Object.entries(winningsCount)) {
//     console.log(`x${winnings}: ${count} times`)
// }

console.log(`Average winnings: ${totalWinnings / SIMULATION_TIMES}`);
console.log(`Winning groups: ${winningGroups} out of ${SIMULATION_TIMES / GROUP_SIZE}`);
