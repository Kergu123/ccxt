'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, InvalidOrder } = require ('./base/errors');
const { ROUND } = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class bishino extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bishino',
            'name': 'Bishino',
            'countries': [ 'SC' ],
            'rateLimit': 500,
            'version': 'v1',
            'has': {
                'fetchDepositAddress': true,
                'CORS': false,
                'cancelOrder': true,
                'createOrder': true,
                'fetchBidsAsks': true,
                'fetchTicker': true,
                'fetchOHLCV': true,
                'fetchTrades': true,
                'fetchMyTrades': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchOpenOrders': true,
                'fetchBalance': true,
                'fetchClosedOrders': true,
                'withdraw': true,
                'fetchFundingFees': true,
                'fetchDeposits': true,
                'fetchWithdrawals': true,
                'fetchTransactions': false,
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
                        'assets',
                    ],
                },
                'private': {
                    'get': [
                        'offer_by_id',
                        'offers_by_account',
                        'active_offers_by_account',
                        'completed_offers_by_account',
                        'trades_by_account',
                        'deposits',
                        'withdrawals',
                        'account_info',
                    ],
                    'post': [
                        'auth/withdraw',
                        'auth/limit',
                        'auth/market',
                        'auth/limit_trigger',
                        'auth/market_trigger',
                        'auth/stop',
                        'auth/icebergs',
                        'auth/cancel',
                    ],
                },
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
            'options': {
                'recvWindow': 5 * 1000,
                'timeDifference': 0,
                'adjustForTimeDifference': false,
            },
            'exceptions': {
                '401': ExchangeError,
                '500': ExchangeError,
            },
            'commonCurrencies': {},
        });
    }

    nonce () {
        return this.milliseconds () - this.options['timeDifference'];
    }

    async loadTimeDifference () {
        const response = await this.publicGetTime ();
        const after = this.milliseconds ();
        this.options['timeDifference'] = parseInt (after - response['result']);
        return this.options['timeDifference'];
    }

    async fetchMarkets (params = {}) {
        let response = await this.publicGetPairs (this.extend ({}, params));
        if (this.options['adjustForTimeDifference'])
            await this.loadTimeDifference ();
        let markets = response['result'];
        let result = [];
        let pairs = Object.keys (markets);
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
            }
            if ('LOT_SIZE' in filters) {
                let filter = filters['LOT_SIZE'];
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
        const market = this.market (symbol);
        let id = market['id'];
        let response = await this.publicGetTicker (this.extend ({}, params));
        let ticker = response['result'][id];
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
            'vwap': undefined,
            'previousClose': undefined,
            'average': undefined,
            'info': ticker,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'pair': market['id'].replace ('/', '_'),
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
            parseFloat (ohlcv['open']),
            parseFloat (ohlcv['high']),
            parseFloat (ohlcv['low']),
            parseFloat (ohlcv['close']),
            parseFloat (ohlcv['base_volume']),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '5m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'pair': market['id'],
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
        let timestamp = this.safeInteger (trade, 'time');
        let price = this.safeFloat (trade, 'price');
        let amount = this.safeFloat (trade, 'qty');
        let id = this.safeString (trade, 'id');
        let symbol = this.safeString (trade, 'pair').replace ('_', '/');
        let fee = {
            'cost': this.safeFloat (trade, 'net_commission'),
            'currency': this.commonCurrencyCode (trade['net_commission_asset']),
        };
        return {
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'id': id,
            'fee': fee,
            'price': price,
            'amount': amount,
            'cost': price * amount,
        };
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetAccountInfo (params);
        let result = { 'info': response['result'] };
        let balances = response['result']['balances'];
        let assets = Object.keys (balances);
        for (let i = 0; i < assets.length; i++) {
            let currency = assets[i];
            let balance = balances[currency];
            let account = {
                'free': parseFloat (balance['free']),
                'used': parseFloat (balance['locked']),
                'total': 0.0,
            };
            account['total'] = this.sum (account['free'], account['used']);
            result[currency] = account;
        }
        return this.parseBalance (result);
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {
            'pair': market['id'],
        };
        if (since !== undefined) {
            request['start'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        let response = await this.publicGetTrades (this.extend (request, params));
        return this.parseTrades (response['result'], market['symbol'], since, limit);
    }

    parseStatus (status) {
        let statuses = {
            'ACTIVE': 'open',
            'COMPLETED': 'closed',
            'CANCELLED': 'canceled',
            'REJECTED': 'rejected',
            'PENDING': 'open',
        };
        return (status in statuses) ? statuses[status] : status;
    }

    parseOrder (order, market = undefined) {
        let status = this.parseStatus (this.safeString (order, 'status'));
        let symbol = this.safeString (order, 'pair').replace ('_', '/');
        let timestamp = order['time'];
        let price = this.safeFloat (order, 'price');
        let amount = this.safeFloat (order, 'qty_orig');
        let remaining = this.safeFloat (order, 'qty_remaining');
        let filled = amount - remaining;
        let cost = price * amount;
        let id = this.safeString (order, 'id');
        let type = this.safeString (order, 'type').toLowerCase ();
        let side = this.safeString (order, 'side').toLowerCase ();
        let fills = this.safeValue (order, 'fills');
        let trades = this.parseTrades (fills || [], market);
        let average = price;
        if (trades && trades.length > 0) {
            let sum = 0;
            for (let i = 0; i < trades.length; i++) {
                let trade = trades[i];
                sum += trade['price'];
            }
            average = sum / trades.length;
        }
        price = average;
        let result = {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
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
            'trades': trades,
        };
        return result;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let request = {
            'id': id,
        };
        let response = await this.privateGetOfferById (this.extend (request, params));
        return this.parseOrder (response['result']);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {};
        if (since !== undefined) {
            request['start'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        let response = await this.privateGetOffersByAccount (this.extend (request, params));
        return this.parseOrders (response['result'], market, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
        }
        let request = {};
        if (since !== undefined) {
            request['start'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        let response = await this.privateGetActiveOffersByAccount (this.extend (request, params));
        return this.parseOrders (response['result'], market, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {};
        if (since !== undefined) {
            request['start'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        let response = await this.privateGetCompletedOffersByAccount (this.extend (request, params));
        return this.parseOrders (response['result'], market, since, limit);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let request = {};
        if (limit !== undefined)
            request['limit'] = limit;
        if (since !== undefined)
            request['start'] = since;
        let response = await this.privateGetTradesByAccount (this.extend (request, params));
        return this.parseTrades (response['result'], market, since, limit);
    }

    async fetchDeposits (code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        let response = await this.privateGetDeposits (this.extend (request, params));
        return this.parseTransactions (response['result'], undefined, since, limit);
    }

    async fetchWithdrawals (code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        let response = await this.privateGetWithdrawals (this.extend (request, params));
        return this.parseTransactions (response['result'], undefined, since, limit);
    }

    async fetchFundingFees (codes = undefined, params = {}) {
        let response = await this.publicGetAssets ();
        let detail = this.safeValue (response, 'result');
        let ids = Object.keys (detail);
        let depositFees = {};
        let withdrawFees = {};
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i];
            let code = this.commonCurrencyCode (id);
            let asset = this.safeValue (detail, id);
            let fees = this.safeValue (asset, 'fees');
            withdrawFees[code] = this.safeFloat (fees, 'withdrawal');
            depositFees[code] = this.safeFloat (fees, 'deposit');
        }
        return {
            'withdraw': withdrawFees,
            'deposit': depositFees,
            'info': detail,
        };
    }

    async withdraw (code, amount, address, tag = undefined, params = {}) {
        this.checkAddress (address);
        await this.loadMarkets ();
        let request = {
            'asset': code,
            'address': address,
            'qty': parseFloat (amount),
        };
        let response = await this.privatePostAuthWithdraw (this.extend (request, params));
        return {
            'info': response['result'],
            'id': this.safeString (response['result'], 'id'),
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let test = this.safeValue (params, 'test', false);
        let stopPrice = this.safeFloat (params, 'stopPrice');
        let icebergs = this.safeFloat (params, 'icebergs');
        let uppercaseType = type.toUpperCase ();
        let priceIsRequired = false;
        let triggerPriceIsRequired = false;
        let icebergsIsRequired = false;
        let method = 'privatePostAuthLimit';
        let order = {
            'pair': market['id'],
            'qty': this.amountToPrecision (symbol, amount),
            'side': side.toUpperCase (),
        };
        if (test !== undefined) {
            order['is_test'] = test;
        }
        if (uppercaseType === 'LIMIT') {
            order['price'] = price;
            priceIsRequired = true;
        } else if (uppercaseType === 'MARKET') {
            method = 'privatePostAuthMarket';
        } else if (uppercaseType === 'STOP_LOSS') {
            order['trigger_price'] = stopPrice;
            method = 'privatePostAuthMarketTrigger';
            triggerPriceIsRequired = true;
        } else if (uppercaseType === 'STOP_LOSS_LIMIT') {
            order['trigger_price'] = stopPrice;
            order['price'] = price;
            method = 'privatePostAuthLimitTrigger';
            triggerPriceIsRequired = true;
            priceIsRequired = true;
        } else if (uppercaseType === 'TAKE_PROFIT') {
            order['trigger_price'] = stopPrice;
            method = 'privatePostAuthMarketTrigger';
            triggerPriceIsRequired = true;
        } else if (uppercaseType === 'TAKE_PROFIT_LIMIT') {
            order['trigger_price'] = stopPrice;
            order['price'] = price;
            method = 'privatePostAuthLimitTrigger';
            triggerPriceIsRequired = true;
            priceIsRequired = true;
        } else if (uppercaseType === 'TRIGGER') {
            order['trigger_price'] = stopPrice;
            order['price'] = price;
            method = 'privatePostAuthStop';
            triggerPriceIsRequired = true;
            priceIsRequired = true;
        } else if (uppercaseType === 'ICEBERG') {
            order['icebergs'] = icebergs;
            order['price'] = price;
            method = 'privatePostAuthIceberg';
            priceIsRequired = true;
            icebergsIsRequired = true;
        }
        if (priceIsRequired && price === undefined) {
            throw new InvalidOrder ('createOrder method requires a price argument for a ' + type + ' order');
        }
        if (triggerPriceIsRequired && stopPrice === undefined) {
            throw new InvalidOrder ('createOrder method requires a trigger_price as an extra param for a ' + type + ' order');
        }
        if (icebergsIsRequired && icebergs === undefined) {
            throw new InvalidOrder ('createOrder method requires a icebergs as an extra param for a ' + type + ' order');
        }
        let response = await this[method] (this.extend (order, params));
        return this.parseOrder (response['result'], market);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        let response = await this.privatePostAuthCancel (this.extend ({
            'id': id,
        }, params));
        return this.parseOrder (response['result']);
    }

    parseTransaction (transaction, currency = undefined) {
        let id = this.safeString (transaction, 'id');
        let address = this.safeString (transaction, 'address');
        let tx = this.safeValue (transaction, 'transaction');
        let txHash = this.safeString (tx, 'hash');
        let timestamp = this.safeInteger (transaction, 'time');
        let currencyId = this.safeString (transaction, 'asset');
        let type = id.indexOf (currencyId) !== -1 ? 'deposit' : 'withdrawal';
        let status = this.parseStatus (this.safeString (transaction, 'status'));
        let amount = this.safeFloat (transaction, 'net');
        let gross = this.safeFloat (transaction, 'qty');
        let code = this.commonCurrencyCode (currencyId);
        let fee = {
            'cost': gross - amount,
            'currency': code,
        };
        return {
            'info': transaction,
            'id': id,
            'txid': txHash,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'address': address,
            'type': type,
            'amount': amount,
            'currency': code,
            'status': status,
            'fee': fee,
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + path;
        if (method === 'GET' && Object.keys (params).length)
            url += '?' + this.urlencode (params);
        headers = { 'Content-Type': 'application/json' };
        if (api === 'private') {
            this.checkRequiredCredentials ();
            let query = this.urlencode (this.extend ({
                'timestamp': this.nonce (),
                'recv_window': this.options['recvWindow'],
            }, params));
            let signature = this.hmac (query, this.secret, 'sha256', 'base64');
            headers = {
                'x-api-key': this.apiKey,
                'x-signature': signature,
            };
            body = this.encode (query);
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
