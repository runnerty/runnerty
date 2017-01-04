"use strict";

var logger = require("../../libs/utils.js").logger;
var replaceWith = require("../../libs/utils.js").replaceWith;

module.exports.exec = function executeWait(process){

  return new Promise(function(resolve, reject) {
    process.loadExecutorConfig()
      .then((configValues) => {

        var seconds = 60;

        if(process.exec.seconds){
          if(typeof process.exec.seconds === 'string'){
            seconds = replaceWith(process.exec.seconds, process.values());
          }else{
            seconds = process.exec.seconds;
          }
        }else{
          if (configValues.seconds){
            if(typeof configValues.seconds === 'string'){
              seconds = replaceWith(configValues.seconds, process.values());
            }else{
              seconds = configValues.seconds;
            }
          }
        }

        setTimeout(function(){
          process.end();
          resolve();
        }, seconds * 1000 || 0);

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