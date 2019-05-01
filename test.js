const ccxt = require('./ccxt');
const bishino = require('./js/bishino');
const exchange = new bishino ({
    'rateLimit': 10000,
    'options': {
        'adjustForTimeDifference': true,
    },
    'apiKey': '8c84bbdbbab291bb12693d2c48ae3f2ad0ae61a09a0933d2',
    'secret': 'bf189c1bbcf3ef043669fb063e3bb0e8964da3021572bfdb',
});

(async () => {
  var loaded = await exchange.load_markets();
  var book = await exchange.fetch_order('3dd058b06b7911e98ffe4d225417685b');
  console.log(book);
})();
