function getNextAscensionUpgradeCost(level){
    return 500 * level * level;
}

function getTotalAscensionUpgradeCost(level){
    let totalCost = 0;
    for (let i = 1; i < level; i++){
        totalCost += getNextAscensionUpgradeCost(i);
    }
    return totalCost;
}

function getNuggieFlatMultiplier(level){
    return level;
}

function getNuggieStreakMultiplier(level){
    return 0.01 * (level - 1)
}

module.exports = { getNextAscensionUpgradeCost, getTotalAscensionUpgradeCost, getNuggieFlatMultiplier, getNuggieStreakMultiplier };















