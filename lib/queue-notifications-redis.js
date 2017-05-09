"use strict";

var logger = require("./utils.js").logger;

function sendNotification(list, notification, sender, redisCli) {
  var notificator = global.notificatorList[list];
  notificator.numberCurrentRunning = notificator.numberCurrentRunning + 1;
  sender.send(notification)
    .then(() => {
      notificator.lastEndTime = process.hrtime();
      notificator.numberCurrentRunning = notificator.numberCurrentRunning - 1;
      checkNotificationsSends(list, sender, redisCli);
    })
    .catch((err) => {
      logger.log("error", `Notification Sender error: ${err}`);
    });
}

function checkNotificationsSends(list, sender, redisCli) {
  var notificator = global.notificatorList[list];

  if (notificator) {
    //Si no hay notificaciones en proceso:
    if (notificator.maxConcurrents > notificator.numberCurrentRunning || notificator.maxConcurrents === 0) {
      // Si ha pasado el intervalo minimo de tiempo o no ha habido ejecución antes:
      var timeDiff = process.hrtime(notificator.lastEndTime);
      var milisecondsDiff = (timeDiff[0] * 1000) + (timeDiff[1] / 1000000);

      if (notificator.lastEndTime === [0, 0] || (notificator.minInterval <= milisecondsDiff)) {
        var notificationsList = "R" + "_NOTIFICATIONS_" + list;
        redisCli.lpop(notificationsList, function (err, res) {
          if (res) {
            try {
              var notification = JSON.parse(res);
              sendNotification(list, notification, sender, redisCli);
            } catch (err) {
              logger.log("error", `Notification Redis Notifications PARSE LPOP: ${err}`);
            }
          }
        });
      } else {
        // Retry when minInterval expire:
        setTimeout(function () {
          checkNotificationsSends(list, sender, redisCli);
        }, (notificator.minInterval - milisecondsDiff));
      }
    }
  }
}

function queue(notification, notifToQueue, list) {
  var notificationsList = "R" + "_NOTIFICATIONS_" + list;
  var redisCli = global.queueRedisCli;

  // QUEUE MEMORY;
  // NOTIFICATOR: Create IF NOT EXISTS:
  if (!global.notificatorList.hasOwnProperty(list)) {
    global.notificatorList[list] = {
      "notificatorId": notification.id,
      "minInterval": notifToQueue.minInterval || 0,
      "maxConcurrents": notifToQueue.maxConcurrents || 1,
      "numberCurrentRunning": 0,
      "lastEndTime": [0, 0]
    };
  }

  // NOTIFICATIONS:
  redisCli.rpush(notificationsList, JSON.stringify(notifToQueue), function (err) {
    if (err) {
      logger.log("error", "Notification Redis Notifications RPUSH:", err);
    } else {
      checkNotificationsSends(list, notification, redisCli);
    }
  });
}

module.exports.queue = queue;