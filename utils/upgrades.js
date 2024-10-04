const MAX_LEVEL = 50;

// get cost from level to level + 1
function getNextUpgradeCost(level){
    if (level < 10){
        // ascension 1
        // level 1->2 to 9->10: linear from 5k to 45k
        return 5000 * level;
    }else if(level < 20){
        // ascension 1
        // level 10 to 19: quadratic from 50k to 180k
        return 500 * level * level;
    }else if(level < 30){
        // ascension 1
        // level 20->21 to 29->30: cubic from 200k to 610k
        return 25 * level * level * level;
    }else if(level < 40){
        // ascension 2
        // level 30->31 to 39->40: linear from 1m to 10m
        return 1000000 * (level - 29);
    }else if(level < 50){
        // ascension 3
        // level 40->41 to 49->50: linear from 10m to 100m
        return 10000000 * (level - 39);
    }
}

// get total cost from level 1 to level
function getTotalUpgradeCost(level){
    let totalCost = 0;
    for (let i = 1; i < level; i++){
        totalCost += getNextUpgradeCost(i);
    }
    return totalCost;
}

function dump(){
    for (let i = 1; i < 50; i++){
        console.log(`Level ${String(i).padStart(2, '0')} -> ${String(i + 1).padStart(2, '0')} cost: ${String(getNextUpgradeCost(i)).padStart(6, ' ')} Total cost: ${String(getTotalUpgradeCost(i + 1)).padStart(7, ' ')}`);
    }
}

function getMultiplierAmount(level){
    return {
        bronze: 1.4 + 0.1 * level,
        silver: 1.8 + 0.2 * level,
        gold: 2.6 + 0.4 * level
    }
}

function getMultiplierChance(level){
    gold = 0.025 + 0.005 * level;
    silver = 0.05 + 0.01 * level;
    bronze = 0.1 + 0.02 * level;
    if (gold > 1){
        gold = 1;
        silver = 0;
        bronze = 0;
    }else if(gold + silver > 1){
        silver = 1 - gold;
        bronze = 0;
    }else if(gold + silver + bronze > 1){
        bronze = 1 - gold - silver;
    }
    return {gold, silver, bronze};
}

function getBekiCooldown(level) {
    if (level <= 30){
        // ascension 1
        // level 1 to 30: 24h to 6h
        return 24 * Math.pow(0.25, (level - 1) / 29);
    }else if (level <= 40){
        // ascension 2
        // level 30 to 40: 6h to 4h
        return 6 * Math.pow(4/6, (level - 30) / 10);
    }else if (level <= 50){
        // ascension 3
        // level 40 to 50: 4h to 3h
        return 4 * Math.pow(3/4, (level - 40) / 10);
    }
}

function getMaxLevel(ascensionLevel){
    return Math.min(20 + 10 * ascensionLevel, MAX_LEVEL);
}

module.exports = { getNextUpgradeCost, getTotalUpgradeCost, getMultiplierAmount, getMultiplierChance, getBekiCooldown, getMaxLevel };

