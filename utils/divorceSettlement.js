const { log } = require('./log');

// divorceSettlement.js

async function divorceSettlement(client, initiatorId, targetId) {
    log('Fetching assets for users:', initiatorId, targetId);

    // Fetch current dinonuggies and credits for both users
    const initiatorDinonuggies = await client.db.getUserAttr(initiatorId, 'dinonuggies');
    const initiatorCredits = await client.db.getUserAttr(initiatorId, 'credits');
    const targetDinonuggies = await client.db.getUserAttr(targetId, 'dinonuggies');
    const targetCredits = await client.db.getUserAttr(targetId, 'credits');

    // Total combined assets
    const totalDinonuggies = initiatorDinonuggies + targetDinonuggies;
    const totalCredits = initiatorCredits + targetCredits;

    // Fixed fees as percentages
    const fixedFees = [
        { name: 'Lawyer Fees', percentage: 0.30 },
        { name: 'Court Fees', percentage: 0.20 }
    ];

    const dynamicFeeOptions = [
        { name: 'Electricity of Court', percentage: 0.12 },
        { name: 'Water of Court', percentage: 0.06 },
        { name: 'Rent for Court Space', percentage: 0.18 },
        { name: 'Air Tax', percentage: 0.06 },
        { name: 'Gavel Maintenance Fee', percentage: 0.03 },
        { name: 'Chair Usage Fee', percentage: 0.024 },
        { name: 'Courtroom Snacks Tax', percentage: 0.036 },
        { name: 'Clerk Smiling Fee', percentage: 0.012 }
    ];

    // Calculate fixed fees
    const totalDinonuggiesFixedFees = Math.floor(
        fixedFees.reduce((acc, fee) => acc + totalDinonuggies * fee.percentage, 0)
    );
    const totalCreditsFixedFees = Math.floor(
        fixedFees.reduce((acc, fee) => acc + totalCredits * fee.percentage, 0)
    );

    // Randomly pick 4 dynamic fees
    const selectedDynamicFees = dynamicFeeOptions.sort(() => 0.5 - Math.random()).slice(0, 4);

    // Calculate dynamic fees
    const totalDinonuggiesDynamicFees = Math.floor(
        selectedDynamicFees.reduce((acc, fee) => acc + totalDinonuggies * fee.percentage, 0)
    );
    const totalCreditsDynamicFees = Math.floor(
        selectedDynamicFees.reduce((acc, fee) => acc + totalCredits * fee.percentage, 0)
    );

    // Calculate total fees
    const totalDinonuggiesFees = totalDinonuggiesFixedFees + totalDinonuggiesDynamicFees;
    const totalCreditsFees = totalCreditsFixedFees + totalCreditsDynamicFees;

    // Adjust remaining assets after fees
    const adjustedDinonuggies = totalDinonuggies - totalDinonuggiesFees;
    const adjustedCredits = totalCredits - totalCreditsFees;

    // Split remaining assets: 50% to each
    const targetDinonuggiesShare = Math.floor(adjustedDinonuggies * 0.5);
    const initiatorDinonuggiesShare = adjustedDinonuggies - targetDinonuggiesShare;

    const targetCreditsShare = Math.floor(adjustedCredits * 0.5);
    const initiatorCreditsShare = adjustedCredits - targetCreditsShare;

    // Update the database
    log('Updating database with adjusted split...');
    await client.db.addUserAttr(targetId, 'dinonuggies', targetDinonuggiesShare - targetDinonuggies);
    await client.db.addUserAttr(initiatorId, 'dinonuggies', initiatorDinonuggiesShare - initiatorDinonuggies);

    await client.db.addUserAttr(targetId, 'credits', targetCreditsShare - targetCredits);
    await client.db.addUserAttr(initiatorId, 'credits', initiatorCreditsShare - initiatorCredits);

    log('Divorce settlement with fixed and dynamic fees completed successfully.');

    return {
        fixedFees: fixedFees.map(fee => ({
            name: fee.name,
            dinonuggies: Math.floor(totalDinonuggies * fee.percentage),
            credits: Math.floor(totalCredits * fee.percentage)
        })),
        dynamicFees: selectedDynamicFees.map(fee => ({
            name: fee.name,
            dinonuggies: Math.floor(totalDinonuggies * fee.percentage),
            credits: Math.floor(totalCredits * fee.percentage)
        })),
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
