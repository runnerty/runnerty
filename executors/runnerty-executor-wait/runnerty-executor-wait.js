"use strict";

var Execution = require("../../classes/execution.js");

class waitExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {
          var seconds = 60;

          if (res.seconds) {
            seconds = res.seconds;
          }

          setTimeout(function () {
            process.end();
            resolve();
          }, seconds * 1000 || 0);
        })
        .catch((err) => {
          _this.logger.log('error', `Wait Error getValues: ${err}`);
          process.execute_err_return = `Wait Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = waitExecutor;