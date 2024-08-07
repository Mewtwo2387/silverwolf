const axios = require('axios');

class Bitcoin{
    constructor(){
        this.bitcoinPriceUrl = 'https://api.coindesk.com/v1/bpi/currentprice.json';
    }

    async getData(){
        try{
            const response = await axios.get(this.bitcoinPriceUrl);
            return response.data;
        }catch(err){
            console.error('Error fetching Bitcoin price:', err);
            return null;
        }
    }

    async getPrice(){
        const data = await this.getData();
        return data.bpi.USD.rate_float;
    }
}

module.exports = { Bitcoin };