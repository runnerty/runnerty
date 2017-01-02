"use strict";

var Notification = require("../../classes/notification.js");
var TelegramBot = require('node-telegram-bot-api');

var pendings = [];
var senderRunning = false;

function sendNextPending() {
  return new Promise((resolve) => {
    var currentlNotification = pendings.shift();

    if (currentlNotification) {
      var bot = new TelegramBot(currentlNotification.token);

      bot.sendMessage(currentlNotification.chat_id, currentlNotification.msgToSend)
        .then(function () {
          resolve();
        });
    } else {
      resolve();
    }
  });
}

function telegramSender(notification) {
  if (pendings.length) {
    sendNextPending()
      .then(() => {
        telegramSender(notification);
      })
      .catch(function (err) {
        notification.logger.log('error', `telegramSender: ` + err);
        senderRunning = false;
      });
  } else {
    senderRunning = false;
  }
}

class telegramNotificator extends Notification {
  constructor(notification) {
    super(notification);
  }

  notificate(values) {
    var _this = this;

    if (_this.config) {
      if (!_this.token && _this.config.token)   _this.token = _this.config.token;
      if (!_this.chat_id && _this.config.chat_id) _this.chat_id = _this.config.chat_id;
    }
    _this.msgToSend = _this.replaceWith(_this.message, values);
    pendings.push(_this);
    _this.run();
  }

  run() {
    var _this = this;

    if (!senderRunning) {
      senderRunning = true;
      telegramSender(_this);
    }
  }

}

module.exports = telegramNotificator;