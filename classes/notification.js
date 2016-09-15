"use strict";

var utils    = require("../libs/utils.js");
var logger   = require("../libs/utils.js").logger;

class Notification {
  constructor(type, id, title, message, recipients, recipients_cc, recipients_cco) {
    this.type = type;
    this.id = id;
    this.title = title;
    this.message = message;
    this.recipients = recipients;
    this.recipients_cc = recipients_cc;
    this.recipients_cco = recipients_cco;
  }

  notificate(){
    logger.log('warn','This method must be rewrite in child class');
  }

  loadConfig(config){
    var _this = this;
    return utils.loadConfigSection(config, 'notificators_connections', _this.id);
  }


}

module.exports = Notification;