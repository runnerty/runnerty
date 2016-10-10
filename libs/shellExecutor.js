"use strict";

var spawn             = require("child_process").spawn;

var logger            = require("../libs/utils.js").logger;
var csv               = require("fast-csv");
var loadSQLFile       = require("../libs/utils.js").loadSQLFile;
var replaceWith       = require("../libs/utils.js").replaceWith;

module.exports.exec = function executeCommand(process){

  var cmd = process.exec.command;
  return new Promise(function(resolve, reject) {
    var stdout = '';
    var stderr = '';

    function repArg(arg){
      return replaceWith(arg, process.values());
    }
    process.execute_args = process.args.map(repArg);

    process.proc = spawn(cmd, process.execute_args, { shell:true });

    process.proc.stdout.on('data', function(chunk) {
      stdout += chunk;
    });
    process.proc.stderr.on('data', function(chunk) {
      stderr += chunk;
    });
    process.proc
      .on('error', function(){
        //reject();
      })
      .on('close', function(code) {
        if (code === 0) {
          process.execute_return = stdout;
          process.execute_err_return = stderr;
          process.end();
          process.write_output();
          resolve(stdout);
        } else {
          logger.log('error',process.id+' FIN: '+code+' - '+stdout+' - '+stderr);

          process.execute_return = stdout;
          process.execute_err_return = stderr;
          process.retries_count = process.retries_count +1 || 1;
          process.error();
          process.write_output();

          if(process.retries >= process.retries_count && !forceOnceInRetry){

            process.retry();

            setTimeout(function(){
              process.start(true)
                .then(function(res) {
                  process.retries_count = 0;
                  resolve(res);
                })
                .catch(function(e){
                  logger.log('error','Retrying process:'+e)
                  resolve(e);
                });
            }, process.retry_delay * 1000 || 0);

          }else{
            if (process.end_on_fail){
              process.end();
              process.write_output();
            }
            reject(process, stderr);
          }
        }
      });
  });
};