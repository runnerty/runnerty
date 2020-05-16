'use strict';

const logger = require('./utils.js').logger;

async function sendNotification(list, notification, sender, redisCli) {
  const notifier = global.notifierList[list];
  notifier.numberCurrentRunning = notifier.numberCurrentRunning + 1;
  try {
    await sender.sendMain(notification);
    notifier.lastEndTime = process.hrtime();
    notifier.numberCurrentRunning = notifier.numberCurrentRunning - 1;
    await checkNotificationsSends(list, sender, redisCli);
  } catch (err) {
    logger.log('error', `Notification Sender error: ${err}`);
  }
}

async function checkNotificationsSends(list, sender, redisCli) {
  const notifier = global.notifierList[list];

  if (notifier) {
    //If there are no notifications in process:
    if (notifier.maxConcurrents > notifier.numberCurrentRunning || notifier.maxConcurrents === 0) {
      // If the minimun time interval has past or there was not a previous execution:
      const timeDiff = process.hrtime(notifier.lastEndTime);
      const millisecondsDiff = timeDiff[0] * 1000 + timeDiff[1] / 1000000;

      if (notifier.lastEndTime === [0, 0] || notifier.minInterval <= millisecondsDiff) {
        const notificationsList = 'R' + '_NOTIFICATIONS_' + list;
        redisCli.lpop(notificationsList, async (err, res) => {
          if (err) throw err;
          if (res) {
            try {
              const notification = JSON.parse(res);
              await sendNotification(list, notification, sender, redisCli);
            } catch (err) {
              logger.log('error', `Notification Redis Notifications PARSE LPOP: ${err}`);
            }
          }
        });
      } else {
        // Retry when minInterval expire:
        setTimeout(() => {
          checkNotificationsSends(list, sender, redisCli);
        }, notifier.minInterval - millisecondsDiff);
      }
    }
  }
}

async function queue(notification, notifToQueue, list) {
  const notificationsList = 'R' + '_NOTIFICATIONS_' + list;
  const redisCli = global.queueRedisCli;

  // QUEUE MEMORY;
  // NOTIFICATOR: Create IF NOT EXISTS:
  if (!global.notifierList.hasOwnProperty(list)) {
    global.notifierList[list] = {
      notifierId: notification.id,
      minInterval: notifToQueue.minInterval || 0,
      maxConcurrents: notifToQueue.maxConcurrents || 1,
      numberCurrentRunning: 0,
      lastEndTime: [0, 0]
    };
  }

  // NOTIFICATIONS:
  redisCli.rpush(notificationsList, JSON.stringify(notifToQueue), async err => {
    if (err) {
      logger.log('error', 'Notification Redis Notifications RPUSH:', err);
    } else {
      await checkNotificationsSends(list, notification, redisCli);
    }
  });
}

module.exports.queue = queue;
