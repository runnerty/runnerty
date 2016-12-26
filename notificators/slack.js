"use strict";

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
        text: currentNotification.titleToSend,
        channel: currentNotification.channel,
        iconEmoji: currentNotification.bot_emoji,
        username: currentNotification.bot_name,
        attachments: [
          {
            text: currentNotification.msgToSend,
            color: currentNotification.color
          }
        ]
      }, function () {
        resolve();
      });
    }else{
      resolve();
    }
  });
};

function slackSender(notification){
  if(pendings.length){
    sendNextPending()
      .then(() => {
        slackSender(notification);
      })
      .catch(function(err){
        notification.logger.log('error',`slackSender: `+err);
        resolve();
      });
  }else{
    senderRunning = false;
  }
};


class slackNotificator extends Notification{
  constructor(notification){
    super(notification.id);

    this.title      = notification.title;
    this.message    = notification.message;
    this.channel    = notification.channel;
    this.webhookurl = notification.webhookurl;
    this.bot_name   = notification.bot_name;
    this.bot_emoji  = notification.bot_emoji;
    this.channel    = notification.channel;
    this.color      = notification.color;

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
          if (!_this.bot_name   && configValues.bot_name)   _this.bot_name   = configValues.bot_name;
          if (!_this.bot_emoji  && configValues.bot_emoji)  _this.bot_emoji  = configValues.bot_emoji;
          if (!_this.channel    && configValues.channel)    _this.channel    = configValues.channel;
          if (!_this.title      && configValues.title)      _this.title      = configValues.title;
          if (!_this.color      && configValues.color)      _this.color      = configValues.color;
        }
        _this.msgToSend   = _this.replaceWith(_this.message, values);
        _this.titleToSend = _this.replaceWith(_this.title, values);

        pendings.push(_this);
        _this.run();
        resolve();
      })
      .catch(function(e){
        _this.logger.log('error','Slack notificate loadConfig '+e);
        resolve();
      });
    });
  }

  run(){
    var _this = this;

    if(!senderRunning){
      senderRunning = true;
      slackSender(_this);
    }
  }

}

module.exports = slackNotificator;