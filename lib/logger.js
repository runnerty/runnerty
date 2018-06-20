"use strict";

const winston = require("winston");
const debugMode = (process.env.RUNNERTY_DEBUG == "true");
const testMode = (process.env.RUNNERTY_TEST == "true");

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({colorize:(testMode)?false:"all", level: (debugMode)?"debug":"info"})
  ]
});

module.exports = logger;