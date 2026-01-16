const { log } = require('./log');

const MAX_FETCH_COUNT = 100;

async function fetchMessagesByCount(channel, countLimit, excludeNewest = true) {
  const messages = [];
  let lastId;
  let remaining = countLimit + (excludeNewest ? 1 : 0);

  while (remaining > 0) {
    const fetchLimit = Math.min(remaining, MAX_FETCH_COUNT);
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
  return messages.reverse().slice(excludeNewest ? 1 : 0);
}

async function fetchMessagesByTime(channel, timeLimit, maxMessages = 1000, excludeNewest = true) {
  const messages = [];
  let lastId;

  while (messages.length < maxMessages) {
    const options = { limit: Math.min(maxMessages - messages.length, MAX_FETCH_COUNT) };
    if (lastId) {
      options.before = lastId;
    }

    let fetchedMessages = await channel.messages.fetch(options);
    if (fetchedMessages.size === 0) {
      log(`No more messages to fetch. Total messages: ${messages.length}`);
      break;
    }

    if (fetchedMessages.last().createdTimestamp >= timeLimit) {
      messages.push(...fetchedMessages);
      lastId = fetchedMessages.last().id;
      log(`Fetched ${fetchedMessages.size} messages with more to go. Total messages: ${messages.length}`);
    } else {
      fetchedMessages = fetchedMessages.filter((message) => message.createdTimestamp >= timeLimit);
      messages.push(...fetchedMessages);
      log(`Fetched ${fetchedMessages.size} messages, reached required time limit. Total messages: ${messages.length}`);
      break;
    }
  }
  return messages.reverse().slice(excludeNewest ? 1 : 0);
}

module.exports = {
  fetchMessagesByCount,
  fetchMessagesByTime,
};
