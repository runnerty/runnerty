"use strict";
var Notification = require("../../classes/notification.js");

class slackNotificator extends Notification {
  constructor(notification) {
    super(notification);
  }

  notificate(values) {
    var _this = this;
    _this.getValues(values)
      .then((res) => {
        _this.queue(_this.channel, res);
      });
  }

}

module.exports = slackNotificator;