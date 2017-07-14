"use strict";

var logger = require("./utils.js").logger;

function sendNotification(list, notification, sender) {
  var notificator = global.notificatorList[list];
  notificator.numberCurrentRunning = notificator.numberCurrentRunning + 1;
  sender.sendMain(notification)
    .then(() => {
      notificator.lastEndTime = process.hrtime();
      notificator.numberCurrentRunning = notificator.numberCurrentRunning - 1;
      checkNotificationsSends(list, sender);
    })
    .catch((err) => {
      logger.log("error", `Notification Sender error: ${err}`);
    });
}

function checkNotificationsSends(list, sender) {
  var notificator = global.notificatorList[list];

  if (notificator) {
    //Si no hay notificaciones en proceso:
    if (notificator.maxConcurrents > notificator.numberCurrentRunning || notificator.maxConcurrents === 0) {
      // Si ha pasado el intervalo minimo de tiempo o no ha habido ejecución antes:
      var timeDiff = process.hrtime(notificator.lastEndTime);
      var milisecondsDiff = (timeDiff[0] * 1000) + (timeDiff[1] / 1000000);

      if (notificator.lastEndTime === [0, 0] || (notificator.minInterval <= milisecondsDiff)) {
        var notifications = global.notificationsList[list];
        if (notifications && notifications.length) {
          var notification = notifications.shift();
          sendNotification(list, notification, sender);
        }
      } else {
        // Retry when minInterval expire:
        setTimeout(() => {
          checkNotificationsSends(list, sender);
        }, (notificator.minInterval - milisecondsDiff));
      }
    }
  }
}

function queue(notification, notifToQueue, list) {
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
  // NOTIFICATIONS LIST: Create IF NOT EXISTS:
  if (!global.notificationsList.hasOwnProperty(list)) {
    global.notificationsList[list] = [];
  }
  global.notificationsList[list].push(notifToQueue);
  checkNotificationsSends(list, notification);
}

module.exports.queue = queue;