'use strict';

const { createLogger, format, transports } = require('winston');
const debugMode = process.env.RUNNERTY_DEBUG == 'true';
const testMode = process.env.RUNNERTY_TEST == 'true';
let _format;

if (testMode) {
  _format = format.simple();
} else {
  _format = format.combine(format.colorize({ all: true }), format.splat(), format.simple());
}

const logger = createLogger({
  format: _format,
  transports: [
    new transports.Console({
      level: debugMode ? 'debug' : 'info'
    })
  ]
});

module.exports = logger;
