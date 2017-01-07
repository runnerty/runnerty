"use strict";

var utilReplaceWith = require("../libs/utils.js").replaceWith;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var requireDir = require("../libs/utils.js").requireDir;
var logger = require("../libs/utils.js").logger;
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});

class Notification {
  constructor(notification) {

    var _this = this;

    var properties = Object.keys(notification);
    var propertiesLength = properties.length;

    while (propertiesLength--) {
      _this[properties[propertiesLength]] = notification[properties[propertiesLength]];
    }

    _this.replaceWith = utilReplaceWith;
    _this.logger = logger;

    return new Promise((resolve) => {
      loadConfigSection(global.config, 'notificators', _this.id)
        .then((configValues) => {
          if (!_this.type && configValues.type) {
            _this.type = configValues.type;
          }
          _this.config = configValues;

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
              console.error(err);
              logger.log('warning', `Schema params for notificator ${_this.type} not found`, err);
              resolve(_this);
            });
        })
        .catch(function (err) {
          logger.log('error', 'Notificate loadConfig ', err);
          resolve();
        });
    });
  }

  notificate() {
    logger.log('error', 'Method notificate (notificacion) must be rewrite in child class');
  }

}

module.exports = Notification;