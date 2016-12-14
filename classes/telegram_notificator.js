"use strict";

var logger           = require("../libs/utils.js").logger;
var replaceWith      = require("../libs/utils.js").replaceWith;
var Notification     = require("./notification.js");
var TelegramBot      = require('node-telegram-bot-api');

var pendings = [];
var senderRunning = false;

function sendNextPending(){
  return new Promise((resolve) => {
   var currentlNotification = pendings.shift();
  
  if (currentlNotification){
    var bot = new TelegramBot(currentlNotification.token /* , {polling: {timeout: 1, interval: 100}}*/);

    //console.log('telegramSender:',currentlNotification.token,currentlNotification.chat_id, currentlNotification.msgToSend);
    /*
     var opts = {
     reply_markup: JSON.stringify(
     {
     force_reply: true
     }
     )};
     */

    bot.sendMessage(currentlNotification.chat_id, currentlNotification.msgToSend /*, opts */)
      .then(function (sended) {
        resolve();
        /*
         var chatId = sended.chat.id;
         var messageId = sended.message_id;

         bot.onReplyToMessage(chatId, messageId, function(message) {
         console.log('User is %s years old', message.text);
         });
         */
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
      logger.log('error',`telegramSender: `+err);
      resolve();
    });
  }else{
    senderRunning = false;
  }
  /*
  else{
    //If not exists on pendings array try every second:
    setTimeout(function(){
      console.log('PING telegramSender!');
      telegramSender();
    },500)
  }
  */
};

//Init try send telegram messages if exists on pendings array
// telegramSender();

class telegramNotificator extends Notification{
  constructor(type, id, token, message, chat_id){
    super('telegram', id, null, message, chat_id, null, null);

    this.token = token;
    this.chat_id = chat_id;

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
      _this.msgToSend = replaceWith(_this.message, values);
      pendings.push(_this);
      _this.run();
      resolve();
  })
  .catch(function(e){
      logger.log('error','Telegram notificate loadConfig '+e)
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