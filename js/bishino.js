'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ArgumentsRequired, AuthenticationError, DDoSProtection, ExchangeNotAvailable, InvalidOrder, OrderNotFound, PermissionDenied, InsufficientFunds } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bishino extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bishino',
            'name': 'Bishino',
            'countries': [ 'SC' ],
            'version': 'v1',
            'has': {
                'CORS': false,
                'publicAPI': true,
                'fetchTickers': true,
                'fetchOHLCV': true,
            },
            'timeframes': {
                '5m': '5min',
            },
            'urls': {
                'logo': 'https://bishino.com/img/wolf.png',
                'api': 'https://api.bishino.com',
                'www': 'https://www.bishino.com',
                'doc': [
                    'https://docs.bishino.com',
                ],
                'fees': 'https://bishinosupport.zendesk.com/hc/en-us/articles/360004987079-Fee-structure',
                'referral': 'https://www.bibox.com/signPage?id=11114745&lang=en',
            },
            'api': {
                'public': {
                    'get': [
                        'ping',
                        'time',
                        'pairs',
                        'ticker',
                        'depth',
                        'ohlcv',
                        'trades',
                    ],
                },
                'private': {
                    'get': [
                      'offer_by_id',
                    ],
                    'post': [
                    ],
                },
            },
            'options': {
              'recvWindow': 5 * 1000,
              'timeDifference': 0,
              'adjustForTimeDifference': false
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'taker': 0.0075,
                    'maker': 0.000,
                },
                'funding': {
                    'tierBased': false,
                    'percentage': false,
                    'withdraw': {},
                    'deposit': {},
                },
            },
            'exceptions': {
                '2021': InsufficientFunds, // Insufficient balance available for withdrawal
                '2015': AuthenticationError, // Google authenticator is wrong
                '2027': InsufficientFunds, // Insufficient balance available (for trade)
                '2033': OrderNotFound, // operation failed! Orders have been completed or revoked
                '2067': InvalidOrder, // Does not support market orders
                '2068': InvalidOrder, // The number of orders can not be less than
                '2085': InvalidOrder, // Order quantity is too small
                '3012': AuthenticationError, // invalid apiKey
                '3024': PermissionDenied, // wrong apikey permissions
                '3025': AuthenticationError, // signature failed
                '4000': ExchangeNotAvailable, // current network is unstable
                '4003': DDoSProtection, // server busy please try again later
            },
            'commonCurrencies': {
                'KEY': 'Bihu',
                'PAI': 'PCHAIN',
            },
        });
    }

    nonce () {
        return this.milliseconds () - this.options['timeDifference'];
    }

    async loadTimeDifference () {
        const response = await this.publicGetTime ();
        const after = this.milliseconds ();
        this.options['timeDifference'] = parseInt (after - response['time']);
        return this.options['timeDifference'];
    }

    async fetchMarkets (params = {}) {
        let response = await this.publicGetPairs (this.extend ({}, params));
        if (this.options['adjustForTimeDifference'])
            await this.loadTimeDifference ();
        let markets = response['result'];
        let result = [];
        let pairs = Object.keys(markets);
        for (let i = 0; i < pairs.length; i++) {
            let id = pairs[i];
            let market = markets[id];
            let base = market['base'];
            let quote = market['quote'];
            let baseId = base;
            let quoteId = quote;
            let symbol = base + '/' + quote;
            let filters = this.indexBy (market['filters'], 'filter_type');
            let precision = {
                'base': market['base_precision'],
                'quote': market['quote_precision'],
                'amount': market['base_precision'],
                'price': market['quote_precision'],
            };
            let active = (market['status'] === 'TRADING');
            let entry = {
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'info': market,
                'active': active,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': Math.pow (10, -precision['amount']),
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': -1 * Math.log10 (precision['amount']),
                        'max': undefined,
                    },
                },
            };
            if ('PRICE_FILTER' in filters) {
                let filter = filters['PRICE_FILTER'];
                entry['limits']['price'] = {
                    'min': this.safeFloat (filter, 'min_price'),
                    'max': undefined,
                };
                const maxPrice = this.safeFloat (filter, 'max_price');
                if ((maxPrice !== undefined) && (maxPrice > 0)) {
                    entry['limits']['price']['max'] = maxPrice;
                }
                entry['precision']['price'] = filter['tick_size'];
            }
            if ('LOT_SIZE' in filters) {
                let filter = filters['LOT_SIZE'];
                entry['precision']['amount'] = filter['tick_size'];
                entry['limits']['amount'] = {
                    'min': this.safeFloat (filter, 'min_qty'),
                    'max': this.safeFloat (filter, 'max_qty'),
                };
            }
            result.push (entry);
        }
        return result;
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        let response = await this.publicGetTicker (this.extend ({}, params));
        let ticker = response['result'][symbol.replace('/','_')];
        return this.parseTicker (ticker, symbol);
    }

    parseTicker (ticker, symbol) {
        let timestamp = this.safeInteger (ticker, 'close_time');
        let last = this.safeFloat (ticker, 'last_price');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high_price'),
            'low': this.safeFloat (ticker, 'low_price'),
            'bid': this.safeFloat (ticker, 'bid_price'),
            'bidVolume': this.safeFloat (ticker, 'bid_qty'),
            'ask': this.safeFloat (ticker, 'ask_price'),
            'askVolume': this.safeFloat (ticker, 'ask_qty'),
            'open': this.safeFloat (ticker, 'open_price'),
            'close': last,
            'last': last,
            'change': this.safeFloat (ticker, 'price_change'),
            'percentage': this.safeFloat (ticker, 'price_change_percent'),
            'baseVolume': this.safeFloat (ticker, 'base_volume'),
            'quoteVolume': this.safeFloat (ticker, 'quote_volume'),
            'info': ticker,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'pair': market['id'].replace('/','_'),
        };
        if (limit !== undefined)
            request['limit'] = limit;
        let response = await this.publicGetDepth (this.extend (request, params));
        let orderbook = this.parseOrderBook (response['result'], undefined, 'bids', 'asks', 'price', 'qty');
        return orderbook;
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            ohlcv.open_time,
            parseFloat (ohlcv.open),
            parseFloat (ohlcv.high),
            parseFloat (ohlcv.low),
            parseFloat (ohlcv.close),
            parseFloat (ohlcv.base_volume),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '5m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'pair': market['id']
        };
        if (since !== undefined) {
            request['start'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetOhlcv (this.extend (request, params));
        return this.parseOHLCVs (response['result'], market, timeframe, since, limit);
    }

    parseTrade (trade, market = undefined) {
        let timestamp = this.safeInteger (trade,'time');
        let price = this.safeFloat (trade,'price');
        let amount = this.safeFloat (trade, 'qty');
        let id = this.safeString (trade, 'id');
        let symbol = this.safeString (trade, 'pair').replace('_','/');
        return {
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'id': id,
            'price': price,
            'amount': amount,
            'cost': price * amount
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'pair': market['id'],
        };
        if (since !== undefined) {
            request['start'] = since;
            request['end'] = this.sum (since, 86400000);
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        let response = await this.publicGetTrades (this.extend (request, params));
        return this.parseTrades (response['result'], market['symbol'], since, limit);
    }

    parseOrderStatus (status) {
        let statuses = {
            'ACTIVE': 'open',
            'COMPLETED': 'closed',
            'CANCELLED': 'canceled',
            'REJECTED': 'rejected'
        };
        return (status in statuses) ? statuses[status] : status;
    }

    parseOrder (order, market = undefined) {
        let status = this.parseOrderStatus (this.safeString (order, 'status'));
        let symbol = this.findSymbol (this.safeString (order, 'symbol'), market);
        let timestamp = undefined;
        if ('time' in order)
            timestamp = order['time'];
        else if ('transactTime' in order)
            timestamp = order['transactTime'];
        let price = this.safeFloat (order, 'price');
        let amount = this.safeFloat (order, 'origQty');
        let filled = this.safeFloat (order, 'executedQty');
        let remaining = undefined;
        let cost = this.safeFloat (order, 'cummulativeQuoteQty');
        if (filled !== undefined) {
            if (amount !== undefined) {
                remaining = amount - filled;
                if (this.options['parseOrderToPrecision']) {
                    remaining = parseFloat (this.amountToPrecision (symbol, remaining));
                }
                remaining = Math.max (remaining, 0.0);
            }
            if (price !== undefined) {
                if (cost === undefined) {
                    cost = price * filled;
                }
            }
        }
        let id = this.safeString (order, 'orderId');
        let type = this.safeString (order, 'type');
        if (type !== undefined) {
            type = type.toLowerCase ();
            if (type === 'market') {
                if (price === 0.0) {
                    if ((cost !== undefined) && (filled !== undefined)) {
                        if ((cost > 0) && (filled > 0)) {
                            price = cost / filled;
                        }
                    }
                }
            }
        }
        let side = this.safeString (order, 'side');
        if (side !== undefined)
            side = side.toLowerCase ();
        let fee = undefined;
        let trades = undefined;
        const fills = this.safeValue (order, 'fills');
        if (fills !== undefined) {
            trades = this.parseTrades (fills, market);
            let numTrades = trades.length;
            if (numTrades > 0) {
                cost = trades[0]['cost'];
                fee = {
                    'cost': trades[0]['fee']['cost'],
                    'currency': trades[0]['fee']['currency'],
                };
                for (let i = 1; i < trades.length; i++) {
                    cost = this.sum (cost, trades[i]['cost']);
                    fee['cost'] = this.sum (fee['cost'], trades[i]['fee']['cost']);
                }
            }
        }
        let average = undefined;
        if (cost !== undefined) {
            if (filled) {
                average = cost / filled;
            }
            if (this.options['parseOrderToPrecision']) {
                cost = parseFloat (this.costToPrecision (symbol, cost));
            }
        }
        let result = {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'average': average,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
            'trades': trades,
        };
        return result;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {
            'id': id
        };
        let response = await this.privateGetOfferById (this.extend (request, params));
        return this.parseOrder (response);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + path;
        if (Object.keys (params).length)
            url += '?' + this.urlencode (params);
        headers = { 'Content-Type': 'application/json' };
        if (api === 'private') {
          this.checkRequiredCredentials ();
          let query = this.urlencode (this.extend ({
              'timestamp': this.nonce (),
              'recvWindow': this.options['recvWindow'],
          }, params));
          let signature = this.hmac (this.encode (query), this.encode (this.secret));
          headers = {
              'x-api-key': this.apiKey,
              'x-signature': signature,
          };
          body = query;
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    calculateFee (symbol, type, side, amount, price, takerOrMaker = 'taker', params = {}) {
        let market = this.markets[symbol];
        let key = 'quote';
        let rate = market[takerOrMaker];
        let cost = amount * rate;
        let precision = market['precision']['price'];
        if (side === 'sell') {
            cost *= price;
        } else {
            key = 'base';
            precision = market['precision']['amount'];
        }
        cost = this.decimalToPrecision (cost, ROUND, precision, this.precisionMode);
        return {
            'type': takerOrMaker,
            'currency': market[key],
            'rate': rate,
            'cost': parseFloat (cost),
        };
    }
};
