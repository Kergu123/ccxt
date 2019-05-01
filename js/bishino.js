'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AuthenticationError, DDoSProtection, ExchangeNotAvailable, InvalidOrder, OrderNotFound, PermissionDenied, InsufficientFunds } = require ('./base/errors');

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
                'fetchBidsAsks': true,
                'fetchTickers': true,
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
                    ],
                },
                'private': {
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
        console.log(market);
        let request = {
            'pair': market['id'].replace('/','_'),
        };
        if (limit !== undefined)
            request['limit'] = limit;
        let response = await this.publicGetDepth (this.extend (request, params));
        console.log(response);
        let orderbook = this.parseOrderBook (response);
        return orderbook;
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + path;
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
