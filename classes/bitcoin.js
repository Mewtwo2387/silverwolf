const axios = require('axios');
const { logError } = require('../utils/log');

class Bitcoin {
  constructor() {
    this.bitcoinPriceUrl = 'https://api.coindesk.com/v1/bpi/currentprice.json';
  }

  async getData() {
    try {
      const response = await axios.get(this.bitcoinPriceUrl);
      return response.data;
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
