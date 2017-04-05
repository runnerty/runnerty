"use strict";
var Notification = global.NotificationClass;
var IncomingWebhooks = require('@slack/client').IncomingWebhook;

class slackNotificator extends Notification {
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

  send(notification) {
    return new Promise((resolve) => {
      var wh = new IncomingWebhooks(notification.webhookurl);
      var data = {
        text: notification.title,
        channel: notification.channel,
        iconEmoji: notification.bot_emoji,
        username: notification.bot_name,
        attachments: [
          {
            text: notification.message,
            color: notification.color
          }
        ]
      };
      wh.send(data, function () {
        resolve();
      });
    });
  }

}

module.exports = slackNotificator;