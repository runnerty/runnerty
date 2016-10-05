"use strict";

var Slack           = require('slack-node');
var logger          = require("../libs/utils.js").logger;
var replaceWith     = require("../libs/utils.js").replaceWith;
var Notification    = require("./notification.js");


class slackNotificator extends Notification{
  constructor(type, id, token, bot_name, bot_emoji, message, channel, recipients, config){
    super('slack', id, null, message, recipients, null, null, config);

    this.token = token;
    this.bot_name = bot_name;
    this.bot_emoji = bot_emoji;
    this.channel = channel;
    this.config = config;

    return new Promise((resolve) => {
        resolve(this);
  });
  }

  notificate(values){
    return new Promise((resolve) => {

      this.loadConfig()
      .then((configValues) => {
      if (configValues){
        if (!this.token && configValues.token)         this.token     = configValues.token;
        if (!this.bot_name && configValues.bot_name)   this.bot_name  = configValues.bot_name;
        if (!this.bot_emoji && configValues.bot_emoji) this.bot_emoji = configValues.bot_emoji;
        if (!this.channel && configValues.channel)     this.channel   = configValues.channel;
      }

      var slack = new Slack(this.token);
      var msg = replaceWith(this.message, values);

      logger.log('debug','[SLACK NOTIFICATION] > '+msg);

      slack.api('chat.postMessage', {
        text: msg,
        channel: this.channel,
        username: this.bot_name,
        icon_emoji: this.bot_emoji,
      },function(err, response){
        if(err){
          logger.log('error','Slack notification: '+err);
          logger.log('error','Slack notification: '+msg);
        }
      });
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