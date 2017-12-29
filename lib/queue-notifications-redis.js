"use strict";

const logger = require("./utils.js").logger;

function sendNotification(list, notification, sender, redisCli) {
  let notificator = global.notificatorList[list];
  notificator.numberCurrentRunning = notificator.numberCurrentRunning + 1;
  sender.sendMain(notification)
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
  let notificator = global.notificatorList[list];

  if (notificator) {
    //If there are no notifications in process:
    if (notificator.maxConcurrents > notificator.numberCurrentRunning || notificator.maxConcurrents === 0) {
      // If the minimun time interval has past or there was not a previous execution:
      const timeDiff = process.hrtime(notificator.lastEndTime);
      const milisecondsDiff = (timeDiff[0] * 1000) + (timeDiff[1] / 1000000);

      if (notificator.lastEndTime === [0, 0] || (notificator.minInterval <= milisecondsDiff)) {
        const notificationsList = "R" + "_NOTIFICATIONS_" + list;
        redisCli.lpop(notificationsList, (err, res) => {
          if (res) {
            try {
              const notification = JSON.parse(res);
              sendNotification(list, notification, sender, redisCli);
            } catch (err) {
              logger.log("error", `Notification Redis Notifications PARSE LPOP: ${err}`);
            }
          }
        });
      } else {
        // Retry when minInterval expire:
        setTimeout(() => {
          checkNotificationsSends(list, sender, redisCli);
        }, (notificator.minInterval - milisecondsDiff));
      }
    }
  }
}

function queue(notification, notifToQueue, list) {
  const notificationsList = "R" + "_NOTIFICATIONS_" + list;
  let redisCli = global.queueRedisCli;

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
  redisCli.rpush(notificationsList, JSON.stringify(notifToQueue), (err) => {
    if (err) {
      logger.log("error", "Notification Redis Notifications RPUSH:", err);
    } else {
      checkNotificationsSends(list, notification, redisCli);
    }
  });
}

module.exports.queue = queue;