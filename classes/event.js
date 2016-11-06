"use strict";

var logger            = require("../libs/utils.js").logger;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;

var slackNotificator  = require("./slack_notificator.js");
var mailNotificator   = require("./mail_notificator.js");

class Event {
  constructor(name, process, notifications){

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

  loadNotificationConfig(notificationId){
    return loadConfigSection(global.config, 'notificators_connections', notificationId);
  }

  loadEventsObjects(name, process, notifications) {
    var _this = this;
    return new Promise((resolve) => {
      var objEvent = {};
      objEvent[name] = {};

      var notificationsPromises = [];

      if (notifications instanceof Array) {
        var notificationsLength = notifications.length;
        if (notificationsLength > 0) {

          while (notificationsLength--) {
            var notification = notifications[notificationsLength];

           _this.loadNotificationConfig(notification.id)
             .then(function (res) {

               var type = '';

               if(notification.type){
                 type = notification.type;
               }else{
                 type = res.type;
               }

               switch (type) {
                 case 'mail':
                   notificationsPromises.push(new mailNotificator(type,
                     notification.id,
                     notification.title,
                     notification.message,
                     notification.recipients,
                     notification.recipients_cc,
                     notification.recipients_cco
                   ));
                   break;
                 case 'slack':
                   notificationsPromises.push(new slackNotificator(type,
                     notification.id,
                     notification.token,
                     notification.bot_name,
                     notification.bot_emoji,
                     notification.message,
                     notification.channel,
                     notification.recipients
                   ));
                   break;
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

             })
             .catch(function(err){
               logger.log('error','Event loadNotificationConfig: '+err);
             });
          }

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