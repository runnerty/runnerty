"use strict";

var utils = require("../utils.js");
var replaceWithSmart = utils.replaceWithSmart;
var checkNotificatorParams = utils.checkNotificatorParams;
var logger = utils.logger;
var qnm = require("../queue-notifications-memory.js");
var qnr = require("../queue-notifications-redis.js");
var crypto = require("crypto");

class Notification {
  constructor(notification) {
    var _this = this;
    var properties = Object.keys(notification);
    var propertiesLength = properties.length;

    while (propertiesLength--) {
      _this[properties[propertiesLength]] = notification[properties[propertiesLength]];
    }

    return new Promise((resolve, reject) => {
      var configValues = notification.config;
      if (!_this.type && configValues.type) {
        _this.type = configValues.type;
      }
      _this.config = configValues;

      _this.setUid()
        .then(() => {
          checkNotificatorParams(_this)
            .then(() => {
              resolve(_this);
            })
            .catch((err) => {
              reject(err);
            });
        });
    });
  }

  notificate(values) {
    var _this = this;
    _this.getValues(values)
      .then((res) => {
        _this.queue(_this.channel, res);
      });
  }

  sendMain(notification){
    var _this = this;
    return new Promise((resolve, reject) => {
      _this.resolve = resolve;
      _this.reject = reject;
      _this.send(notification);
    });
  }

  send() {
    logger.log("error", "Method send (notification) must be rewrite in child class");
  }

  end(options){
    var _this = this;

    if(!options) options = {};
    options.end = options.end || "end";

    switch (options.end) {
      case "error":
        logger.log("error", options.messageLog);
        _this.reject(options.messageLog || "");
        break;
      default:
        _this.resolve();
        break;
    }
  }

  getValues(values) {
    var _this = this;
    return new Promise((resolve, reject) => {
      let notif = {};
      Object.assign(notif, _this.config);
      Object.assign(notif, _this);
      delete notif.config;
      replaceWithSmart(notif, values)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  queue(listName, notifToQueue) {
    var _this = this;
    var list = _this.id + (listName ? "_" + listName : "");
    // QUEUE REDIS;
    if (global.config.queueNotificationsExternal && global.config.queueNotificationsExternal === "redis") {
      //REDIS QUEUE:
      qnr.queue(_this, notifToQueue, list);
    } else {
      //MEMORY QUEUE:
      qnm.queue(_this, notifToQueue, list);
    }
  }

  setUid() {
    var _this = this;
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buffer) => {
        if(err){
          reject(err);
        }else{
          _this.uId = _this.id + "_" + buffer.toString("hex");
          resolve();
        }
      });
    });
  }

  logger(type, menssage) {
    logger.log(type, menssage);
  }

  replaceWith(object, values) {
    return replaceWithSmart(object, values);
  }

}

module.exports = Notification;