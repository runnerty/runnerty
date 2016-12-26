"use strict";

var logger = require("../libs/utils.js").logger;

module.exports.exec = function executeWait(process){

  return new Promise(function(resolve, reject) {
    process.loadExecutorConfig()
      .then((configValues) => {

        process.execute_args = process.getArgs();
        var values = Object.assign(configValues, process.execute_arg);

        setTimeout(function(){
          process.end();
          resolve();
        }, values.seconds * 1000 || 0);

      })
      .catch(function(err){
        logger.log('error',`executeWait loadExecutorConfig: ${err}`);
        process.execute_err_return = `executeWait loadExecutorConfig: ${err}`;
        process.execute_return = '';
        process.error();
        reject(process);
      });
  });

};