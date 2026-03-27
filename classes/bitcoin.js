const { logError } = require('../utils/log');

class Bitcoin {
  constructor() {
    this.bitcoinPriceUrl = 'https://api.coindesk.com/v1/bpi/currentprice.json';
  }

  async getData() {
    try {
      const response = await fetch(this.bitcoinPriceUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      logError('Error fetching Bitcoin price:', err);
      return null;
    }
  }

  async getPrice() {
    const data = await this.getData();
    if (!data) {
      return null;
    }
    if (!data.bpi) {
      return null;
    }
    if (!data.bpi.USD) {
      return null;
    }
    return data.bpi.USD.rate_float;
  }
}

module.exports = { Bitcoin };
