"use strict";

var utilReplaceWith = require("../libs/utils.js").replaceWith;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var requireDir = require("../libs/utils.js").requireDir;
var logger = require("../libs/utils.js").logger;
var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});

class Execution {
  constructor(process) {

    var _this = this;

    var params = Object.keys(process.exec);
    var paramsLength = params.length;

    while (paramsLength--) {
      _this[params[paramsLength]] = process.exec[params[paramsLength]];
    }

    _this.replaceWith = utilReplaceWith;
    _this.logger = logger;

    return new Promise((resolve) => {
      loadConfigSection(global.config, 'executors', _this.id)
        .then((configValues) => {
          if (!_this.type && configValues.type) {
            _this.type = configValues.type;
          }
          _this.config = configValues;

          // ADD NOTIFICATORS SCHEMAS:
          requireDir('/../executors/', 'schema.json')
            .then((res) => {
              var keys = Object.keys(res);
              var keysLength = keys.length;
              while (keysLength--) {
                if (_this.type === keys[keysLength]) {

                  if (res[keys[keysLength]].hasOwnProperty('definitions') && res[keys[keysLength]].definitions.hasOwnProperty('params')) {

                    if (!ajv.getSchema('exec_' + keys[keysLength])) {
                      ajv.addSchema(res[keys[keysLength]].definitions.params, 'exec_' + keys[keysLength]);
                    }

                    var valid = ajv.validate('exec_' + keys[keysLength], _this);
                    if (!valid) {
                      logger.log('error', `Invalid params for executor ${_this.type}:`, ajv.errors);
                      throw new Error(`Invalid params for executor ${_this.type}:`, ajv.errors);
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
              logger.log('warning', `Schema params for executor ${_this.type} not found`, err);
              resolve(_this);
            });
        })
        .catch(function (err) {
          logger.log('error', 'Executor loadConfig ', err);
          resolve();
        });
    });
  }

  exec() {
    logger.log('warn', 'This method must be rewrite in child class');
  }

}

module.exports = Execution;