<?php

namespace ccxt;

// PLEASE DO NOT EDIT THIS FILE, IT IS GENERATED AND WILL BE OVERWRITTEN:
// https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md#how-to-contribute-code

use Exception as Exception; // a common import

class bishino extends Exchange {

    public function describe () {
        return array_replace_recursive (parent::describe (), array (
            'id' => 'bishino',
            'name' => 'Bishino',
            'countries' => array ( 'SC' ),
            'version' => 'v1',
            'has' => array (
                'CORS' => false,
                'publicAPI' => true,
                'fetchTickers' => true,
            ),
            'timeframes' => array (
                '5m' => '5min',
            ),
            'urls' => array (
                'logo' => 'https://bishino.com/img/wolf.png',
                'api' => 'https://api.bishino.com',
                'www' => 'https://www.bishino.com',
                'doc' => array (
                    'https://docs.bishino.com',
                ),
                'fees' => 'https://bishinosupport.zendesk.com/hc/en-us/articles/360004987079-Fee-structure',
                'referral' => 'https://www.bibox.com/signPage?id=11114745&lang=en',
            ),
            'api' => array (
                'public' => array (
                    'get' => array (
                        'assets',
                    ),
                ),
                'private' => array (
                    'post' => array (
                    ),
                ),
            ),
            'fees' => array (
                'trading' => array (
                    'tierBased' => false,
                    'percentage' => true,
                    'taker' => 0.0075,
                    'maker' => 0.000,
                ),
                'funding' => array (
                    'tierBased' => false,
                    'percentage' => false,
                    'withdraw' => array (),
                    'deposit' => array (),
                ),
            ),
            'exceptions' => array (
                '2021' => '\\ccxt\\InsufficientFunds', // Insufficient balance available for withdrawal
                '2015' => '\\ccxt\\AuthenticationError', // Google authenticator is wrong
                '2027' => '\\ccxt\\InsufficientFunds', // Insufficient balance available (for trade)
                '2033' => '\\ccxt\\OrderNotFound', // operation failed! Orders have been completed or revoked
                '2067' => '\\ccxt\\InvalidOrder', // Does not support market orders
                '2068' => '\\ccxt\\InvalidOrder', // The number of orders can not be less than
                '2085' => '\\ccxt\\InvalidOrder', // Order quantity is too small
                '3012' => '\\ccxt\\AuthenticationError', // invalid apiKey
                '3024' => '\\ccxt\\PermissionDenied', // wrong apikey permissions
                '3025' => '\\ccxt\\AuthenticationError', // signature failed
                '4000' => '\\ccxt\\ExchangeNotAvailable', // current network is unstable
                '4003' => '\\ccxt\\DDoSProtection', // server busy please try again later
            ),
            'commonCurrencies' => array (
                'KEY' => 'Bihu',
                'PAI' => 'PCHAIN',
            ),
        ));
    }

    public function fetch_markets ($params = array ()) {
        $response = $this->publicGetAssets (array_merge (array (), $params));
        $markets = $response['result'];
        var_dump ($markets);
        return $markets;
    }
}
