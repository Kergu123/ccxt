const ccxt = require('./ccxt');
const bishino = require('./js/bishino');
const exchange = new ccxt.bishino ({
    'rateLimit': 10000,
    'options': {
        'adjustForTimeDifference': true,
    },
    'apiKey': '8c84bbdbbab291bb12693d2c48ae3f2ad0ae61a09a0933d2',
    'secret': 'bf189c1bbcf3ef043669fb063e3bb0e8964da3021572bfdb',
});

(async () => {
  var loaded = await exchange.load_markets();
  //console.log(exchange.markets)
  var book = await exchange.fetch_open_orders();
  //console.log(book[book.length-1]);
  //var cancelled = await exchange.cancel_order('dfcbb0906c5c11e98cba87a2f88553f8');
  //console.log(cancelled);
  var order_placed = await exchange.createOrder('LOOM/ETH', 'limit', 'sell', 0.1, 0.95);
  console.log(order_placed);
  //var placed = await exchange.withdraw('DASH', 0.1, 'ycUhfo88KyCakGfHWu94f1kSTW1QVtJyfU');
})();
