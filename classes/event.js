"use strict";

var utils = require("../libs/utils.js");
var logger = utils.logger;
var loadConfigSection = utils.loadConfigSection;

class Event {
  constructor(name, notifications) {

    return new Promise((resolve) => {
      this.loadEventsObjects(name, notifications)
        .then((events) => {
          resolve(events);
        })
        .catch(function (err) {
          logger.log('error', 'Event constructor ', err);
          resolve();
        });
    });
  }

  loadNotificationConfig(notification) {
    return new Promise((resolve) => {
      loadConfigSection(global.config, 'notificators', notification.id)
        .then((config) => {
          notification.config = config;
          resolve(notification);
        })
        .catch(function (err) {
          logger.log('error', 'loadNotificationConfig', err);
          resolve(notification);
        });
    });
  }

  loadEventsObjects(name, notifications) {
    var _this = this;
    return new Promise((resolve) => {
      var objEvent = {};
      objEvent[name] = {};

      if (notifications instanceof Array) {
        var notificationsLength = notifications.length;
        if (notificationsLength > 0) {

          var notificationsPromises = [];

          while (notificationsLength--) {
            var notification = notifications[notificationsLength];
            _this.loadNotificationConfig(notification)
              .then(function (notificationAndConfig) {

                var type = notificationAndConfig.config.type;

                notificationsPromises.push(new global.notificators[type](notificationAndConfig));

                Promise.all(notificationsPromises)
                  .then(function (res) {
                    objEvent[name].notifications = res;
                    resolve(objEvent);
                  })
                  .catch(function (err) {
                    logger.log('error', 'Event loadEventsObjects: ', err);
                    resolve(objEvent);
                  });

              })
              .catch(function (err) {
                logger.log('error', 'Event loadNotificationConfig: ', err);
                resolve(objEvent);
              });
          }

        } else {
          logger.log('error', 'Event loadEventsObjects  zero notifications');
          resolve(objEvent);
        }
      } else {
        logger.log('error', 'Notifications, is not array', name, notifications);
        resolve(objEvent);
      }
    });
  }
}

module.exports = Event;