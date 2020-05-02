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
    this.config = notification.config;
    const properties = Object.keys(notification);
    let propertiesLength = properties.length;

    while (propertiesLength--) {
      this[properties[propertiesLength]] =
        notification[properties[propertiesLength]];
    }
  }

  async init() {
    try {
      if (!this.type && this.config.type) {
        this.type = this.config.type;
      }
      this.setUid();
      await checkNotifierParams(this);
      return this;
    } catch (err) {
      logger.log('error', `init Notification:`, err);
      throw err;
    }
  }

  async notificate(values) {
    try {
      const _values = await this.getValues(values);
      await this.queue(this.channel, _values);
    } catch (err) {
      logger.log(
        'error',
        `Notificate ${err}`
      );
    }
  }

  sendMain(notification) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.send(notification);
    });
  }

  send() {
    logger.log(
      'error',
      'Method send (notification) must be rewrite in child class'
    );
  }

  end(options) {
    if (!options) options = {};
    options.end = options.end || 'end';

    switch (options.end) {
      case 'error':
        logger.log('error', options.messageLog);
        this.reject(options.messageLog || '');
        break;
      default:
        this.resolve();
        break;
    }
  }

  async getValues(values) {
    let notif = {};
    Object.assign(notif, this.config);
    Object.assign(notif, this);
    delete notif.config;
    try {
      const _values = await replaceWithSmart(notif, values);
      return _values;
    } catch (err) {
      logger.log('error', `getValues Notification: ${err}`);
      throw err;
    }

  }

  async queue(listName, notifToQueue) {
    const list = this.id + (listName ? '_' + listName : '');
    // QUEUE REDIS;
    if (
      global.config.queueNotificationsExternal &&
      global.config.queueNotificationsExternal === 'redis'
    ) {
      //REDIS QUEUE:
      await qnr.queue(this, notifToQueue, list);
    } else {
      //MEMORY QUEUE:
      await qnm.queue(this, notifToQueue, list);
    }
  }

  setUid() {
    crypto.randomBytes(16, (err, buffer) => {
      if (err) {
        logger.log('error', `setUid Notification: ${err}`);
      } else {
        this.uId = this.id + '_' + buffer.toString('hex');
      }
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