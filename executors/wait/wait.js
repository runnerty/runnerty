"use strict";

var Execution = require("../../classes/execution.js");

class waitExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      process.loadExecutorConfig()
        .then((configValues) => {

          var seconds = 60;

          if (process.exec.seconds) {
            if (typeof process.exec.seconds === 'string') {
              seconds = _this.replaceWith(process.exec.seconds, process.values());
            } else {
              seconds = process.exec.seconds;
            }
          } else {
            if (configValues.seconds) {
              if (typeof configValues.seconds === 'string') {
                seconds = _this.replaceWith(configValues.seconds, process.values());
              } else {
                seconds = configValues.seconds;
              }
            }
          }

          setTimeout(function () {
            process.end();
            resolve();
          }, seconds * 1000 || 0);

        })
        .catch(function (err) {
          _this.logger.log('error', `executeWait loadExecutorConfig: ${err}`);
          process.execute_err_return = `executeWait loadExecutorConfig: ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });

  }
}

module.exports = waitExecutor;