"use strict";

var logger           = require("../libs/utils.js").logger;
var replaceWith      = require("../libs/utils.js").replaceWith;
var Notification     = require("./notification.js");
var IncomingWebhooks = require('@slack/client').IncomingWebhook;

var pendings = [];

function sendNextPending(){
  return new Promise((resolve) => {
    var actualNotification = pendings.shift();
    var wh = new IncomingWebhooks(actualNotification.webhookurl);
    wh.send({
      text: actualNotification.msgToSend,
      channel: actualNotification.channel,
      iconEmoji: actualNotification.bot_emoji,
      username: actualNotification.bot_name
    }, function () {
     resolve();
    });
  });
};

function slackSender(){
  if(pendings.length){
    sendNextPending()
      .then(() => {
        slackSender();
      })
      .catch(function(err){
        logger.log('error',`Chain ${_this.id} loadEvents: `+err);
        resolve();
      });
  }else{
    setTimeout(function(){
      slackSender();
    },1000)
  }
};

slackSender();

class slackNotificator extends Notification{
  constructor(type, id, webhookurl, bot_name, bot_emoji, message, channel, recipients){
    super('slack', id, null, message, recipients, null, null);

    this.webhookurl = webhookurl;
    this.bot_name = bot_name;
    this.bot_emoji = bot_emoji;
    this.channel = channel;

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
          if (!_this.bot_name && configValues.bot_name)   _this.bot_name  = configValues.bot_name;
          if (!_this.bot_emoji && configValues.bot_emoji) _this.bot_emoji = configValues.bot_emoji;
          if (!_this.channel && configValues.channel)     _this.channel   = configValues.channel;
        }
        _this.msgToSend = replaceWith(_this.message, values);
        pendings.push(_this);
        resolve();
      })
      .catch(function(e){
        logger.log('error','Slack notificate loadConfig '+e)
        resolve();
      });
    });
  }
}

module.exports = slackNotificator;