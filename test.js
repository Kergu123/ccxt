const ccxt = require('./ccxt');
const bishino = require('./js/bishino');
const exchange = new bishino ({
    'rateLimit': 10000,
    'options': {
        'adjustForTimeDifference': true,
    }
});

(async () => {
  var loaded = await exchange.load_markets();
  var book = await exchange.fetch_order_book('BNB/ETH');
  console.log(book);
})();
