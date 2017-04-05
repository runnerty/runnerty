"use strict";

var Notification = global.NotificationClass;
var TelegramBot = require('node-telegram-bot-api');

class telegramNotificator extends Notification {
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

  send(notification){
    return new Promise((resolve) => {
      var bot = new TelegramBot(notification.token);
      bot.sendMessage(notification.chat_id, notification.message)
        .then(function () {
          resolve();
        });
    });
  }
}

module.exports = telegramNotificator;