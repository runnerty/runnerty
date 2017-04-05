"use strict";

var Execution = global.ExecutionClass;

class iterableExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;
    var endOptions = {end: 'end'};

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          endOptions.end = 'end';
          endOptions.execute_return = JSON.stringify(res.objects);
          _this.end(endOptions, resolve, reject);
        })
        .catch((err) => {
          endOptions.end = 'error';
          endOptions.messageLog = `ITERABLE Error getValues: ${err}`;
          endOptions.execute_err_return = `ITERABLE Error getValues: ${err}`;
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = iterableExecutor;