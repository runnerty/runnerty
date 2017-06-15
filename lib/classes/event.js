"use strict";

var utils = require("../utils.js");
var logger = utils.logger;
var loadConfigSection = utils.loadConfigSection;

class Event {
  constructor(name, notifications) {

    return new Promise((resolve, reject) => {
      this.loadEventsObjects(name, notifications)
        .then((events) => {
          resolve(events);
        })
        .catch(function (err) {
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
        .catch(function (err) {
          reject(err);
        });
    });
  }

  loadEventsObjects(name, notifications) {
    var _this = this;
    return new Promise((resolve, reject) => {
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
                let type = notificationAndConfig.config.type;

                try{
                  notificationsPromises.push(new global.notificators[type](notificationAndConfig));
                }catch(err){
                  reject(`Notificator ${type} not found`);
                }

                Promise.all(notificationsPromises)
                  .then(function (res) {
                    objEvent[name].notifications = res;
                    resolve(objEvent);
                  })
                  .catch(function (err) {
                    logger.log("error", "Event loadEventsObjects: ", err);
                    reject(objEvent);
                  });

              })
              .catch(function (err) {
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

module.exports = Event;