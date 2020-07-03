'use strict';

const utils = require('../utils.js');
const logger = require('../logger.js');
const runtime = require('./runtime');
const loadConfigSection = utils.loadConfigSection;

class notificationEvent {
  constructor(name, notifications) {
    this.name = name;
    this.notifications = notifications;
  }

  async init() {
    try {
      const events = this.loadEventsObjects(this.name, this.notifications);
      return events;
    } catch (err) {
      logger.log('error', `init notificationEvent:`, err);
      throw err;
    }
  }

  async loadNotificationConfig(notification) {
    try {
      const config = await loadConfigSection(runtime.config, 'notifiers', notification.id);
      notification.config = config;
      return notification;
    } catch (err) {
      throw err;
    }
  }

  loadEventsObjects(name, notifications) {
    return new Promise(async (resolve, reject) => {
      if (notifications instanceof Array) {
        const notificationsLength = notifications.length;
        if (notificationsLength > 0) {
          const notificationsPromises = [];

          for (const notification of notifications) {
            await this.loadNotificationConfig(notification)
              .then(notificationAndConfig => {
                const type = notificationAndConfig.config.type;
                try {
                  const notification = new runtime.notifiers[type](notificationAndConfig);
                  notificationsPromises.push(notification.init());
                } catch (err) {
                  reject(`Notifier ${type} not found`);
                }
              })
              .catch(err => {
                reject(err);
              });
          }

          Promise.all(notificationsPromises)
            .then(res => {
              const objEvents = {};
              objEvents[name] = res;
              resolve(objEvents);
            })
            .catch(err => {
              reject(err);
            });
        } else {
          reject('Event loadEventsObjects zero notifications');
        }
      } else {
        reject(`Notifications, is not array  ${name}, ${notifications}`);
      }
    });
  }
}

module.exports = notificationEvent;
