"use strict";

var logger           = require("../libs/utils.js").logger;
var replaceWith      = require("../libs/utils.js").replaceWith;
var Notification     = require("../classes/notification.js");
var IncomingWebhooks = require('@slack/client').IncomingWebhook;

var pendings = [];
var senderRunning = false;

function sendNextPending(){
  return new Promise((resolve) => {
    var currentNotification = pendings.shift();
  
    if(currentNotification){
      var wh = new IncomingWebhooks(currentNotification.webhookurl);
      wh.send({
        text: currentNotification.msgToSend,
        channel: currentNotification.channel,
        iconEmoji: currentNotification.bot_emoji,
        username: currentNotification.bot_name
      }, function () {
        resolve();
      });
    }else{
      resolve();
    }

  });
};

function slackSender(){
  if(pendings.length){
    sendNextPending()
      .then(() => {
        slackSender();
      })
      .catch(function(err){
        logger.log('error',`slackSender: `+err);
        resolve();
      });
  }else{
    senderRunning = false;
  }

  /*
  else{
    //If not exists on pendings array try every second:
    setTimeout(function(){
      slackSender();
    },500)
  }
  */
};

//Init try send slack messages if exists on pendings array
//slackSender();

class slackNotificator extends Notification{
  constructor(notification){
    super('slack', notification.id, null, notification.message, notification.recipients, null, null);

    this.webhookurl = notification.webhookurl;
    this.bot_name = notification.bot_name;
    this.bot_emoji = notification.bot_emoji;
    this.channel = notification.channel;

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
          if (!_this.webhookurl && configValues.webhookurl) _this.webhookurl = configValues.webhookurl;
          if (!_this.bot_name && configValues.bot_name)     _this.bot_name   = configValues.bot_name;
          if (!_this.bot_emoji && configValues.bot_emoji)   _this.bot_emoji  = configValues.bot_emoji;
          if (!_this.channel && configValues.channel)       _this.channel    = configValues.channel;
        }
        _this.msgToSend = replaceWith(_this.message, values);
        pendings.push(_this);
        _this.run();
        resolve();
      })
      .catch(function(e){
        logger.log('error','Slack notificate loadConfig '+e);
        resolve();
      });
    });
  }

  run(){
    if(!senderRunning){
      senderRunning = true;
      slackSender();
    }
  }

}

module.exports = slackNotificator;