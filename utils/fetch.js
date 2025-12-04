const { log } = require('./log');

async function fetchMessages(channel, limit) {
  const messages = [];
  let lastId;
  let remaining = limit;

  while (remaining > 0) {
    const fetchLimit = Math.min(remaining, 100);
    const options = { limit: fetchLimit };
    if (lastId) {
      options.before = lastId;
    }

    const fetchedMessages = await channel.messages.fetch(options);

    if (fetchedMessages.size === 0) {
      log(`No more messages to fetch. Total messages: ${messages.length}`);
      break;
    }

    messages.push(...fetchedMessages);
    lastId = fetchedMessages.last().id;

    log(`Fetched ${fetchedMessages.size} messages. Total messages: ${messages.length}`);
    remaining -= fetchedMessages.size;
    if (fetchedMessages.size !== fetchLimit) {
      log(`Reached the end of the channel. Total messages: ${messages.length}`);
      break;
    }
  }
  return messages.reverse();
}

module.exports = {
  fetchMessages,
};
