'use strict';
class runtime {
  static plan;
  static config;
  static servers = {};
  static processQueues = [];
  static notifierList = {};
  static notificationsList = {};
  static calendars = {};
  static queueRedisCli;
  static cryptoPassword;
  static executors = {};
  static notifiers = {};
  static triggers = {};
  static forcedInitChainsIds;
  static endOnforcedInitChainsIds;
}

module.exports = runtime;
