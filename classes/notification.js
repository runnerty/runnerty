"use strict";

var utilReplaceWith = require("../libs/utils.js").replaceWith;
var replaceWithSmart = require("../libs/utils.js").replaceWithSmart;
// var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var requireDir = require("../libs/utils.js").requireDir;
var logger = require("../libs/utils.js").logger;
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
var crypto = require("crypto");

// PRUEBAS COLA DE NOTIFICACIONES:
var chronometer = require("../libs/utils.js").chronometer;

function sendNotification(list, notification)
{
  var notificator = global.notificatorList[list];
  notificator.numberCurrentRunning = notificator.numberCurrentRunning + 1;
  console.log('[3] sendNotification: ',notificator.numberCurrentRunning);
  setTimeout(function(){
    notificator.lastEndTime = chronometer();
    notificator.numberCurrentRunning = notificator.numberCurrentRunning - 1;
    console.log('[4] Termina la notificacion:',notification);
    checkNotificationsSends(list);
    }, 5001);
}

function checkNotificationsSends(list)
{
  var notificator = global.notificatorList[list];
  console.log('[1] NOTIFICAR:', list);

  if (notificator){
    if (notificator.sendType === 'parallel'){
      if (notificator.maxParallels < notificator.numberCurrentRunning){

      }
    }else{
      // SERIE:
      //Si no hay notificaciones en proceso:
      console.log('[2] Notificaciones en proceso:',notificator.numberCurrentRunning);
      if (notificator.numberCurrentRunning === 0){
        // Si ha pasado el intervalo minimo de tiempo o no ha habido ejecución antes:
        if (notificator.lastEndTime === 0 || ((notificator.lastEndTime + notificator.minInterval) <= chronometer())){
          //console.log('here! 1a');
          var notifications = global.notificationsList[list];
          console.log('[2.1] antes de shift:',notifications);
          if(notifications && notifications.length){
            var notification = notifications.shift();
            console.log('[2.2] despues de shift:',notifications);
            sendNotification(list, notification);
          }else{
            console.log('> DE MOMENTO NO HAY MAS NOTIFICACIONES DE ',list);
          }

        }else{
          console.log('here! 2b', (notificator.lastEndTime + notificator.minInterval), chronometer());
          // Retry when minInterval expire:
          // setTimeout(checkNotificationsSends(list), (notificator.lastEndTime + notificator.minInterval) - chronometer());
        }
      }else{
        console.log(' > HAY NOTIFICACIONES EN EJECUCION. SE ESPERA. ',list);
      }
    }
    //console.log('global.notificatorList:',global.notificatorList);
    // console.log('global.notificationsList:',);

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

    //_this.replaceWith = utilReplaceWith;
    //_this.replaceWithSmart = replaceWithSmart;

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
    logger.log('error', 'Method notificate (notificacion) must be rewrite in child class');
  }

  getValues(values) {
    var _this = this;
    return new Promise(function (resolve) {
      let notif = Object.assign(_this.config, _this);
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
        "sendType": _this.sendType || 'serie',
        "minInterval": _this.config.minInterval || 0,
        "maxParallels": _this.config.maxParallels || 0,
        "numberCurrentRunning": 0,
        "lastEndTime": 0
      };
      //TODO: Llamar al método de check-envio de notificciones con el nombre de la lista: ej. cs(list);
    }
    // NOTIFICATIONS: Create list IF NOT EXISTS:
    if(!global.notificationsList.hasOwnProperty(list)){
      global.notificationsList[list] = [];
    }

    global.notificationsList[list].push(notifToQueue);
    console.log('[0] en queue:',global.notificationsList[list]);
    checkNotificationsSends(list);
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

}

module.exports = Notification;