"use strict";

const logger = require("./utils.js").logger;

function sendNotification(list, notification, sender) {
  let notificator = global.notificatorList[list];
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
  let notificator = global.notificatorList[list];

  if (notificator) {
    //If there are no notifications in process:
    if (notificator.maxConcurrents > notificator.numberCurrentRunning || notificator.maxConcurrents === 0) {
      // If the minimun time interval has past or there was not a previous execution:
      const timeDiff = process.hrtime(notificator.lastEndTime);
      const milisecondsDiff = (timeDiff[0] * 1000) + (timeDiff[1] / 1000000);

      if (notificator.lastEndTime === [0, 0] || (notificator.minInterval <= milisecondsDiff)) {
        let notifications = global.notificationsList[list];
        if (notifications && notifications.length) {
          const notification = notifications.shift();
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