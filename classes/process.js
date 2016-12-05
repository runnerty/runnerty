"use strict";

var logger            = require("../libs/utils.js").logger;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var replaceWith       = require("../libs/utils.js").replaceWith;
var getChainByUId     = require("../libs/utils.js").getChainByUId;

var mysqlExecutor     = require("../libs/mysqlExecutor.js");
var postgresExecutor  = require("../libs/postgresExecutor.js");
var redisExecutor     = require("../libs/redisExecutor.js");
var shellExecutor     = require("../libs/shellExecutor.js");
var waitExecutor      = require("../libs/waitExecutor.js");
var crypto            = require('crypto');

var bytes             = require("bytes");
var fs                = require('fs');

var Event = require("./event.js");

class Process {
  constructor(id, name, parentUId, depends_process, depends_process_alt, exec, args, retries, retry_delay, limited_time_end, end_on_fail, end_chain_on_fail, events, status, execute_return, execute_err_return, started_at, ended_at, output, output_iterable, output_share, chain_values){
    this.id = id;
    this.name = name;
    this.uId;
    this.parentUId = parentUId;
    this.depends_process = depends_process;
    this.depends_process_alt = depends_process_alt;
    this.exec = exec;
    this.args = args;
    this.retries = retries;
    this.retry_delay = retry_delay;
    this.limited_time_end = limited_time_end;
    this.end_on_fail = end_on_fail || false;
    this.end_chain_on_fail = end_chain_on_fail || false;
    this.output = output;
    this.output_iterable = output_iterable;
    this.output_share = output_share;

    //Runtime attributes:
    this.status = status || "stop";
    this.execute_return = execute_return;
    this.execute_err_return = execute_err_return;
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.events;

    this.chain_values = chain_values;

    return new Promise((resolve) => {
      var _this = this;
      _this.setUid()
        .then(() => {
          _this.loadEvents(events)
           .then((events) => {
             _this.events = events;
             resolve(this);
           })
           .catch(function(e){
             logger.log('error','Process constructor loadEvents:'+e);
              resolve(this);
           });
        })
        .catch(function(err){
          logger.log('error',`Chain ${_this.id} setUid: `+err);
          resolve();
        });
    });
  }

  setUid(){
    var _this = this;
    return new Promise((resolve) => {
        crypto.randomBytes(16, function(err, buffer) {
        _this.uId = _this.id + '_' + buffer.toString('hex');
        resolve();
      });
  });
  }

  values(){
    var _this = this;
    var process_values = {
      "CHAIN_ID":_this.chain_values.CHAIN_ID,
      "CHAIN_NAME":_this.chain_values.CHAIN_NAME,
      "CHAIN_STARTED_AT":_this.chain_values.CHAIN_STARTED_AT,
      "PROCESS_ID":_this.id,
      "PROCESS_NAME":_this.name,
      "PROCESS_EXEC_COMMAND":(_this.exec instanceof Object)? _this.exec.command : _this.exec,
      "PROCESS_EXEC_DB_CONNECTION_ID":(_this.exec instanceof Object)? _this.exec.db_connection_id : '',
      "PROCESS_EXEC_COMMAND_EXECUTED": _this.command_executed,
      "PROCESS_ARGS":_this.args,
      "PROCESS_EXEC_ARGS":_this.execute_args,
      "PROCESS_EXEC_RETURN":_this.execute_return,
      "PROCESS_EXEC_ERR_RETURN":_this.execute_err_return,
      "PROCESS_STARTED_AT":_this.started_at,
      "PROCESS_ENDED_AT":_this.ended_at,
      "PROCESS_RETRIES_COUNT": _this.retries_count,
      "PROCESS_RETRIES": _this.retries,
      "PROCESS_DEPENDS_FILES_READY": _this.depends_files_ready,
      "PROCESS_FIRST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[0] : [],
      "PROCESS_LAST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[_this.depends_files_ready.length - 1] : [],
      "PROCESS_EXEC_DB_RETURN":_this.execute_db_results,
      "PROCESS_EXEC_DB_RETURN_CSV":_this.execute_db_results_csv,
      "PROCESS_EXEC_DB_RETURN_FIRSTROW": {},
      "PROCESS_EXEC_DB_FIELDCOUNT":_this.execute_db_fieldCount,
      "PROCESS_EXEC_DB_AFFECTEDROWS":_this.execute_db_affectedRows,
      "PROCESS_EXEC_DB_CHANGEDROWS":_this.execute_db_changedRows,
      "PROCESS_EXEC_DB_INSERTID":_this.execute_db_insertId,
      "PROCESS_EXEC_DB_WARNINGCOUNT":_this.execute_db_warningCount,
      "PROCESS_EXEC_DB_MESSAGE":_this.execute_db_message
    };

    if(_this.execute_db_results_object && _this.execute_db_results_object.length) {
      process_values["PROCESS_EXEC_DB_RETURN_FIRSTROW"] = _this.execute_db_results_object[0];

      if (_this.execute_db_results_object[0] instanceof Object) {
        var keys = Object.keys(_this.execute_db_results_object[0]);
        var keysLength = keys.length;
        while (keysLength--) {
          var key = keys[keysLength];
          process_values["PROCESS_EXEC_DB_RETURN_FIRSTROW_" + [key.toUpperCase()]] = _this.execute_db_results_object[0][key];
        }
      }
    }

    var values = Object.assign(process_values, _this.execute_input);
    return values;
  }

  loadEvents(events){
    var _this = this;
    return new Promise((resolve) => {
        var processEventsPromises = [];

    if (events instanceof Object) {
      var keys = Object.keys(events);
      var keysLength = keys.length;
      if (keys  instanceof Array) {
        if (keysLength > 0) {
          while (keysLength--) {
            var event = events[keys[keysLength]];
            if(event.hasOwnProperty('notifications')){
              processEventsPromises.push(new Event(keys[keysLength],
                event.process,
                event.notifications
              ));
            }else{
              //logger.log('debug','Process Events without notifications');
            }
          }

          Promise.all(processEventsPromises)
            .then(function (eventsArr) {
              var events = {};
              var eventsArrLength = eventsArr.length;
              while (eventsArrLength--) {
                var e = eventsArr[eventsArrLength];
                var key = Object.keys(e);
                events[key[0]] = e[key[0]];
              }
              resolve(events);
            })
            .catch(function(e){
              logger.log('error','Process loadEvents: '+e);
              resolve();
            });
        }
      }
    }else{
      logger.log('error','Process, events is not object', err);
      resolve();
    }
  });
  }

  loadDbConfig(){
    var _this = this;

    return loadConfigSection(global.config, 'db_connections', _this.exec.db_connection_id);
  }

  notificate(event){
    var _this = this;

    if(_this.hasOwnProperty('events') && _this.events !== undefined){
      if(_this.events.hasOwnProperty(event)){
        if(_this.events[event].hasOwnProperty('notifications')){
          if(_this.events[event].notifications instanceof Array){
            var notificationsLength = _this.events[event].notifications.length;
            while(notificationsLength--){
              _this.events[event].notifications[notificationsLength].notificate(_this.values())
                .then(function(res){
                })
                .catch(function(e){
                  logger.log('error',`Notificating ${event} process ${_this.id}:`+e)
                })
            }
          }
        }
      }
    }
  }

  isStopped(){
    return (this.status === 'stop');
  }

  isEnded(){
    return (this.status === 'end');
  }

  isRunning(){
    return (this.status === 'running');
  }

  isErrored(){
    return (this.status === 'error');
  }

  stop(){
    var _this = this;
    _this.status = 'stop';
    _this.ended_at = new Date();
  }

  end(noRunned){
    var _this = this;
    noRunned = noRunned || false; // If process has not been executed but we need set to end

    _this.status = 'end';
    _this.ended_at = new Date();

    //Clear depends_files_ready for re-check:
    _this.depends_files_ready = [];

    if(!noRunned){
      _this.notificate('on_end');
    }

    _this.setOutputShare();
  }

  endChildChains(){
    var _this = this;

    _this.notificate('on_end_childs');
    _this.childs_chains_status = 'end';

    var globalPlanChains = global.runtimePlan.plan.chains;
    var chainParentFound = getChainByUId(globalPlanChains, _this.parentUId);

    if(chainParentFound){
      chainParentFound.refreshChainStatus()
        .then(function(chainStatus){
        })
        .catch(function(e){
          logger.log('error','Error in process refreshChainStatus:'+e);
        });

    }
  }

  startChildChains(){
    var _this = this;
    _this.notificate('on_start_childs');
    _this.childs_chains_status = 'running';
  }

  startChildChainsDependients(waitEndChilds){
    var _this = this;

    return new Promise(function(resolve, reject) {

      var chainsLength = global.runtimePlan.plan.chains.length;
      var chainsToRun = [];

      while(chainsLength--){
        var itemChain = global.runtimePlan.plan.chains[chainsLength];
        var procValues = _this.values();

        if(itemChain.hasOwnProperty('depends_chains') && itemChain.depends_chains.hasOwnProperty('chain_id') && itemChain.depends_chains.hasOwnProperty('process_id') && itemChain.depends_chains.chain_id === procValues.CHAIN_ID && itemChain.depends_chains.process_id === _this.id){
          if(itemChain.isEnded()){
            itemChain.status = 'stop';
          }
          var executeInmediate = true;
          chainsToRun.push(global.runtimePlan.plan.scheduleChain(itemChain, _this, executeInmediate));
        }
      }

      if(chainsToRun.length){
        _this.startChildChains();

        Promise.all(chainsToRun)
          .then(function () {
            resolve();
          })
          .catch(function(e){
            logger.log('error','Process startChildChainsDependients: '+e);
            resolve();
          });

      }else{
        resolve();
      }

    });
  }

  refreshProcessChildsChainsStatus(){
    var _this = this;

    return new Promise((resolve) => {
      var childsChainsLength = _this.childs_chains.length;
      var statusChildsChains = 'end';

    var chainsError   = 0;
    var chainsEnd     = 0;
    var chainsRunning = 0;
    var chainsStop    = 0;

    while(childsChainsLength--) {
      switch (_this.childs_chains[childsChainsLength].status)
      {
        case 'stop'   : chainsStop += 1;    break;
        case 'end'    : chainsEnd += 1;     break;
        case 'running': chainsRunning += 1; break;
        case 'error'  : chainsError += 1;   break;
      }
    }

    if (chainsRunning > 0 || chainsStop > 0){
      statusChildsChains = 'running';
    }else{
      if (chainsError > 0){
        statusChildsChains = 'error';
      }else{
        statusChildsChains = 'end';
      }
    }

    _this.childs_chains_status = statusChildsChains;
    resolve(statusChildsChains);
  });
  }

  setOutputShare(){
    var _this = this;

    if(_this.hasOwnProperty('output_share') && _this.output_share){

      _this.output_share.forEach(function(gVar){
        var values = _this.values();
        var oh = {};

        var key   = replaceWith(gVar.key, values).toUpperCase();
        var name  = replaceWith(gVar.name, values).toUpperCase();
        var value = replaceWith(gVar.value, values);

        oh[key] = {};
        oh[key][name] = value;

        global.config.global_values.push(oh);
      })
    }
  }

  error(){
    var _this = this;
    _this.status = 'error';
    _this.notificate('on_fail');
  }

  retry(){
    var _this = this;
    _this.notificate('on_retry');
  }

  waiting_dependencies(){
    var _this = this;
    _this.notificate('on_waiting_dependencies');
  }

  start(isRetry, forceOnceInRetry){
    var _this = this;
    _this.status = 'running';
    _this.started_at = new Date();

    if(!isRetry || isRetry === undefined){
      _this.notificate('on_start');
    }

    // forceOnceInRetry: this indicates that only try once in retry
    if(!forceOnceInRetry || forceOnceInRetry === undefined){
      forceOnceInRetry = false;
    }

    return new Promise(function(resolve, reject) {

      if(typeof _this.exec === 'string' || (!_this.exec.db_connection_id && !_this.exec.wait)){
        resolve(shellExecutor.exec(_this));
      }else {
        if(_this.exec.db_connection_id){
          _this.loadDbConfig()
            .then((configValues) => {
              if(configValues.type){
                switch (configValues.type) {
                  case 'mysql':
                    resolve(mysqlExecutor.exec(_this));
                    break;
                  case 'postgres':
                    resolve(postgresExecutor.exec(_this));
                    break;
                  case 'redis':
                    resolve(redisExecutor.exec(_this));
                    break;
                  default:
                    logger.log('error',`DBConnection ${_this.exec.db_connection_id} type is not valid`);
                    _this.execute_err_return = `DBConnection ${_this.exec.db_connection_id} type is not valid`;
                    _this.execute_return = '';
                    _this.error();
                    _this.write_output();
                    reject(_this, `DBConnection ${_this.exec.db_connection_id} type is not valid`);
                    break;
                }
              }else{
                logger.log('error',`DBConnection ${_this.exec.db_connection_id} doesn't have type`);
                _this.execute_err_return = `DBConnection ${_this.exec.db_connection_id} doesn't have type`;
                _this.execute_return = '';
                _this.error();
                _this.write_output();
                reject(_this, `DBConnection ${_this.exec.db_connection_id} doesn't have type`);
              }
            })
            .catch(function(err){
              logger.log('error',`Procces start loadDbConfig: ${err}`);
              _this.execute_err_return = `Procces start loadDbConfig: ${err}`;
              _this.execute_return = '';
              _this.error();
              _this.write_output();
              reject(_this, err);
              });
        }else{
          if(_this.exec.wait){
            resolve(waitExecutor.exec(_this));
          }else{
            reject(_this, `Incorrect exec ${_this.exec}`);
          }
        }
      }
    });
  }

  write_output(){
    var _this = this;

    function repArg(arg){
      return replaceWith(arg, _this.values());
    }

    function writeFile(filePath, mode, os){
      fs.open(filePath, mode, (err, fd) => {
        if(err){
          logger.log('error',`Writing output, open file ${filePath} in ${_this.id}: `,err);
        }else{
          fs.write(fd, os, null, 'utf8', function(){
          fs.close(fd, function(err){
            if(err){
              logger.log('error',`Closing file ${filePath} in writeFile in ${_this.id}: `,err);
            }
          });
        });
        }
    });
    }

    function generateOutput(output){

      if(output && output.file_name && output.write.length > 0){

        var filePath = replaceWith(output.file_name, _this.values());
        var output_stream = output.write.map(repArg).filter(Boolean).join("\n");

        if(output.maxsize) {
          var maxSizeBytes = bytes(output.maxsize);
          var output_stream_length = output_stream.length;

          if(output_stream_length > maxSizeBytes){
            output_stream = output_stream.slice(output_stream_length - maxSizeBytes,output_stream_length);
            output_stream_length = maxSizeBytes;
            logger.log('debug',`output_stream truncated output_stream_length (${output_stream_length}) > maxSizeBytes (${maxSizeBytes})`);
          }
        }

        if(output.concat){
          if(output.maxsize){
            fs.stat(filePath, function(error, stats) {

              var fileSizeInBytes = 0;
              if(!error){
                fileSizeInBytes = stats.size;
              }
              //SI LA SUMA DEL TAMAÑO DEL FICHERO Y EL OUTPUT A ESCRIBIR DEL PROCESO SUPERAN EL MAXIMO PERMITIDO
              var totalSizeToWrite = fileSizeInBytes + output_stream_length;

              if(totalSizeToWrite > maxSizeBytes){
                //SE OBTIENE LA PARTE DEL FICHERO QUE JUNTO CON EL OUTPUT SUMAN EL TOTAL PERMITIDO PARA ESCRIBIRLO (SUSTIUYENDO EL FICHERO)
                var positionFileRead   =  (totalSizeToWrite) - maxSizeBytes;
                var lengthFileRead =  (fileSizeInBytes) - positionFileRead;

                fs.open(filePath, 'r', function(error, fd) {
                  if(lengthFileRead > 0){
                    var buffer = new Buffer(lengthFileRead);

                    fs.read(fd, buffer, 0, buffer.length, positionFileRead, function(error, bytesRead, buffer) {
                      var data = buffer.toString("utf8", 0, buffer.length);
                      data = data.concat("\n",output_stream);
                      fs.close(fd, function(err){
                        if(err){
                          logger.log('error',`Closing file ${filePath} in ${_this.id}: `,err);
                        }
                        writeFile(filePath, 'w', data);
                      });
                    });
                  }else{
                    //SI NO SE VA A ESCRIBIR NADA DEL FICHERO ACTUAL
                    writeFile(filePath, 'w', output_stream);
                  }
                });
              }else{
                writeFile(filePath, 'a+', output_stream);
              }
            });
          }else{
            writeFile(filePath, 'a+', output_stream);
          }

        }else{
          writeFile(filePath, 'w+', output_stream);
        }
      }
    }

    if(_this.output instanceof Array){
      var outputCountItems = _this.output.length;

      while(outputCountItems--){
        generateOutput(_this.output[outputCountItems]);
      }
    }else{
      generateOutput(_this.output);
    }

  }
}

module.exports = Process;