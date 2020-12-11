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

  async loadEventsObjects(name, notifications) {
    if (notifications instanceof Array) {
      const notificationsLength = notifications.length;
      if (notificationsLength > 0) {
        const notificationsPromises = [];

        for (const notification of notifications) {
          try {
            const notificationAndConfig = await this.loadNotificationConfig(notification);
            const type = notificationAndConfig.config.type;
            try {
              const params = {
                notification: notificationAndConfig,
                runtime: runtime,
                checkNotifierParams: utils.checkNotifierParams,
                logger: logger
              };
              const notification = new runtime.notifiers[type](params);
              notificationsPromises.push(notification.init());
            } catch (err) {
              throw new Error(`Notifier ${type} not found`);
            }
          } catch (err) {
            throw err;
          }
        }

        try {
          const allNotifRes = await Promise.all(notificationsPromises);
          const objEvents = {};
          objEvents[name] = allNotifRes;
          return objEvents;
        } catch (err) {
          throw err;
        }
      } else {
        throw new Error('Event loadEventsObjects zero notifications');
      }
    } else {
      throw new Error(`Notifications, is not array  ${name}, ${notifications}`);
    }
  }
}

module.exports = notificationEvent;
