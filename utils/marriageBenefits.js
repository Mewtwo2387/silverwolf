const { log } = require('./log');

// marriageBenefits.js

async function marriageBenefits(client, uid) {
  // Check the user's marriage status
  log('Checking user marriage status... for user ID:', uid);
  const userMarriageStatus = await client.db.checkMarriageStatus(uid);

  // If the user is married, increase the amount by 10% (rounding up)
  if (userMarriageStatus.isMarried) {
    log('User is married. Increasing the amount by 10%...');
    return 1.1;
  }

  // If the user is single, return the original amount
  log('User is single. No bonus applied.');
  return 1;
}

module.exports = marriageBenefits;
