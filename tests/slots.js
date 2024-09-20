const SIMULATION_TIMES = 1000000;
const GROUP_SIZE = 2000

const smugs = [
    {emote: "<:1yanfeismug:1136925353651228775>", value: 8},
    {emote: "<:1silverwolfsmug1:1212343617113559051>", value: 6},
    {emote: "<:1keqingsmug:1139794287337414766>", value: 4},
    {emote: "<:4meltsmug:1141012813997932555>", value: 3},
    {emote: "<:0mysticsmuguwu:1181410473695002634>", value: 1},
    {emote: "<:1yanfeismug3:1181812629451317298>", value: 1},
    {emote: "<:1gumsiefnay:1140883820795666463>", value: 1},
]

var winningsCount = {};
var totalWinnings = 0;
var winningGroups = 0;
var winningsinGroup = 0;

for (var t = 0; t < SIMULATION_TIMES; t++) {

    var results = [[], [], []];

    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 5; j++) {
            results[i].push(smugs[Math.floor(Math.random() * smugs.length)]);
        }
    }

    var winnings = 0;

    const lines = [[0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2], [0,1,2,2,2], [2,1,0,0,0], [0,0,0,1,2], [2,2,2,1,0]]

    for (var i = 0; i < lines.length; i++) {
        const line = lines[i];
        if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote && results[line[2]][2].emote == results[line[3]][3].emote && results[line[3]][3].emote == results[line[4]][4].emote){
            winnings += results[line[0]][0].value * 25;
        } else if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote && results[line[2]][2].emote == results[line[3]][3].emote){
            winnings += results[line[0]][0].value * 5;
        } else if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote){
            winnings += results[line[1]][1].value;
        }
    }

    totalWinnings += winnings;
    winningsinGroup += winnings;

    if (winningsCount[winnings]) {
        winningsCount[winnings]++;
    } else {
        winningsCount[winnings] = 1;
    }

    if ((t + 1) % GROUP_SIZE == 0) {
        if (winningsinGroup > 0) {
            winningGroups++;
        }
        console.log(`Group ${(t + 1) / GROUP_SIZE}: ${winningsinGroup}`);
        winningsinGroup = -GROUP_SIZE;
    }
}

console.log(`Average winnings: ${totalWinnings / SIMULATION_TIMES}`);
