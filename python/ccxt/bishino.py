# -*- coding: utf-8 -*-

# PLEASE DO NOT EDIT THIS FILE, IT IS GENERATED AND WILL BE OVERWRITTEN:
# https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md#how-to-contribute-code

from ccxt.base.exchange import Exchange
import hashlib
import math
from ccxt.base.errors import ExchangeError
from ccxt.base.errors import InvalidOrder
from ccxt.base.decimal_to_precision import ROUND


class bishino (Exchange):

    def describe(self):
        return self.deep_extend(super(bishino, self).describe(), {
            'id': 'bishino',
            'name': 'Bishino',
            'countries': ['SC'],
            'rateLimit': 500,
            'version': 'v1',
            'has': {
                'fetchDepositAddress': True,
                'CORS': False,
                'cancelOrder': True,
                'createOrder': True,
                'fetchBidsAsks': True,
                'fetchTicker': True,
                'fetchOHLCV': True,
                'fetchTrades': True,
                'fetchMyTrades': True,
                'fetchOrder': True,
                'fetchOrders': True,
                'fetchOpenOrders': True,
                'fetchBalance': True,
                'fetchClosedOrders': True,
                'withdraw': True,
                'fetchFundingFees': True,
                'fetchDeposits': True,
                'fetchWithdrawals': True,
                'fetchTransactions': False,
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
                    'tierBased': False,
                    'percentage': True,
                    'taker': 0.0075,
                    'maker': 0.000,
                },
                'funding': {
                    'tierBased': False,
                    'percentage': False,
                    'withdraw': {},
                    'deposit': {},
                },
            },
            'options': {
                'recvWindow': 5 * 1000,
                'timeDifference': 0,
                'adjustForTimeDifference': False,
            },
            'exceptions': {
                '401': ExchangeError,
                '500': ExchangeError,
            },
            'commonCurrencies': {},
        })

    def nonce(self):
        return self.milliseconds() - self.options['timeDifference']

    def load_time_difference(self):
        response = self.publicGetTime()
        after = self.milliseconds()
        self.options['timeDifference'] = int(after - response['result'])
        return self.options['timeDifference']

    def fetch_markets(self, params={}):
        response = self.publicGetPairs(self.extend({}, params))
        if self.options['adjustForTimeDifference']:
            self.load_time_difference()
        markets = response['result']
        result = []
        pairs = list(markets.keys())
        for i in range(0, len(pairs)):
            id = pairs[i]
            market = markets[id]
            base = market['base']
            quote = market['quote']
            baseId = base
            quoteId = quote
            symbol = base + '/' + quote
            filters = self.index_by(market['filters'], 'filter_type')
            precision = {
                'base': market['base_precision'],
                'quote': market['quote_precision'],
                'amount': market['base_precision'],
                'price': market['quote_precision'],
            }
            active = (market['status'] == 'TRADING')
            entry = {
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
                        'min': math.pow(10, -precision['amount']),
                        'max': None,
                    },
                    'price': {
                        'min': None,
                        'max': None,
                    },
                    'cost': {
                        'min': -1 * math.log10(precision['amount']),
                        'max': None,
                    },
                },
            }
            if 'PRICE_FILTER' in filters:
                filter = filters['PRICE_FILTER']
                entry['limits']['price'] = {
                    'min': self.safe_float(filter, 'min_price'),
                    'max': None,
                }
                maxPrice = self.safe_float(filter, 'max_price')
                if (maxPrice is not None) and(maxPrice > 0):
                    entry['limits']['price']['max'] = maxPrice
                entry['precision']['price'] = filter['tick_size']
            if 'LOT_SIZE' in filters:
                filter = filters['LOT_SIZE']
                entry['precision']['amount'] = filter['tick_size']
                entry['limits']['amount'] = {
                    'min': self.safe_float(filter, 'min_qty'),
                    'max': self.safe_float(filter, 'max_qty'),
                }
            result.append(entry)
        return result

    def fetch_ticker(self, symbol, params={}):
        self.load_markets()
        market = self.market(symbol)
        id = market['id']
        response = self.publicGetTicker(self.extend({}, params))
        ticker = response['result'][id]
        return self.parse_ticker(ticker, symbol)

    def parse_ticker(self, ticker, symbol):
        timestamp = self.safe_integer(ticker, 'close_time')
        last = self.safe_float(ticker, 'last_price')
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': self.iso8601(timestamp),
            'high': self.safe_float(ticker, 'high_price'),
            'low': self.safe_float(ticker, 'low_price'),
            'bid': self.safe_float(ticker, 'bid_price'),
            'bidVolume': self.safe_float(ticker, 'bid_qty'),
            'ask': self.safe_float(ticker, 'ask_price'),
            'askVolume': self.safe_float(ticker, 'ask_qty'),
            'open': self.safe_float(ticker, 'open_price'),
            'close': last,
            'last': last,
            'change': self.safe_float(ticker, 'price_change'),
            'percentage': self.safe_float(ticker, 'price_change_percent'),
            'baseVolume': self.safe_float(ticker, 'base_volume'),
            'quoteVolume': self.safe_float(ticker, 'quote_volume'),
            'vwap': None,
            'previousClose': None,
            'average': None,
            'info': ticker,
        }

    def fetch_order_book(self, symbol, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {
            'pair': market['id'].replace('/', '_'),
        }
        if limit is not None:
            request['limit'] = limit
        response = self.publicGetDepth(self.extend(request, params))
        orderbook = self.parse_order_book(response['result'], None, 'bids', 'asks', 'price', 'qty')
        return orderbook

    def parse_ohlcv(self, ohlcv, market=None, timeframe='1m', since=None, limit=None):
        return [
            ohlcv.open_time,
            float(ohlcv['open']),
            float(ohlcv['high']),
            float(ohlcv['low']),
            float(ohlcv['close']),
            float(ohlcv['base_volume']),
        ]

    def fetch_ohlcv(self, symbol, timeframe='5m', since=None, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {
            'pair': market['id'],
        }
        if since is not None:
            request['start'] = since
        if limit is not None:
            request['limit'] = limit
        response = self.publicGetOhlcv(self.extend(request, params))
        return self.parse_ohlcvs(response['result'], market, timeframe, since, limit)

    def parse_trade(self, trade, market=None):
        timestamp = self.safe_integer(trade, 'time')
        price = self.safe_float(trade, 'price')
        amount = self.safe_float(trade, 'qty')
        id = self.safe_string(trade, 'id')
        symbol = self.safe_string(trade, 'pair').replace('_', '/')
        fee = {
            'cost': self.safe_float(trade, 'net_commission'),
            'currency': self.common_currency_code(trade['net_commission_asset']),
        }
        return {
            'info': trade,
            'timestamp': timestamp,
            'datetime': self.iso8601(timestamp),
            'symbol': symbol,
            'id': id,
            'fee': fee,
            'price': price,
            'amount': amount,
            'cost': price * amount,
        }

    def fetch_balance(self, params={}):
        self.load_markets()
        response = self.privateGetAccountInfo(params)
        result = {'info': response['result']}
        balances = response['result']['balances']
        for i in range(0, balances):
            balance = balances[list(balances.keys())[i]]
            currency = balance['asset']
            if currency in self.currencies_by_id:
                currency = self.currencies_by_id[currency]['code']
            account = {
                'free': float(balance['free']),
                'used': float(balance['locked']),
                'total': 0.0,
            }
            account['total'] = self.sum(account['free'], account['used'])
            result[currency] = account
        return self.parse_balance(result)

    def fetch_trades(self, symbol, since=None, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {
            'pair': market['id'],
        }
        if since is not None:
            request['start'] = since
        if limit is not None:
            request['limit'] = limit
        response = self.publicGetTrades(self.extend(request, params))
        return self.parse_trades(response['result'], market['symbol'], since, limit)

    def parse_status(self, status):
        statuses = {
            'ACTIVE': 'open',
            'COMPLETED': 'closed',
            'CANCELLED': 'canceled',
            'REJECTED': 'rejected',
            'PENDING': 'open',
        }
        return statuses[status] if (status in list(statuses.keys())) else status

    def parse_order(self, order, market=None):
        status = self.parse_status(self.safe_string(order, 'status'))
        symbol = self.find_symbol(self.safe_string(order, 'pair'), market)
        timestamp = order['time']
        price = self.safe_float(order, 'price')
        amount = self.safe_float(order, 'qty_orig')
        remaining = self.safe_float(order, 'qty_remaining')
        filled = amount - remaining
        cost = price * amount
        id = self.safe_string(order, 'id')
        type = self.safe_string(order, 'type').lower()
        side = self.safe_string(order, 'side').lower()
        fills = self.safe_value(order, 'fills')
        trades = self.parse_trades(fills or [], market)
        average = price
        if trades and len(trades) > 0:
            sum = 0
            for i in range(0, len(trades)):
                trade = trades[i]
                sum += trade['price']
            average = sum / len(trades)
        price = average
        result = {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': self.iso8601(timestamp),
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
        }
        return result

    def fetch_order(self, id, symbol=None, params={}):
        self.load_markets()
        request = {
            'id': id,
        }
        response = self.privateGetOfferById(self.extend(request, params))
        return self.parse_order(response['result'])

    def fetch_orders(self, symbol=None, since=None, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {}
        if since is not None:
            request['start'] = since
        if limit is not None:
            request['limit'] = limit
        response = self.privateGetOffersByAccount(self.extend(request, params))
        return self.parse_orders(response['result'], market, since, limit)

    def fetch_open_orders(self, symbol=None, since=None, limit=None, params={}):
        self.load_markets()
        market = None
        if symbol is not None:
            market = self.market(symbol)
        request = {}
        if since is not None:
            request['start'] = since
        if limit is not None:
            request['limit'] = limit
        response = self.privateGetActiveOffersByAccount(self.extend(request, params))
        return self.parse_orders(response['result'], market, since, limit)

    def fetch_closed_orders(self, symbol=None, since=None, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {}
        if since is not None:
            request['start'] = since
        if limit is not None:
            request['limit'] = limit
        response = self.privateGetCompletedOffersByAccount(self.extend(request, params))
        return self.parse_orders(response['result'], market, since, limit)

    def fetch_my_trades(self, symbol=None, since=None, limit=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        request = {}
        if limit is not None:
            request['limit'] = limit
        if since is not None:
            request['start'] = since
        response = self.privateGetTradesByAccount(self.extend(request, params))
        return self.parse_trades(response['result'], market, since, limit)

    def fetch_deposits(self, code=None, since=None, limit=None, params={}):
        self.load_markets()
        request = {}
        response = self.privateGetDeposits(self.extend(request, params))
        return self.parseTransactions(response['result'], None, since, limit)

    def fetch_withdrawals(self, code=None, since=None, limit=None, params={}):
        self.load_markets()
        request = {}
        response = self.privateGetWithdrawals(self.extend(request, params))
        return self.parseTransactions(response['result'], None, since, limit)

    def fetch_funding_fees(self, codes=None, params={}):
        response = self.publicGetAssets()
        detail = self.safe_value(response, 'result')
        ids = list(detail.keys())
        depositFees = {}
        withdrawFees = {}
        for i in range(0, len(ids)):
            id = ids[i]
            code = self.common_currency_code(id)
            asset = self.safe_value(detail, id)
            fees = self.safe_value(asset, 'fees')
            withdrawFees[code] = self.safe_float(fees, 'withdrawal')
            depositFees[code] = self.safe_float(fees, 'deposit')
        return {
            'withdraw': withdrawFees,
            'deposit': depositFees,
            'info': detail,
        }

    def withdraw(self, code, amount, address, tag=None, params={}):
        self.check_address(address)
        self.load_markets()
        request = {
            'asset': code,
            'address': address,
            'qty': float(amount),
        }
        response = self.privatePostAuthWithdraw(self.extend(request, params))
        return {
            'info': response['result'],
            'id': self.safe_string(response['result'], 'id'),
        }

    def create_order(self, symbol, type, side, amount, price=None, params={}):
        self.load_markets()
        market = self.market(symbol)
        test = self.safe_value(params, 'test', False)
        stopPrice = self.safe_float(params, 'stopPrice')
        icebergs = self.safe_float(params, 'icebergs')
        uppercaseType = type.upper()
        priceIsRequired = False
        triggerPriceIsRequired = False
        icebergsIsRequired = False
        method = 'privatePostAuthLimit'
        order = {
            'pair': market['id'],
            'qty': self.amount_to_precision(symbol, amount),
            'side': side.upper(),
        }
        if test is not None:
            order['is_test'] = test
        if uppercaseType == 'LIMIT':
            order['price'] = price
            priceIsRequired = True
        elif uppercaseType == 'MARKET':
            method = 'privatePostAuthMarket'
        elif uppercaseType == 'STOP_LOSS':
            order['trigger_price'] = stopPrice
            method = 'privatePostAuthMarketTrigger'
            triggerPriceIsRequired = True
        elif uppercaseType == 'STOP_LOSS_LIMIT':
            order['trigger_price'] = stopPrice
            order['price'] = price
            method = 'privatePostAuthLimitTrigger'
            triggerPriceIsRequired = True
            priceIsRequired = True
        elif uppercaseType == 'TAKE_PROFIT':
            order['trigger_price'] = stopPrice
            method = 'privatePostAuthMarketTrigger'
            triggerPriceIsRequired = True
        elif uppercaseType == 'TAKE_PROFIT_LIMIT':
            order['trigger_price'] = stopPrice
            order['price'] = price
            method = 'privatePostAuthLimitTrigger'
            triggerPriceIsRequired = True
            priceIsRequired = True
        elif uppercaseType == 'TRIGGER':
            order['trigger_price'] = stopPrice
            order['price'] = price
            method = 'privatePostAuthStop'
            triggerPriceIsRequired = True
            priceIsRequired = True
        elif uppercaseType == 'ICEBERG':
            order['icebergs'] = icebergs
            order['price'] = price
            method = 'privatePostAuthIceberg'
            priceIsRequired = True
            icebergsIsRequired = True
        if priceIsRequired and price is None:
            raise InvalidOrder('createOrder method requires a price argument for a ' + type + ' order')
        if triggerPriceIsRequired and stopPrice is None:
            raise InvalidOrder('createOrder method requires a trigger_price as an extra param for a ' + type + ' order')
        if icebergsIsRequired and icebergs is None:
            raise InvalidOrder('createOrder method requires a icebergs as an extra param for a ' + type + ' order')
        response = getattr(self, method)(self.extend(order, params))
        return self.parse_order(response['result'], market)

    def cancel_order(self, id, symbol=None, params={}):
        self.load_markets()
        response = self.privatePostAuthCancel(self.extend({
            'id': id,
        }, params))
        return self.parse_order(response['result'])

    def parse_transaction(self, transaction, currency=None):
        id = self.safe_string(transaction, 'id')
        address = self.safe_string(transaction, 'address')
        tx = self.safe_value(transaction, 'transaction')
        txHash = self.safe_string(tx, 'hash')
        timestamp = self.safe_integer(transaction, 'time')
        currencyId = self.safe_string(transaction, 'asset')
        type = id.find(currencyId) != 'deposit' if -1 else 'withdrawal'
        status = self.parse_status(self.safe_string(transaction, 'status'))
        amount = self.safe_float(transaction, 'net')
        gross = self.safe_float(transaction, 'qty')
        code = self.common_currency_code(currencyId)
        fee = {
            'cost': gross - amount,
            'currency': code,
        }
        return {
            'info': transaction,
            'id': id,
            'txid': txHash,
            'timestamp': timestamp,
            'datetime': self.iso8601(timestamp),
            'address': address,
            'type': type,
            'amount': amount,
            'currency': code,
            'status': status,
            'fee': fee,
        }

    def sign(self, path, api='public', method='GET', params={}, headers=None, body=None):
        url = self.urls['api'] + '/' + path
        if method == 'GET' and params:
            url += '?' + self.urlencode(params)
        headers = {'Content-Type': 'application/json'}
        if api == 'private':
            self.check_required_credentials()
            query = self.urlencode(self.extend({
                'timestamp': self.nonce(),
                'recv_window': self.options['recvWindow'],
            }, params))
            signature = self.hmac(query, self.secret, hashlib.sha256, 'base64')
            headers = {
                'x-api-key': self.apiKey,
                'x-signature': signature,
            }
            body = self.encode(query)
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        return {'url': url, 'method': method, 'body': body, 'headers': headers}

    def calculate_fee(self, symbol, type, side, amount, price, takerOrMaker='taker', params={}):
        market = self.markets[symbol]
        key = 'quote'
        rate = market[takerOrMaker]
        cost = amount * rate
        precision = market['precision']['price']
        if side == 'sell':
            cost *= price
        else:
            key = 'base'
            precision = market['precision']['amount']
        cost = self.decimal_to_precision(cost, ROUND, precision, self.precisionMode)
        return {
            'type': takerOrMaker,
            'currency': market[key],
            'rate': rate,
            'cost': float(cost),
        }
