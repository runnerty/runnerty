"use strict";

var Execution = require("../../classes/execution.js");

class waitExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          var seconds = 60;

          if (res.seconds) {
            seconds = res.seconds;
          }

          setTimeout(function () {
            var endOptions = {
              end: 'end'
            };
            _this.end(endOptions, resolve, reject);
          }, seconds * 1000 || 0);
        })
        .catch((err) => {
          var endOptions = {
            end: 'error',
            messageLog: `Wait Error getValues: ${err}`,
            execute_err_return: `Wait Error getValues: ${err}`
          };
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = waitExecutor;