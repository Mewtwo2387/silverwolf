const { log } = require('./log');

// divorceSettlement.js

async function divorceSettlement(client, initiatorId, targetId) {
    // Fetch current dinonuggies and credits for both users
    log('Fetching assets for users:', initiatorId, targetId);
    const initiatorDinonuggies = await client.db.getUserAttr(initiatorId, 'dinonuggies');
    const initiatorCredits = await client.db.getUserAttr(initiatorId, 'credits');
    const targetDinonuggies = await client.db.getUserAttr(targetId, 'dinonuggies');
    const targetCredits = await client.db.getUserAttr(targetId, 'credits');

    // Combine assets
    const totalDinonuggies = initiatorDinonuggies + targetDinonuggies;
    const totalCredits = initiatorCredits + targetCredits;

    // Split assets: 80% to the target (the one being dumped), 20% to the initiator
    const targetDinonuggiesShare = Math.floor(totalDinonuggies * 0.8);
    const initiatorDinonuggiesShare = totalDinonuggies - targetDinonuggiesShare;

    const targetCreditsShare = Math.floor(totalCredits * 0.8);
    const initiatorCreditsShare = totalCredits - targetCreditsShare;

    // Update the database with the new values
    log('Updating database with the new split...');
    await client.db.addUserAttr(targetId, 'dinonuggies', targetDinonuggiesShare - targetDinonuggies); // Add the difference
    await client.db.addUserAttr(initiatorId, 'dinonuggies', initiatorDinonuggiesShare - initiatorDinonuggies); // Add the difference

    await client.db.addUserAttr(targetId, 'credits', targetCreditsShare - targetCredits); // Add the difference
    await client.db.addUserAttr(initiatorId, 'credits', initiatorCreditsShare - initiatorCredits); // Add the difference

    log('Divorce settlement completed successfully.');
    return {
        initiator: {
            dinonuggies: initiatorDinonuggiesShare,
            credits: initiatorCreditsShare
        },
        target: {
            dinonuggies: targetDinonuggiesShare,
            credits: targetCreditsShare
        }
    };
}

module.exports = divorceSettlement;
