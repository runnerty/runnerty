"use strict";

var logger            = require("../libs/utils.js").logger;
var loadConfigSection = require("../libs/utils.js").loadConfigSection;
var loadSQLFile       = require("../libs/utils.js").loadSQLFile;
var replaceWith       = require("../libs/utils.js").replaceWith;
var spawn             = require("child_process").spawn;
var mysql             = require("mysql");
var pg                = require('pg'); //PostgreSQL
var redis             = require('redis');
var bytes             = require("bytes");
var csv               = require("fast-csv");
var fs                = require('fs');

var Event = require("./event.js");

class Process {
  constructor(id, name, depends_process, depends_process_alt, exec, args, retries, retry_delay, limited_time_end, end_on_fail, end_chain_on_fail, events, status, execute_return, execute_err_return, started_at, ended_at, output, output_iterable, chain_values){
    this.id = id;
    this.name = name;
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

    //Runtime attributes:
    this.status = status || "stop";
    this.execute_return = execute_return;
    this.execute_err_return = execute_err_return;
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.events;

    this.chain_values = chain_values;

    return new Promise((resolve) => {
      this.loadEvents(events)
      .then((events) => {
      this.events = events;
    resolve(this);
  })
  .catch(function(e){
      logger.log('error','Process constructor loadEvents:'+e);
      resolve(this);
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
      "PROCESS_EXEC":_this.exec,
      "PROCESS_ARGS":_this.args,
      "PROCESS_EXECURTE_ARGS":_this.execute_args,
      "PROCESS_EXECUTE_RETURN":_this.execute_return,
      "PROCESS_EXECUTE_ERR_RETURN":_this.execute_err_return,
      "PROCESS_STARTED_AT":_this.started_at,
      "PROCESS_ENDED_AT":_this.ended_at,
      "PROCESS_RETRIES_COUNT": _this.retries_count,
      "PROCESS_RETRIES": _this.retries,
      "PROCESS_DEPENDS_FILES_READY": _this.depends_files_ready,
      "PROCESS_FIRST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[0] : [],
      "PROCESS_LAST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[_this.depends_files_ready.length - 1] : [],
      "PROCESS_EXEC_DB_RESULTS":_this.execute_db_results,
      "PROCESS_EXEC_DB_RESULTS_CSV":_this.execute_db_results_csv,
      "PROCESS_EXEC_DB_FIELDCOUNT":_this.execute_db_fieldCount,
      "PROCESS_EXEC_DB_AFFECTEDROWS":_this.execute_db_affectedRows,
      "PROCESS_EXEC_DB_CHANGEDROWS":_this.execute_db_changedRows,
      "PROCESS_EXEC_DB_INSERTID":_this.execute_db_insertId,
      "PROCESS_EXEC_DB_WARNINGCOUNT":_this.execute_db_warningCount,
      "PROCESS_EXEC_DB_MESSAGE":_this.execute_db_message
    };

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
              logger.log('debug','Process Events without notifications');
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

  isStoped(){
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

    noRunned = noRunned || false; // If process has not been executed but we need set to end

    var _this = this;
    _this.status = 'end';
    _this.ended_at = new Date();

    //Clear depends_files_ready for re-check:
    _this.depends_files_ready = [];

    if(!noRunned){
      _this.notificate('on_end');
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

      if(typeof _this.exec === 'string' || !_this.exec.db_connection_id){
        resolve(_this.executeCommand(_this.exec.command));
      }else {

        _this.loadDbConfig()
            .then((configValues) => {
            if(configValues.type){
              switch (configValues.type) {
                case 'mysql':
                  resolve(_this.executeMysql());
                  break;
                case 'postgres':
                  resolve(_this.executePostgre());
                  break;
                case 'redis':
                  resolve(_this.executeRedis());
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
      }

    });
  }

  executeCommand(cmd){
    var _this = this;
    return new Promise(function(resolve, reject) {
      var stdout = '';
      var stderr = '';

      function repArg(arg){
        return replaceWith(arg, _this.values());
      }
      _this.execute_args = _this.args.map(repArg);

      _this.proc = spawn(cmd, _this.execute_args, { shell:true });

      _this.proc.stdout.on('data', function(chunk) {
        stdout += chunk;
      });
      _this.proc.stderr.on('data', function(chunk) {
        stderr += chunk;
      });
      _this.proc
        .on('error', function(){
          //reject();
        })
        .on('close', function(code) {
          if (code === 0) {
            _this.execute_return = stdout;
            _this.execute_err_return = stderr;
            _this.end();
            _this.write_output();
            resolve(stdout);
          } else {
            logger.log('error',_this.id+' FIN: '+code+' - '+stdout+' - '+stderr);

            _this.execute_return = stdout;
            _this.execute_err_return = stderr;
            _this.retries_count = _this.retries_count +1 || 1;
            _this.error();
            _this.write_output();

            if(_this.retries >= _this.retries_count && !forceOnceInRetry){

              _this.retry();

              setTimeout(function(){
                _this.start(true)
                  .then(function(res) {
                    _this.retries_count = 0;
                    resolve(res);
                  })
                  .catch(function(e){
                    logger.log('error','Retrying process:'+e)
                    resolve(e);
                  });
              }, _this.retry_delay * 1000 || 0);

            }else{
              if (_this.end_on_fail){
                _this.end();
                _this.write_output();
              }
              reject(_this, stderr);
            }
          }
        });
    });
  }

  executeMysql(){
    var _this = this;

    function executeQuery(_this, configValues){

      return new Promise(function(resolve, reject) {

        _this.execute_arg = _this.args

        var connection = mysql.createConnection({
          host: configValues.host,
          user: configValues.user,
          password: configValues.password,
          database: configValues.database,
          socketPath: configValues.socketPath,
          port: configValues.port,
          ssl: configValues.ssl,
          queryFormat: function (query, values) {
            if (!values) return query.replace(/(\:\/)/g, ':');
            else {
              var _query = query.replace(/\:(\w+)/g, function (txt, key) {
                return values && key && values.hasOwnProperty(key)
                  ? this.escape(replaceWith(values[key], _this.values()))
                  : null;
              }.bind(this)).replace(/(\:\/)/g, ':');
            }
            return _query;
          }
        });

        connection.connect(function (err) {
          if (err) {
            logger.log('error', 'Error connecting Mysql: ' + err)
            _this.execute_return = '';
            _this.execute_err_return = 'Error connecting Mysql: ' + err;
            _this.retries_count = _this.retries_count +1 || 1;
            reject(err);
          } else {

            connection.query(_this.exec.command, _this.execute_arg, function (err, results) {
              if (err) {
                logger.log('error', `executeMysql query ${_this.exec.command}: ${err}`);
                _this.execute_err_return = `executeMysql query ${_this.exec.command}: ${err}`;
                reject(err);
              } else {

                if (results instanceof Array) {

                  _this.execute_db_results = JSON.stringify(results);
                  csv.writeToString(results, {headers: true}, function (err, data) {
                    if (err) {
                      logger.log('error', `Generating csv output for execute_db_results_csv. id: ${_this.id}: ${err}. Results: ${results}`);
                    } else {
                      _this.execute_db_results_csv = data;
                    }
                    resolve();
                  });

                } else {

                  if (results instanceof Object) {
                    _this.execute_db_results = '';
                    _this.execute_db_results_csv = '';
                    _this.execute_db_fieldCount = results.fieldCount;
                    _this.execute_db_affectedRows = results.affectedRows;
                    _this.execute_db_changedRows = results.changedRows;
                    _this.execute_db_insertId = results.insertId;
                    _this.execute_db_warningCount = results.warningCount;
                    _this.execute_db_message = results.message;
                  }
                  resolve();
                }
              }
            });
            connection.end();
          }
        });
      });
    }

    return new Promise(function(resolve, reject) {

      if(_this.exec.db_connection_id){
        _this.loadDbConfig()
          .then((configValues) => {
            if(!_this.exec.command){
              if(!_this.exec.file_name){
                logger.log('error',`executeMysql dont have command or file_name`);
                _this.execute_err_return = `executeMysql dont have command or file_name`;
                _this.execute_return = '';
                _this.error();
                _this.write_output();
                reject(`executeMysql dont have command or file_name`);
              }else{
                loadSQLFile(_this.exec.file_name)
                  .then((fileContent) => {
                    _this.exec.command = fileContent;
                    executeQuery(_this, configValues)
                      .then((res) => {
                      _this.execute_return = '';
                      _this.execute_err_return = '';
                      _this.end();
                      _this.write_output();
                      resolve();
                    })
                    .catch(function(err){
                        logger.log('error',`executeMysql executeQuery from file: ${err}`);
                        _this.execute_err_return = `executeMysql executeQuery from file: ${err}`;
                        _this.execute_return = '';
                        _this.error();
                        _this.write_output();
                        reject(_this, err);
                      });
                  })
                  .catch(function(err){
                    logger.log('error',`executeMysql loadSQLFile: ${err}`);
                    _this.execute_err_return = `executeMysql loadSQLFile: ${err}`;
                    _this.execute_return = '';
                    _this.error();
                    _this.write_output();
                    reject(_this, err);
                   });
              }
            }else{
              executeQuery(_this, configValues)
                .then((res) => {
                _this.execute_return = '';
                _this.execute_err_return = '';
                _this.end();
                _this.write_output();
                resolve();
              })
              .catch(function(err){
                  logger.log('error',`executeMysql executeQuery: ${err}`);
                  _this.execute_err_return = `executeMysql executeQuery: ${err}`;
                  _this.execute_return = '';
                  _this.error();
                  _this.write_output();
                  reject(_this, err);
                });
            }
      })
      .catch(function(err){
          logger.log('error',`executeMysql loadDbConfig: ${err}`);
          _this.execute_err_return = `executeMysql loadDbConfig: ${err}`;
          _this.execute_return = '';
          _this.error();
          _this.write_output();
          reject(_this, err);
        });

      }else{
        logger.log('error',`db_connection_id not set for ${_this.id}`);
        _this.execute_err_return = `db_connection_id not set for ${_this.id}`;
        _this.execute_return = '';
        _this.error();
        _this.write_output();
        reject(_this);
      }
    });
  }

  executePostgre(){
    var _this = this;

    function queryFormat(query, values) {
      if (!values) return query.replace(/(\:\/)/g,':');
      else {
        var _query = query.replace(/\:(\w+)/g, function (txt, key) {
          return values && key && values.hasOwnProperty(key)
            ? escape(replaceWith(values[key],_this.values()))
            : null;
        }.bind(this)).replace(/(\:\/)/g,':');
      }
      return _query;
    }

    function executeQuery(_this, configValues){
      return new Promise(function(resolve, reject) {

        _this.execute_arg = _this.args

        var client = new pg.Client({
          user     : configValues.user,
          password : configValues.password,
          database : configValues.database,
          host     : configValues.host || configValues.socketPath,
          port     : configValues.port
        });
        client.connect(function(err) {
          if(err) {
            logger.log('error',`Could not connect to Postgre: `+err);

            reject(err);
          }else{
            var finalQuery = queryFormat(_this.exec.command, _this.execute_arg);

            client.query(finalQuery, null, function(err, results){
              if(err){
                logger.log('error',`Error query Postgre (${finalQuery}): `+err);

                reject(`Error query Postgre (${finalQuery}): `+err);
              }else{
                if(results.hasOwnProperty('rows') && results.rows.length > 0){

                  _this.execute_db_results = JSON.stringify(results.rows);
                  csv.writeToString(results.rows, {headers: true}, function(err, data){
                    if(err){
                      logger.log('error',`Generating csv output for execute_db_results_csv. id: ${_this.id}: ${err}. Results: ${results}`);
                    }else{
                      _this.execute_db_results_csv = data;
                    }

                    resolve();
                  });

                }else{

                  if(results instanceof Object){
                    _this.execute_db_results      = '';
                    _this.execute_db_results_csv  = '';
                    _this.execute_db_fieldCount   = results.rowCount;
                    _this.execute_db_affectedRows = '';
                    _this.execute_db_changedRows  = '';
                    _this.execute_db_insertId     = results.oid;
                    _this.execute_db_warningCount = '';
                    _this.execute_db_message      = '';
                  }

                  resolve();
                }
              }
              client.end();
            })
          }
        });
      });
    }

    return new Promise(function(resolve, reject) {

      if(_this.exec.db_connection_id){
        _this.loadDbConfig()
          .then((configValues) => {
          if(!_this.exec.command){
            if(!_this.exec.file_name){
              logger.log('error',`executePostgre dont have command or file_name`);
              _this.execute_err_return = `executePostgre dont have command or file_name`;
              _this.execute_return = '';
              _this.error();
              _this.write_output();
              reject(_this, `executePostgre dont have command or file_name`);
            }else{
              loadSQLFile(_this.exec.file_name)
                .then((fileContent) => {
                  _this.exec.command = fileContent;
                  executeQuery(_this, configValues)
                    .then((res) => {
                      _this.execute_return = '';
                      _this.execute_err_return = '';
                      _this.end();
                      _this.write_output();
                      resolve();
                    })
                    .catch(function(err){
                        logger.log('error',`executePostgre executeQuery from file: ${err}`);
                        _this.execute_err_return = `executePostgre executeQuery from file: ${err}`;
                        _this.execute_return = '';
                        _this.error();
                        _this.write_output();
                        reject(_this, err);
                      });
                })
                .catch(function(err){
                    logger.log('error',`executePostgre loadSQLFile: ${err}`);
                    _this.execute_err_return = `executePostgre loadSQLFile: ${err}`;
                    _this.execute_return = '';
                    _this.error();
                    _this.write_output();
                    reject(_this, err);
                  });
            }
        }else{
          executeQuery(_this, configValues)
            .then((res) => {
              _this.execute_return = '';
              _this.execute_err_return = '';
              _this.end();
              _this.write_output();
              resolve();
            })
            .catch(function(err){
              logger.log('error',`executePostgre executeQuery: ${err}`);
              _this.execute_err_return = `executePostgre executeQuery: ${err}`;
              _this.execute_return = '';
              _this.error();
              _this.write_output();
              reject(_this, err);
            });
        }
      })
      .catch(function(err){
          logger.log('error',`executePostgre loadDbConfig: ${err}`);
          _this.execute_err_return = `executePostgre loadDbConfig: ${err}`;
          _this.execute_return = '';
          _this.error();
          _this.write_output();
          reject(_this, err);
        });

      }else{
        logger.log('error',`executePostgre: db_connection_id not set for ${_this.id}`);
        _this.execute_err_return = `executePostgre: db_connection_id not set for ${_this.id}`;
        _this.execute_return = '';
        _this.error();
        _this.write_output();
        reject(_this, `executePostgre: db_connection_id not set for ${_this.id}`);
      }
    });

  }

  executeRedis() {
    var _this = this;

    function commandFormat(query, values) {
      if (!values) return query.replace(/(\:\/)/g,':');
      else {
        var _query = query.replace(/\:(\w+)/g, function (txt, key) {
          return values && key && values.hasOwnProperty(key)
            ? escape(replaceWith(values[key],_this.values()))
            : null;
        }.bind(this)).replace(/(\:\/)/g,':');
      }
      return _query;
    };

    function commandsFormat(commandsArr, args) {
      var commands       = commandsArr[0];
      var commandsLength = commands.length;
      var result = [];

      while(commandsLength--){
        var cmd = commands[commandsLength];
        var cmdLength = cmd.length;

        var cmdFormat = [];
        for(i = 0; i < cmdLength; i++){
          var cmdItem = cmd[i];
          cmdFormat.push(commandFormat(cmdItem, args));
        }
        result.push(cmdFormat);
      }
      return result;
    };

    function executeCommand(_this, configValues) {
      return new Promise(function (resolve, reject) {

        _this.execute_arg = _this.args;

        var redisClient = redis.createClient(configValues.port, configValues.host, configValues.options), multi;
        redisClient.auth(configValues.password);

        redisClient.on("error", function (err) {
          logger.log('error', `Could not connect to Redis: ` + err);
          reject(err);
        });

        redisClient.on("ready", function () {

          var finalCommands = commandsFormat(_this.exec.command, _this.execute_arg);
          var commands = finalCommands;
          console.log('[] REDIS - commands:',commands);

          redisClient
            .multi(commands)
            .exec(function (err, replies) {
              if (err) {
                logger.log('error', `Error query Redis (${finalCommands}): ` + err);
                reject(`Error query Redis (${finalCommands}): ` + err);
              } else {
                console.log('replies:',replies);
                resolve(replies);
              }
            });

        });

      });
    };

    return new Promise(function(resolve, reject) {

      if(_this.exec.db_connection_id){
        _this.loadDbConfig()
          .then((configValues) => {
            if(_this.exec.command){

              executeCommand(_this, configValues)
                .then((res) => {
                  _this.execute_return = '';
                  _this.execute_err_return = '';
                  _this.end();
                  _this.write_output();
                  resolve();
                })
                .catch(function(err){
                  logger.log('error',`executeRedis executeCommand: ${err}`);
                  _this.execute_err_return = `executeRedis executeCommand: ${err}`;
                  _this.execute_return = '';
                  _this.error();
                  _this.write_output();
                  reject(_this, err);
                });

            }else{
              logger.log('error',`executeRedis: command not set for ${_this.id}`);
              _this.execute_err_return = `executeRedis: command not set for ${_this.id}`;
              _this.execute_return = '';
              _this.error();
              _this.write_output();
              reject(_this, `executeRedis: command not set for ${_this.id}`);
            }
          });
      }else{
        logger.log('error',`executeRedis: db_connection_id not set for ${_this.id}`);
        _this.execute_err_return = `executeRedis: db_connection_id not set for ${_this.id}`;
        _this.execute_return = '';
        _this.error();
        _this.write_output();
        reject(_this, `executeRedis: db_connection_id not set for ${_this.id}`);
      }
    });
  };

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