const { log } = require('./log');

const MAX_FETCH_COUNT = 100;

async function fetchMessagesByCount(channel, countLimit) {
  const messages = [];
  let lastId;
  let remaining = countLimit;

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
  return messages.reverse();
}

async function fetchMessagesByTime(channel, timeLimit) {
  const messages = [];
  let lastId;

  while (true) {
    const options = { limit: MAX_FETCH_COUNT };
    if (lastId) {
      options.before = lastId;
    }

    let fetchedMessages = await channel.messages.fetch(options);
    if (fetchedMessages.size === 0) {
      log(`No more messages to fetch. Total messages: ${messages.length}`);
      break;
    }

    if (fetchedMessages.last()[1].createdAt >= timeLimit) {
      messages.push(...fetchedMessages);
      lastId = fetchedMessages.last().id;
      log(`Fetched ${fetchedMessages.size} messages with more to go. Total messages: ${messages.length}`);
    } else {
      fetchedMessages = fetchedMessages.filter((message) => message[1].createdAt >= timeLimit);
      messages.push(...fetchedMessages);
      log(`Fetched ${fetchedMessages.size} messages, reached required time limit. Total messages: ${messages.length}`);
      break;
    }
  }
  return messages.reverse();
}

module.exports = {
  fetchMessagesByCount,
  fetchMessagesByTime,
};
