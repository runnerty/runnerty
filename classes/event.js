"use strict";

var logger            = require("../libs/utils.js").logger;

var slackNotificator= require("./slack_notificator.js");
var mailNotificator = require("./mail_notificator.js");

class Event {
  constructor(name, process, notifications, config){

    this.config = config;

    return new Promise((resolve) => {
        this.loadEventsObjects(name, process, notifications)
        .then((events) => {
        resolve(events);
  })
  .catch(function(e){
      logger.log('error','Event constructor '+e);
      resolve();
    });
  });
  }

  loadEventsObjects(name, process, notifications) {
    var _this = this;
    return new Promise((resolve) => {
      var objEvent = {};
      objEvent[name] = {};

    //TODO: event/proccess

    var notificationsPromises = [];

    if (notifications instanceof Array) {
      var notificationsLength = notifications.length;
      if (notificationsLength > 0) {

        while (notificationsLength--) {
          var notification = notifications[notificationsLength];
          switch (notification.type) {
            case 'mail':
              notificationsPromises.push(new mailNotificator(notification.type,
                notification.id,
                notification.title,
                notification.message,
                notification.recipients,
                notification.recipients_cc,
                notification.recipients_cco,
                _this.config
              ));
              break;
            case 'slack':
              notificationsPromises.push(new slackNotificator(notification.type,
                notification.id,
                notification.token,
                notification.bot_name,
                notification.bot_emoji,
                notification.message,
                notification.channel,
                notification.recipients,
                _this.config
              ));
              break;
          }
        }

        Promise.all(notificationsPromises)
          .then(function (res) {
            objEvent[name]['notifications'] = res;
            resolve(objEvent);
          })
          .catch(function(e){
            logger.log('error','Event loadEventsObjects: '+e);
            resolve(objEvent);
          });

      } else {
        logger.log('error','Event loadEventsObjects: '+e);
        resolve(objEvent);
      }
    } else {
      logger.log('error','Notifications, is not array', name, process, notifications);
      resolve(objEvent);
    }
  });
  }
}

module.exports = Event;