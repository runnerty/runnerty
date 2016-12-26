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

function telegramSender(notification){
  if(pendings.length){
    sendNextPending()
    .then((end) => {
      telegramSender(notification);
    })
    .catch(function(err){
      notification.logger.log('error',`telegramSender: `+err);
      senderRunning = false;
    });
  }else{
    senderRunning = false;
  }
};

class telegramNotificator extends Notification{
  constructor(notification){
    super(notification.id);

    this.message = notification.message;
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
        this.logger.log('error','Telegram notificate loadConfig '+e)
        resolve();
      });
    });
  }

  run(){
    var _this = this;

    if(!senderRunning){
      senderRunning = true;
      telegramSender(_this);
    }
  }

}

module.exports = telegramNotificator;