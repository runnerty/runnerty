"use strict";

const utils = require("../utils.js");
const logger = utils.logger;
const loadConfigSection = utils.loadConfigSection;

class notificationEvent {
  constructor(name, notifications) {

    return new Promise((resolve, reject) => {
      this.loadEventsObjects(name, notifications)
        .then((events) => {
          resolve(events);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  loadNotificationConfig(notification) {
    return new Promise((resolve, reject) => {
      loadConfigSection(global.config, "notificators", notification.id)
        .then((config) => {
          notification.config = config;
          resolve(notification);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  loadEventsObjects(name, notifications) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let objEvent = {};
      objEvent[name] = {};

      if (notifications instanceof Array) {
        let notificationsLength = notifications.length;
        if (notificationsLength > 0) {
          let notificationsPromises = [];

          while (notificationsLength--) {
            let notification = notifications[notificationsLength];
            _this.loadNotificationConfig(notification)
              .then((notificationAndConfig) => {
                let type = notificationAndConfig.config.type;

                try{
                  notificationsPromises.push(new global.notificators[type](notificationAndConfig));
                }catch(err){
                  reject(`Notificator ${type} not found`);
                }

                Promise.all(notificationsPromises)
                  .then((res) => {
                    objEvent[name].notifications = res;
                    resolve(objEvent);
                  })
                  .catch((err) => {
                    logger.log("error", "Event loadEventsObjects: ", err);
                    reject(objEvent);
                  });
              })
              .catch((err) => {
                reject(err);
              });
          }

        } else {
          reject("Event loadEventsObjects zero notifications");
        }
      } else {
        reject(`Notifications, is not array  ${name}, ${notifications}`);
      }
    });
  }
}

module.exports = notificationEvent;