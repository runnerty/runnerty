"use strict";
var utils = require("../utils.js");
var logger = utils.logger;
var loadConfigSection = utils.loadConfigSection;
var replaceWithSmart = utils.replaceWithSmart;
var getChainByUId = utils.getChainByUId;
var chronometer = utils.chronometer;
var mongoProcess = require("../mongodb-models/process.js");

var crypto = require("crypto");
var bytes = require("bytes");
var fs = require("fs-extra");
var path = require("path");

var Event = require("./event.js");

class Process {
  constructor(id, name, parentUId, depends_process, depends_process_alt, exec, retries, retry_delay, timeout, end_on_fail, end_chain_on_fail, events, status, execute_return, execute_err_return, started_at, ended_at, output, output_iterable, output_share, custom_values, chain_values) {
    this.id = id;
    this.name = name;
    this.uId = "";
    this.parentUId = parentUId;
    this.depends_process = depends_process || [];
    this.depends_process_alt = depends_process_alt;
    this.exec = exec;
    this.retries = retries;
    this.retry_delay = retry_delay;
    this.timeout = timeout;
    this.end_on_fail = end_on_fail || false;
    this.end_chain_on_fail = end_chain_on_fail || false;
    this.output = output;
    this.output_iterable = output_iterable;
    this.custom_values = custom_values;
    this.output_share = output_share;

    //Runtime attributes:
    this.status = status || "stop";
    this.execute_return = execute_return;
    this.execute_err_return = execute_err_return;
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.events = {};

    this.chain_values = chain_values;

    return new Promise((resolve, reject) => {
      var _this = this;
      _this.setUid()
        .then(() => {
          _this.loadEvents(events)
            .then((events) => {
              _this.events = events;
              resolve(this);
            })
            .catch(function (err) {
              reject(err);
            });
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }

  setUid() {
    var _this = this;
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, function (err, buffer) {
        if(err){
          reject(err);
        }else{
          _this.uId = _this.id + "_" + buffer.toString("hex");
          resolve();
        }
      });
    });
  }

  values() {
    var _this = this;
    var process_values = {
      "CHAIN_ID": _this.chain_values.CHAIN_ID,
      "CHAIN_NAME": _this.chain_values.CHAIN_NAME,
      "CHAIN_STARTED_AT": _this.chain_values.CHAIN_STARTED_AT,
      "PROCESS_ID": _this.id,
      "PROCESS_NAME": _this.name,
      "PROCESS_EXEC_COMMAND": (_this.exec instanceof Object) ? _this.exec.command : _this.exec,
      "PROCESS_EXEC_ID": (_this.exec instanceof Object) ? _this.exec.id : "",
      "PROCESS_EXEC_COMMAND_EXECUTED": _this.command_executed,
      "PROCESS_EXEC_RETURN": _this.execute_return,
      "PROCESS_EXEC_ERR_RETURN": _this.execute_err_return,
      "PROCESS_STARTED_AT": _this.started_at,
      "PROCESS_ENDED_AT": _this.ended_at,
      "PROCESS_DURATION_SECONDS": _this.duration_seconds,
      "PROCESS_DURATION_HUMANIZED": _this.duration_humnized,
      "PROCESS_RETRIES_COUNT": _this.retries_count,
      "PROCESS_RETRIES": _this.retries,
      "PROCESS_DEPENDS_FILES_READY": _this.depends_files_ready,
      "PROCESS_FIRST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[0] : [],
      "PROCESS_LAST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[_this.depends_files_ready.length - 1] : [],
      "PROCESS_EXEC_DB_RETURN": _this.execute_db_results,
      "PROCESS_EXEC_DB_RETURN_CSV": _this.execute_db_results_csv,
      "PROCESS_EXEC_DB_RETURN_FIRSTROW": {},
      "PROCESS_EXEC_DB_COUNTROWS": _this.execute_db_countRows,
      "PROCESS_EXEC_DB_FIELDCOUNT": _this.execute_db_fieldCount,
      "PROCESS_EXEC_DB_AFFECTEDROWS": _this.execute_db_affectedRows,
      "PROCESS_EXEC_DB_CHANGEDROWS": _this.execute_db_changedRows,
      "PROCESS_EXEC_DB_INSERTID": _this.execute_db_insertId,
      "PROCESS_EXEC_DB_WARNINGCOUNT": _this.execute_db_warningCount,
      "PROCESS_EXEC_DB_MESSAGE": _this.execute_db_message
    };

    if (_this.execute_db_results_object && _this.execute_db_results_object.length) {
      process_values.PROCESS_EXEC_DB_RETURN_FIRSTROW = _this.execute_db_results_object[0];

      if (_this.execute_db_results_object[0] instanceof Object) {
        var keys = Object.keys(_this.execute_db_results_object[0]);
        var keysLength = keys.length;
        while (keysLength--) {
          var key = keys[keysLength];
          process_values["PROCESS_EXEC_DB_RETURN_FIRSTROW_" + [key.toUpperCase()]] = _this.execute_db_results_object[0][key];
        }
      }
    }

    var values = {};
    Object.assign(values, process_values);
    Object.assign(values, _this.execute_input);
    Object.assign(values, _this.custom_values);
    return values;
  }

  loadEvents(events) {
    return new Promise((resolve, reject) => {
      var processEventsPromises = [];

      if (events instanceof Object) {
        var keys = Object.keys(events);
        var keysLength = keys.length;
        if (keys instanceof Array) {
          if (keysLength > 0) {
            while (keysLength--) {
              var event = events[keys[keysLength]];
              if (event.hasOwnProperty("notifications")) {
                processEventsPromises.push(new Event(keys[keysLength], event.notifications));
              }
            }

            Promise.all(processEventsPromises)
              .then(function (eventsArr) {
                eventsArr = eventsArr.filter(Boolean); // Remove undefined items
                var events = {};
                var eventsArrLength = eventsArr.length;
                while (eventsArrLength--) {
                  var e = eventsArr[eventsArrLength];
                  var key = Object.keys(e);
                  events[key[0]] = e[key[0]];
                }
                resolve(events);
              })
              .catch(function (err) {
                reject(err);
              });
          } else {
            // Process without events
            logger.log("warn", "Process, without events");
            resolve();
          }
        }
      } else {
        logger.log("warn", "Process, events is not set");
        resolve();
      }
    });
  }

  loadExecutorConfig() {
    var _this = this;
    return loadConfigSection(global.config, "executors", _this.exec.id);
  }

  notificate(event) {
    var _this = this;

    if (_this.hasOwnProperty("events") && _this.events !== undefined) {
      if (_this.events.hasOwnProperty(event)) {
        if (_this.events[event].hasOwnProperty("notifications")) {
          var notificationsLength = _this.events[event].notifications.length;
          while (notificationsLength--) {
            _this.events[event].notifications[notificationsLength].notificate(_this.values());
          }
        }
      }
    }
  }

  historicize(event) {
    var _this = this;
    return new Promise(function (resolve) {
      if (global.config.historyEnabled) {
        var mProcess = new mongoProcess
        ({
          id: _this.id,
          uId: _this.uId,
          parentUId: _this.parentUId,
          event: event || _this.status,
          date: _this.date,
          name: _this.name,
          exec: _this.exec,
          depends_process: _this.depends_process,
          depends_process_alt: _this.depends_process_alt,
          retries: _this.retries,
          retry_delay: _this.retry_delay,
          timeout: _this.timeout,
          end_on_fail: _this.end_on_fail,
          end_chain_on_fail: _this.end_chain_on_fail,
          command_executed: _this.command_executed,
          retries_count: _this.retries_count,
          output: _this.output,
          output_iterable: _this.output_iterable,
          custom_values: _this.custom_values,
          output_share: _this.output_share,
          execute_return: _this.execute_return,
          execute_err_return: _this.execute_err_return,
          started_at: _this.started_at,
          ended_at: _this.ended_at,
          duration_seconds: _this.duration_seconds,
          execute_db_fieldCount: _this.execute_db_fieldCount,
          execute_db_affectedRows: _this.execute_db_affectedRows,
          execute_db_changedRows: _this.execute_db_changedRows,
          execute_db_insertId: _this.execute_db_insertId,
          execute_db_warningCount: _this.execute_db_warningCount,
          execute_db_message: _this.execute_db_message
        });

        mProcess.save(function (err) {
          if (err) {
            logger.log("error", `Error historicize ${event} process ${_this.id}`, err);
          }
          resolve();
        });
      }else{
        resolve();
      }
    });
  }

  isStopped() {
    return (this.status === "stop");
  }

  isEnded() {
    return (this.status === "end");
  }

  isRunning() {
    return (this.status === "running");
  }

  isErrored() {
    return (this.status === "error");
  }

  stopChildChains() {
    var _this = this;

    //If have childs_chains
    if (_this.childs_chains) {
      // Set All childs_chains to stopped
      _this.childs_chains_status = "stop";
      var childsChainsLength = _this.childs_chains.length;
      while (childsChainsLength--) {
        _this.childs_chains[childsChainsLength].stop();
      }
    }
  }

  stop(reason) {
    var _this = this;

    if (_this.executor && !_this.isStopped() && !_this.isEnded() && !_this.isErrored()) {
      _this.status = "stop";
      _this.executor.killMain(reason);
    } else {
      _this.status = "stop";
    }
    _this.stopChildChains();
  }

  async end(notificate, writeOutput) {
    var _this = this;
    var duration = chronometer(_this.hr_started_time);
    _this.duration_seconds = duration[0];
    _this.duration_humnized = duration[1];
    notificate = notificate || true;
    writeOutput = writeOutput || true;

    _this.status = "end";
    _this.ended_at = new Date();

    if (writeOutput) {
      await _this.write_output();
    }

    if (notificate) {
      _this.notificate("on_end");
    }

    _this.depends_files_ready = [];

    await _this.setOutputShare();
    _this.historicize();
  }

  endChildChains() {
    var _this = this;

    _this.notificate("on_end_childs");
    _this.childs_chains_status = "end";

    var globalPlanChains = global.runtimePlan.plan.chains;

    getChainByUId(globalPlanChains, _this.parentUId)
      .then((chainParentFound) => {
        if (chainParentFound) {
          chainParentFound.refreshChainStatus()
            .then(function () {})
            .catch(function (err) {
              logger.log("error", "Error in process refreshChainStatus:", err);
            });
        }
      });
  }

  startChildChains() {
    var _this = this;
    _this.notificate("on_start_childs");
    _this.childs_chains_status = "running";
  }

  startChildChainsDependients( ) {
    var _this = this;

    return new Promise(function (resolve, reject) {

      var chainsLength = global.runtimePlan.plan.chains.length;
      var chainsToRun = [];

      while (chainsLength--) {
        var itemChain = global.runtimePlan.plan.chains[chainsLength];
        var procValues = _this.values();

        if (itemChain.hasOwnProperty("depends_chains") && itemChain.depends_chains.hasOwnProperty("chain_id") && itemChain.depends_chains.hasOwnProperty("process_id") && itemChain.depends_chains.chain_id === procValues.CHAIN_ID && itemChain.depends_chains.process_id === _this.id) {
          if (itemChain.isEnded()) {
            itemChain.status = "stop";
          }
          var executeInmediate = true;
          chainsToRun.push(global.runtimePlan.plan.scheduleChain(itemChain, _this, executeInmediate, null, _this.custom_values));
        }
      }

      if (chainsToRun.length) {
        _this.startChildChains();

        Promise.all(chainsToRun)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });

      } else {
        resolve();
      }

    });
  }

  refreshProcessChildsChainsStatus() {
    var _this = this;

    return new Promise((resolve) => {
      var childsChainsLength = _this.childs_chains.length;
      var statusChildsChains = "end";

      var chainsError = 0;
      var chainsRunning = 0;
      var chainsStop = 0;

      while (childsChainsLength--) {
        switch (_this.childs_chains[childsChainsLength].status) {
          case "stop"   :
            chainsStop += 1;
            break;
          case "running":
            chainsRunning += 1;
            break;
          case "error"  :
            chainsError += 1;
            break;
          default:
            break;
        }
      }

      if (chainsRunning > 0 || chainsStop > 0) {
        statusChildsChains = "running";
      } else {
        if (chainsError > 0) {
          statusChildsChains = "error";
        } else {
          statusChildsChains = "end";
        }
      }

      _this.childs_chains_status = statusChildsChains;
      resolve(statusChildsChains);
    });
  }

  setOutputShare() {
    var _this = this;

    return new Promise(function (resolve) {
      if (_this.hasOwnProperty("output_share") && _this.output_share) {

        var options = {
          ignoreGlobalValues: false,
          keysUpperCase: false
        };

        replaceWithSmart(_this.output_share, _this.values(), options)
          .then((res) => {
            res.forEach(function (valOS) {
              var _valOS = {};
              _valOS[valOS.key.toUpperCase()] = {};
              _valOS[valOS.key.toUpperCase()][valOS.name.toUpperCase()] = valOS.value;
              if(!global.config.global_values){
                global.config.global_values = [];
              }
              global.config.global_values.push(_valOS);
            });
            resolve();
          });
      }else{
        resolve();
      }
    });
  }

  error(notificate, writeOutput) {
    var _this = this;

    notificate = notificate || true;
    writeOutput = writeOutput || true;

    if (notificate) {
      _this.notificate("on_fail");
    }

    if (writeOutput) {
      _this.write_output();
    }

    _this.status = "error";
    _this.historicize();
  }

  retry() {
    var _this = this;
    _this.notificate("on_retry");
  }

  waiting_dependencies() {
    var _this = this;
    _this.notificate("on_waiting_dependencies");
  }

  start(isRetry) {
    var _this = this;
    _this.clean();
    _this.hr_started_time = chronometer();
    _this.status = "running";
    _this.started_at = new Date();

    if (!isRetry || isRetry === undefined) {
      _this.notificate("on_start");
      _this.historicize("start");
    }

    return new Promise(function (resolve, reject) {

      if (_this.exec.id) {
        _this.loadExecutorConfig()
          .then((configValues) => {
            if (configValues.type) {

              if (global.executors[configValues.type]) {
                new global.executors[configValues.type](_this)
                  .then((res) => {
                    _this.executor = res;
                    //Timeout control:
                    if(_this.timeout){
                      _this.executor.timeout = setTimeout(function(){
                        _this.executor.killMain("timeout");
                      }, _this.timeout);
                    }
                    //Execution
                    res.execMain(resolve, reject);
                  })
                  .catch((err) => {
                    _this.execute_err_return = JSON.stringify(err);
                    _this.execute_return = "";
                    _this.error();
                    reject(err);
                  });

              } else {
                _this.execute_err_return = `Executor ${_this.exec.id} type is not valid`;
                _this.execute_return = "";
                _this.error();
                reject(`Executor ${_this.exec.id} type is not valid`);
              }

            } else {
              _this.execute_err_return = `Executor ${_this.exec.id} type is not valid`;
              _this.execute_return = "";
              _this.error();
              reject(`Executor ${_this.exec.id} type is not valid`);
            }
          })
          .catch(function (err) {
            _this.execute_err_return = `Procces start loadExecutorConfig: ${err}`;
            _this.execute_return = "";
            _this.error();
            reject(err);
          });
      } else {
        // DUMMY PROCCESS:
        if (Object.keys(_this.exec).length === 0 || _this.exec === "") {
          _this.end();
          resolve();
        } else {
          reject(`Incorrect exec ${_this.exec}`);
        }
      }
    });
  }

  write_output() {
    var _this = this;

    function writeFile(filePath, mode, os) {
      return new Promise(function (resolve, reject) {
        var dirname = path.dirname(filePath);

        fs.ensureDir(dirname, function (err) {
          if (err) {
            logger.log("error", `Creating directory ${dirname} in ensureDir in ${_this.id}: `, err);
            reject(err);
          } else {
            fs.open(filePath, mode, (err, fd) => {
              if (err) {
                logger.log("error", `Writing output, open file ${filePath} in ${_this.id}: `, err);
                reject(err);
              } else {
                fs.write(fd, os, null, "utf8", function () {
                  fs.close(fd, function (err) {
                    if (err) {
                      logger.log("error", `Closing file ${filePath} in writeFile in ${_this.id}: `, err);
                      reject(err);
                    }else{
                      resolve();
                    }
                  });
                });
              }
            });
          }
        });
      });
    }

    function generateOutput(output) {
      return new Promise(function (resolve, reject) {
        replaceWithSmart(output, _this.values())
          .then((_output) => {
            if (_output && _output.file_name && _output.write.length > 0) {

              var filePath = _output.file_name;
              var output_stream = _output.write.filter(Boolean).join("\n");

              if (_output.maxsize) {
                var maxSizeBytes = bytes(_output.maxsize);
                var output_stream_length = output_stream.length;

                if (output_stream_length > maxSizeBytes) {
                  output_stream = output_stream.slice(output_stream_length - maxSizeBytes, output_stream_length);
                  output_stream_length = maxSizeBytes;
                  logger.log("debug", `output_stream truncated output_stream_length (${output_stream_length}) > maxSizeBytes (${maxSizeBytes})`);
                }
              }
              if (_output.concat) {
                if (_output.maxsize) {
                  fs.stat(filePath, function (error, stats) {

                    var fileSizeInBytes = 0;
                    if (!error) {
                      fileSizeInBytes = stats.size;
                    }
                    //SI LA SUMA DEL TAMAÑO DEL FICHERO Y EL OUTPUT A ESCRIBIR DEL PROCESO SUPERAN EL MAXIMO PERMITIDO
                    var totalSizeToWrite = fileSizeInBytes + output_stream_length;

                    if (totalSizeToWrite > maxSizeBytes) {
                      //SE OBTIENE LA PARTE DEL FICHERO QUE JUNTO CON EL OUTPUT SUMAN EL TOTAL PERMITIDO PARA ESCRIBIRLO (SUSTIUYENDO EL FICHERO)
                      var positionFileRead = (totalSizeToWrite) - maxSizeBytes;
                      var lengthFileRead = (fileSizeInBytes) - positionFileRead;

                      fs.open(filePath, "r", function (error, fd) {
                        if (lengthFileRead > 0) {
                          var buffer = new Buffer(lengthFileRead);

                          fs.read(fd, buffer, 0, buffer.length, positionFileRead, function (error, bytesRead, buffer) {
                            var data = buffer.toString("utf8", 0, buffer.length);
                            data = data.concat("\n", output_stream);
                            fs.close(fd, function (err) {
                              if (err) {
                                logger.log("error", `Closing file ${filePath} in ${_this.id}: `, err);
                              }
                              writeFile(filePath, "w", data)
                                .then(() => {
                                    resolve();
                                  },
                                  err => {
                                    reject(err);
                                  });
                            });
                          });
                        } else {
                          //SI NO SE VA A ESCRIBIR NADA DEL FICHERO ACTUAL
                          writeFile(filePath, "w", output_stream)
                            .then(() => {
                                resolve();
                              },
                              err => {
                                reject(err);
                              });
                        }
                      });
                    } else {
                      writeFile(filePath, "a+", output_stream)
                        .then(() => {
                            resolve();
                          },
                          err => {
                            reject(err);
                          });
                    }
                  });
                } else {
                  writeFile(filePath, "a+", output_stream)
                    .then(() => {
                        resolve();
                      },
                      err => {
                        reject(err);
                      });
                }
              } else {
                writeFile(filePath, "w+", output_stream)
                  .then(() => {
                      resolve();
                    },
                    err => {
                      reject(err);
                    });
              }
            }else{
              resolve();
            }
          });
      });
    }

    return new Promise(function (resolve, reject) {
      if (_this.output instanceof Array) {
        var outputCountItems = _this.output.length;
        let promisesGO = [];

        while (outputCountItems--) {
          promisesGO.push(generateOutput(_this.output[outputCountItems]));
        }

        Promise.all(promisesGO)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            resolve(err);
          });
      } else {
        generateOutput(_this.output)
          .then(() => {
              resolve();
            },
            err => {
              reject(err);
            });
      }
    });
  }

  clean(){
    var _this = this;
    delete _this.ended_at;
    delete _this.command_executed;
    delete _this.retries_count;
    delete _this.custom_values;
    delete _this.output_share;
    delete _this.execute_return;
    delete _this.execute_err_return;
    delete _this.duration_seconds;
    delete _this.execute_db_fieldCount;
    delete _this.execute_db_affectedRows;
    delete _this.execute_db_changedRows;
    delete _this.execute_db_insertId;
    delete _this.execute_db_warningCount;
    delete _this.execute_db_message;
  }
}

module.exports = Process;