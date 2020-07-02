'use strict';

const logger = require('./utils.js').logger;
const runtime = require('./classes/runtime');

async function sendNotification(list, notification, sender) {
  const notifier = runtime.notifierList[list];
  notifier.numberCurrentRunning = notifier.numberCurrentRunning + 1;
  try {
    await sender.sendMain(notification);
    notifier.lastEndTime = process.hrtime();
    notifier.numberCurrentRunning = notifier.numberCurrentRunning - 1;
    await checkNotificationsSends(list, sender);
  } catch (err) {
    logger.log('error', `Notification Sender error: ${err}`);
  }
}

async function checkNotificationsSends(list, sender) {
  const notifier = runtime.notifierList[list];

  if (notifier) {
    //If there are no notifications in process:
    if (notifier.maxConcurrents > notifier.numberCurrentRunning || notifier.maxConcurrents === 0) {
      // If the minimun time interval has past or there was not a previous execution:
      const timeDiff = process.hrtime(notifier.lastEndTime);
      const millisecondsDiff = timeDiff[0] * 1000 + timeDiff[1] / 1000000;

      if (notifier.lastEndTime === [0, 0] || notifier.minInterval <= millisecondsDiff) {
        const notifications = runtime.notificationsList[list];
        if (notifications && notifications.length) {
          const notification = notifications.shift();
          await sendNotification(list, notification, sender);
        }
      } else {
        // Retry when minInterval expire:
        setTimeout(() => {
          checkNotificationsSends(list, sender);
        }, notifier.minInterval - millisecondsDiff);
      }
    }
  }
}

async function queue(notification, notifToQueue, list) {
  // QUEUE MEMORY;
  // NOTIFICATOR: Create IF NOT EXISTS:
  if (!runtime.notifierList.hasOwnProperty(list)) {
    runtime.notifierList[list] = {
      notifierId: notification.id,
      minInterval: notifToQueue.minInterval || 0,
      maxConcurrents: notifToQueue.maxConcurrents || 1,
      numberCurrentRunning: 0,
      lastEndTime: [0, 0]
    };
  }
  // NOTIFICATIONS LIST: Create IF NOT EXISTS:
  if (!runtime.notificationsList.hasOwnProperty(list)) {
    runtime.notificationsList[list] = [];
  }
  runtime.notificationsList[list].push(notifToQueue);
  await checkNotificationsSends(list, notification);
}

module.exports.queue = queue;
