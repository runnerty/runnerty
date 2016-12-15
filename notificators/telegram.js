"use strict";

var Notification     = require("../classes/notification.js");
var TelegramBot      = require('node-telegram-bot-api');

var pendings = [];
var senderRunning = false;

function sendNextPending(){
  return new Promise((resolve) => {
   var currentlNotification = pendings.shift();
  
  if (currentlNotification){
    var bot = new TelegramBot(currentlNotification.token);

    bot.sendMessage(currentlNotification.chat_id, currentlNotification.msgToSend)
      .then(function (sended) {
        resolve();
      });
  }else{
    resolve();
  }
});
};

function telegramSender(){
  if(pendings.length){
    sendNextPending()
      .then((end) => {
        telegramSender();
  })
  .catch(function(err){
      _this.logger.log('error',`telegramSender: `+err);
      resolve();
    });
  }else{
    senderRunning = false;
  }
};

class telegramNotificator extends Notification{
  constructor(notification){
    super('telegram', notification.id, null, notification.message, notification.chat_id, null, null);

    this.token   = notification.token;
    this.chat_id = notification.chat_id;

    return new Promise((resolve) => {
        resolve(this);
  });
  }

  notificate(values){
    var _this = this;

    return new Promise((resolve) => {
      _this.loadConfig()
      .then((configValues) => {
      if (configValues){
        if (!_this.token && configValues.token)     _this.token     = configValues.token;
        if (!_this.chat_id && configValues.chat_id) _this.chat_id   = configValues.chat_id;
      }
      _this.msgToSend = _this.replaceWith(_this.message, values);
      pendings.push(_this);
      _this.run();
      resolve();
  })
  .catch(function(e){
      _this.logger.log('error','Telegram notificate loadConfig '+e)
      resolve();
    });
  });
  }

  run(){
    if(!senderRunning){
      senderRunning = true;
      telegramSender();
    }
  }

}

module.exports = telegramNotificator;