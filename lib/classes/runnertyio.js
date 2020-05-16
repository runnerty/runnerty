'use strict';
const http = require('axios');
const logger = require('../logger.js');
const version = require('../../package.json').version;
const url = require('url');

class Runnertyio {
  constructor() {}
  static init(config) {
    this.apikey = config.apikey;
    this.healthChecker = config.healthChecker || false;
    this.disable = config.disable || false;
    this.debug = config.debug || false;
    this.haveAccess = false;
    this.host = config.host;
    this.endpoints = {
      chain: url.resolve(config.host, '/api/chainlog'),
      process: url.resolve(config.host, '/api/processlog'),
      access: url.resolve(config.host, '/api/checkaccess'),
      health: url.resolve(config.host, '/api/health'),
      dead: url.resolve(config.host, '/api/dead')
    };
    this._values = {
      headers: {
        Authorization: 'Bearer ',
        'User-Agent': 'runnerty',
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      data: {}
    };
    this.healthCheckerRecursiveTimeout = 1000 * 60 * 5; // 5 minutes
    this.healthCheckerResponseTimeout = 1000 * 20; // 20 seconds
  }

  static async checkAccess() {
    const valuesSend = this._values;
    valuesSend.headers.Authorization = valuesSend.headers.Authorization + this.apikey;
    valuesSend.url = this.endpoints.access;
    valuesSend.data.version = version;
    try {
      await http(valuesSend);
      this.haveAccess = true;
      logger.log('info', 'Successful access to runnerty.io');
      if (this.healthChecker) this.healthCheckerRecursive();
    } catch (err) {
      logger.log(
        'error',
        `Failure access to runnerty.io. The following access attempts will be ignored.\n${err.message}\n${valuesSend.url}`
      );
      this.haveAccess = false;
    }
  }

  static async send(type, values, timeout) {
    if (this.haveAccess) {
      if (!this.endpoints[type]) {
        throw new Error(`runnerty.io connector. type ${type} is not valid.`);
      }

      if (type !== 'dead') {
        if (!values.hasOwnProperty('id') || !values.hasOwnProperty('event')) {
          throw new Error('runnerty.io connector. Message not cotains id or event.');
        }
      }

      const valuesSend = this._values;
      valuesSend.data = values || {};
      valuesSend.url = this.endpoints[type];
      if (timeout) valuesSend.timeout = timeout;

      if (this.debug) {
        logger.log('info', `DEBUG-runnerty.io [send]. type:${type} \nvalues:${JSON.stringify(valuesSend)}`);
      }

      try {
        await http(valuesSend);
        if (this.debug) {
          logger.log('info', 'DEBUG-runnerty.io [send]. HTTP-OK');
        }
      } catch (err) {
        if (this.debug) {
          logger.log('info', `DEBUG-runnerty.io [send]. HTTP-ERROR ${err}`);
        }
      }
    } else {
      if (this.debug) {
        logger.log('info', 'DEBUG-runnerty.io [send]. No access.');
      }
    }
  }

  static async healthCheck() {
    if (this.haveAccess) {
      const valuesSend = this._values;
      valuesSend.url = this.endpoints.health;
      valuesSend.timeout = this.healthCheckerResponseTimeout;
      try {
        await http(valuesSend);
      } catch (err) {
        throw err;
      }
    } else {
      throw new Error('There is no access to runnerty.io.');
    }
  }

  static healthCheckerRecursive() {
    this.healthCheck().catch(err => {
      logger.log('error', `Failure health check to runnerty.io.\n${err.message}`);
    });
    setTimeout(() => {
      this.healthCheckerRecursive();
    }, this.healthCheckerRecursiveTimeout);
  }
}

module.exports = Runnertyio;
