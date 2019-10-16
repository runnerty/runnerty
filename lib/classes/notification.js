'use strict';

const utils = require('../utils.js');
const replaceWithSmart = utils.replaceWithSmart;
const checkNotifierParams = utils.checkNotifierParams;
const logger = require('../logger.js');
const qnm = require('../queue-notifications-memory.js');
const qnr = require('../queue-notifications-redis.js');
const crypto = require('crypto');

class Notification {
  constructor(notification) {
    let _this = this;
    const properties = Object.keys(notification);
    let propertiesLength = properties.length;

    while (propertiesLength--) {
      _this[properties[propertiesLength]] =
        notification[properties[propertiesLength]];
    }

    return new Promise((resolve, reject) => {
      const configValues = notification.config;
      if (!_this.type && configValues.type) {
        _this.type = configValues.type;
      }
      _this.config = configValues;

      _this.setUid().then(() => {
        checkNotifierParams(_this)
          .then(() => {
            resolve(_this);
          })
          .catch(err => {
            reject(err);
          });
      });
    });
  }

  async notificate(values) {
    let _this = this;
    await _this.getValues(values).then(async res => {
      await _this.queue(_this.channel, res);
    }).catch(err => {
      logger.log(
        'error',
        `Notificate ${err}`
      );
    });
  }

  sendMain(notification) {
    let _this = this;
    return new Promise((resolve, reject) => {
      _this.resolve = resolve;
      _this.reject = reject;
      _this.send(notification);
    });
  }

  send() {
    logger.log(
      'error',
      'Method send (notification) must be rewrite in child class'
    );
  }

  end(options) {
    let _this = this;

    if (!options) options = {};
    options.end = options.end || 'end';

    switch (options.end) {
      case 'error':
        logger.log('error', options.messageLog);
        _this.reject(options.messageLog || '');
        break;
      default:
        _this.resolve();
        break;
    }
  }

  getValues(values) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let notif = {};
      Object.assign(notif, _this.config);
      Object.assign(notif, _this);
      delete notif.config;
      replaceWithSmart(notif, values)
        .then(res => {
          resolve(res);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  async queue(listName, notifToQueue) {
    let _this = this;
    const list = _this.id + (listName ? '_' + listName : '');
    // QUEUE REDIS;
    if (
      global.config.queueNotificationsExternal &&
      global.config.queueNotificationsExternal === 'redis'
    ) {
      //REDIS QUEUE:
      await qnr.queue(_this, notifToQueue, list);
    } else {
      //MEMORY QUEUE:
      await qnm.queue(_this, notifToQueue, list);
    }
  }

  setUid() {
    let _this = this;
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          _this.uId = _this.id + '_' + buffer.toString('hex');
          resolve();
        }
      });
    });
  }

  logger(type, menssage) {
    logger.log(type, menssage);
  }

  replaceWith(object, values) {
    return replaceWithSmart(object, values);
  }
}

module.exports = Notification;