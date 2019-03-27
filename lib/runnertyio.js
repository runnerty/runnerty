'use strict';
const http = require('request-promise-native');
const logger = require('./logger.js');

class Runnertyio {
  constructor() {
    let _this = this;
    _this.haveAccess = false;
    _this.endpoints = {
      chain: 'http://localhost:8080/api/chainlog',
      process: 'http://localhost:8080/api/processlog',
      access: 'http://localhost:8080/api/checkaccess'
    };
    _this._values = {
      headers: { 'User-Agent': 'runnerty', 'Content-Type': 'application/json' },
      method: 'POST',
      uri: '',
      json: true,
      auth: {
        bearer: ''
      },
      body: {}
    };

    return new Promise(async resolve => {
      if (
        global.config.general.hasOwnProperty('history') &&
        global.config.general.history.hasOwnProperty('runnerty.io') &&
        global.config.general.history['runnerty.io'].hasOwnProperty('apikey') &&
        !global.config.general.history['runnerty.io'].disable
      ) {
        await _this.checkAccess();
      }

      resolve(_this);
    });
  }

  checkAccess() {
    return new Promise(resolve => {
      let valuesSend = this._values;
      valuesSend.auth.bearer =
        global.config.general.history['runnerty.io']['apikey'];
      valuesSend.uri = this.endpoints.access;

      http(valuesSend)
        .then(_ => {
          logger.log('info', 'Successful access to runnerty.io');
          this.haveAccess = true;
          resolve();
        })
        .catch(err => {
          logger.log(
            'error',
            'Failure access to runnerty.io. The following access attempts will be ignored.\n',
            err.message
          );
          this.haveAccess = false;
          resolve();
        });
    });
  }

  send(type, values) {
    return new Promise((resolve, reject) => {
      if (this.haveAccess) {
        if (!this.endpoints[type]) {
          reject(`runnerty.io connector. type ${type} is not valid.`);
        }

        if (!values.hasOwnProperty('id') || !values.hasOwnProperty('event')) {
          reject(`runnerty.io connector. Message not cotains id or event.`);
        }

        let valuesSend = this._values;
        valuesSend.body = values;
        valuesSend.uri = this.endpoints[type];

        http(valuesSend)
          .then(_ => {
            resolve();
          })
          .catch(err => {
            reject(err);
          });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Runnertyio;
