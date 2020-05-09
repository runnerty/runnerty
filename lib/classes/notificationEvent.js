'use strict';

const utils = require('../utils.js');
const logger = require('../logger.js');
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

  loadNotificationConfig(notification) {
    return new Promise((resolve, reject) => {
      loadConfigSection(global.config, 'notifiers', notification.id)
        .then(config => {
          notification.config = config;
          resolve(notification);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  loadEventsObjects(name, notifications) {
    return new Promise(async (resolve, reject) => {
      if (notifications instanceof Array) {
        let notificationsLength = notifications.length;
        if (notificationsLength > 0) {
          let notificationsPromises = [];

          for (const notification of notifications) {
            await this.loadNotificationConfig(notification)
              .then(notificationAndConfig => {
                let type = notificationAndConfig.config.type;
                try {
                  const notification = new global.notifiers[type](notificationAndConfig);
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
              let objEvents = {};
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
