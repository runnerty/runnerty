"use strict";

var Notification     = require("../../classes/notification.js");
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
    super(notification)
  }

  notificate(values){
    var _this = this;

    if (_this.config){
      if (!_this.webhookurl && _this.config.webhookurl) _this.webhookurl = _this.config.webhookurl;
      if (!_this.bot_name   && _this.config.bot_name)   _this.bot_name   = _this.config.bot_name;
      if (!_this.bot_emoji  && _this.config.bot_emoji)  _this.bot_emoji  = _this.config.bot_emoji;
      if (!_this.channel    && _this.config.channel)    _this.channel    = _this.config.channel;
      if (!_this.title      && _this.config.title)      _this.title      = _this.config.title;
      if (!_this.color      && _this.config.color)      _this.color      = _this.config.color;
    }
    _this.msgToSend   = _this.replaceWith(_this.message, values);
    _this.titleToSend = _this.replaceWith(_this.title, values);

    pendings.push(_this);
    _this.run();
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