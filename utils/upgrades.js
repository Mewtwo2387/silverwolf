// get cost from level to level + 1
function getNextUpgradeCost(level){
    if (level < 10){
        return 5000 * level;
    }else if(level < 20){
        return 500 * level * level;
    }else{
        return 25 * level * level * level;
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
    for (let i = 1; i < 30; i++){
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
    return 24 * Math.pow(0.25, (level - 1) / 29);
}

module.exports = { getNextUpgradeCost, getTotalUpgradeCost, getMultiplierAmount, getMultiplierChance, getBekiCooldown };

