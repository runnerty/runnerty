"use strict";

var replaceWithSmart = require("../libs/utils.js").replaceWithSmart;
// var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var requireDir = require("../libs/utils.js").requireDir;
var logger = require("../libs/utils.js").logger;
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
var crypto = require("crypto");

// PRUEBAS COLA DE NOTIFICACIONES:
var chronometer = require("../libs/utils.js").chronometer;

function sendNotification(list, notification, sender)
{
  var notificator = global.notificatorList[list];
  notificator.numberCurrentRunning = notificator.numberCurrentRunning + 1;
  sender.send(notification)
    .then((res) => {
      notificator.lastEndTime = chronometer();
      notificator.numberCurrentRunning = notificator.numberCurrentRunning - 1;
      checkNotificationsSends(list, sender);
    })
    .catch((err) => {
      logger.log('error', `Notification Sender error:`, err);
    });
}

function checkNotificationsSends(list, sender)
{
  var notificator = global.notificatorList[list];

  if (notificator){
      //Si no hay notificaciones en proceso:
      if (notificator.maxParallels > notificator.numberCurrentRunning || notificator.maxParallels === 0){
        // Si ha pasado el intervalo minimo de tiempo o no ha habido ejecución antes:
        var timeDiff = process.hrtime(notificator.lastEndTime);
        var milisecondsDiff = (timeDiff[0] * 1000) + (timeDiff[1] / 1000000);

        if (notificator.lastEndTime === [0,0] || (notificator.minInterval <= milisecondsDiff)){
          var notifications = global.notificationsList[list];
          if(notifications && notifications.length){
            var notification = notifications.shift();
            sendNotification(list, notification, sender);
          }
        }else{
          // Retry when minInterval expire:
          setTimeout(function(){
            checkNotificationsSends(list, sender);
          }, (notificator.minInterval-milisecondsDiff));
        }
      }
  }

}

class Notification {
  constructor(notification) {
    var _this = this;
    var properties = Object.keys(notification);
    var propertiesLength = properties.length;

    while (propertiesLength--) {
      _this[properties[propertiesLength]] = notification[properties[propertiesLength]];
    }

    return new Promise((resolve) => {
      var configValues = notification.config;
      if (!_this.type && configValues.type) {
        _this.type = configValues.type;
      }
      _this.config = configValues;

      _this.setUid()
        .then(() => {
          // ADD NOTIFICATORS SCHEMAS:
          requireDir('/../notificators/', 'schema.json')
            .then((res) => {
              var keys = Object.keys(res);
              var keysLength = keys.length;
              while (keysLength--) {
                if (_this.type === keys[keysLength]) {

                  if (res[keys[keysLength]].hasOwnProperty('definitions') && res[keys[keysLength]].definitions.hasOwnProperty('params')) {

                    if (!ajv.getSchema('notif_' + keys[keysLength])) {
                      ajv.addSchema(res[keys[keysLength]].definitions.params, 'notif_' + keys[keysLength]);
                    }

                    var valid = ajv.validate('notif_' + keys[keysLength], _this);
                    if (!valid) {
                      logger.log('error', `Invalid params for notificator ${_this.type}:`, ajv.errors);
                      throw new Error(`Invalid params for notificator ${_this.type}:`, ajv.errors);
                      //resolve();
                    } else {
                      resolve(_this);
                    }
                    keysLength = 0;
                  }
                }
              }
              resolve(_this);
            })
            .catch((err) => {
              logger.log('warning', `Schema params for notificator ${_this.type} not found`, err);
              resolve(_this);
            });
        });
    });
  }

  notificate() {
    logger.log('error', 'Method notificate (notification) must be rewrite in child class');
  }

  send() {
    logger.log('error', 'Method send (notification) must be rewrite in child class');
  }

  getValues(values) {
    var _this = this;
    return new Promise(function (resolve) {
      let notif = {};
      notif = Object.assign(notif, _this.config);
      notif = Object.assign(notif, _this);
      delete notif.config;
      replaceWithSmart(notif, values)
        .then(function (res) {
          resolve(res);
        })
        .catch(function (err) {
          logger.log('error', 'Notification - Method getValues:', err);
          resolve();
        });
    });
  }

  queue(listName, notifToQueue){
    var _this = this;
    var list = _this.id + (listName?'_'+listName:'');

    // NOTIFICATOR: Create list IF NOT EXISTS:
    if(!global.notificatorList.hasOwnProperty(list)){
      global.notificatorList[list] = {
        "notificatorId": _this.id,
        "minInterval": notifToQueue.minInterval || 0,
        "maxParallels": notifToQueue.maxParallels || 0,
        "numberCurrentRunning": 0,
        "lastEndTime": [0,0]
      };
    }
    // NOTIFICATIONS: Create list IF NOT EXISTS:
    if(!global.notificationsList.hasOwnProperty(list)){
      global.notificationsList[list] = [];
    }

    global.notificationsList[list].push(notifToQueue);
    checkNotificationsSends(list, _this);
  }

  setUid() {
    var _this = this;
    return new Promise((resolve) => {
      crypto.randomBytes(16, function (err, buffer) {
        _this.uId = _this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  logger(type, menssage){
    logger.log(type, menssage);
  }

  replaceWith(object, values){
    return replaceWithSmart(object, values);
  }

}

module.exports = Notification;