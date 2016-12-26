"use strict";

var utilReplaceWith   = require("../libs/utils.js").replaceWith;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var logger            = require("../libs/utils.js").logger;

class Notification {
  constructor(id/*, title, message, recipients, recipients_cc, recipients_cco*/) {
    //this.type = type;
    this.id = id;
    /*
    this.title = title;
    this.message = message;
    this.recipients = recipients;
    this.recipients_cc = recipients_cc;
    this.recipients_cco = recipients_cco;
    */
    this.replaceWith = utilReplaceWith;
    this.logger = logger;
  }

  notificate(){
    logger.log('warn','This method must be rewrite in child class');
  }

  loadConfig(){
    var _this = this;
    return loadConfigSection(global.config, 'notificators', _this.id);
  }


}

module.exports = Notification;