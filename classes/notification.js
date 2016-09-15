"use strict";

var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var logger            = require("../libs/utils.js").logger;

class Notification {
  constructor(type, id, title, message, recipients, recipients_cc, recipients_cco, config) {
    this.type = type;
    this.id = id;
    this.title = title;
    this.message = message;
    this.recipients = recipients;
    this.recipients_cc = recipients_cc;
    this.recipients_cco = recipients_cco;
    this.config         = config;
  }

  notificate(){
    logger.log('warn','This method must be rewrite in child class');
  }

  loadConfig(){
    var _this = this;
    return loadConfigSection(_this.config, 'notificators_connections', _this.id);
  }


}

module.exports = Notification;