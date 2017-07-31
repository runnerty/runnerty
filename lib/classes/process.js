"use strict";

const utils = require("../utils.js");
const logger = utils.logger;
const loadConfigSection = utils.loadConfigSection;
const replaceWithSmart = utils.replaceWithSmart;
const getChainByUId = utils.getChainByUId;
const chronometer = utils.chronometer;
const mongoProcess = require("../mongodb-models/process.js");
const lodash = require("lodash");
const crypto = require("crypto");
const bytes = require("bytes");
const fs = require("fs-extra");
const path = require("path");
const sizeof = require("object-sizeof");

const notificationEvent = require("./notificationEvent.js");

class Process {
  constructor(process) {
    this.id = process.id;
    this.name = process.name;
    this.uId = "";
    this.parentUId = process.parentUId;
    this.depends_process = process.depends_process || [];
    this.exec = process.exec;
    this.retries = process.retries;
    this.retry_delay = process.retry_delay;
    this.timeout = process.timeout;
    this.end_on_fail = process.end_on_fail || false;
    this.end_chain_on_fail = process.end_chain_on_fail || false;
    this.output = process.output;
    this.output_iterable = process.output_iterable;
    this.custom_values = process.custom_values || {};
    this.output_share = process.output_share;
    this.notificate_only_last_fail = process.notificate_only_last_fail || false;

    //Runtime attributes:
    this.status = process.status || "stop";
    this.msg_output = process.msg_output;
    this.err_output = process.err_output;
    this.started_at = process.started_at;
    this.ended_at = process.ended_at;
    this.notifications = {};

    this.chain_values = process.chain_values;

    return new Promise((resolve, reject) => {
      var _this = this;
      _this.setUid()
        .then(() => {
          _this.loadProcessNotifications(process.notifications)
            .then((notifications) => {
              _this.notifications = notifications;
              resolve(this);
            })
            .catch((err) => {
              reject(err);
            });
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  setUid() {
    var _this = this;
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buffer) => {
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
    let _this = this;
    let process_values = {
      "CHAIN_ID": _this.chain_values.CHAIN_ID,
      "CHAIN_NAME": _this.chain_values.CHAIN_NAME,
      "CHAIN_STARTED_AT": _this.chain_values.CHAIN_STARTED_AT,
      "PROCESS_ID": _this.id,
      "PROCESS_NAME": _this.name,
      "PROCESS_EXEC_COMMAND": (_this.exec instanceof Object) ? _this.exec.command : _this.exec,
      "PROCESS_EXEC_ID": (_this.exec instanceof Object) ? _this.exec.id : "",
      "PROCESS_EXEC_COMMAND_EXECUTED": _this.command_executed,
      "PROCESS_STARTED_AT": _this.started_at,
      "PROCESS_ENDED_AT": _this.ended_at,
      "PROCESS_DURATION_SECONDS": _this.duration_seconds,
      "PROCESS_DURATION_HUMANIZED": _this.duration_humnized,
      "PROCESS_RETRIES_COUNT": _this.retries_count,
      "PROCESS_RETRIES": _this.retries,
      "PROCESS_DEPENDS_FILES_READY": _this.depends_files_ready,
      "PROCESS_FIRST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[0] : [],
      "PROCESS_LAST_DEPEND_FILE_READY": (_this.depends_files_ready && _this.depends_files_ready.length > 0) ? _this.depends_files_ready[_this.depends_files_ready.length - 1] : [],
      "PROCESS_EXEC_MSG_OUTPUT": _this.msg_output,
      "PROCESS_EXEC_DATA_OUTPUT": _this.data_output,
      "PROCESS_EXEC_ERR_OUTPUT": _this.err_output
    };

    let values = {};
    Object.assign(values, process_values);
    // EXTRA OUTPUT EXECUTORS:
    if(_this.extra_output) Object.assign(values, _this.extra_output);
    Object.assign(values, _this.execute_input);
    Object.assign(values, _this.custom_values);
    return values;
  }

  /**
   * Load plan process notifications and create notifications events.
   * Used in class Process creation.
   * @param notifications (plan process object)
   * @returns {Promise} Empty
   */
  loadProcessNotifications(notifications) {
    return new Promise((resolve, reject) => {
      let processNotificationsPromises = [];

      if (notifications instanceof Object) {
        let events = Object.keys(notifications);
        let eventsLength = events.length;
        if (events instanceof Array) {
          if (eventsLength > 0) {
            while (eventsLength--) {
              let event = notifications[events[eventsLength]];
              if (event.length) {
                processNotificationsPromises.push(new notificationEvent(events[eventsLength], event));
              }
            }

            Promise.all(processNotificationsPromises)
              .then((notificationsArr) => {
                notificationsArr = notificationsArr.filter(Boolean); // Remove undefined items
                var notifications = {};
                var notificationsArrLength = notificationsArr.length;
                while (notificationsArrLength--) {
                  var e = notificationsArr[notificationsArrLength];
                  var key = Object.keys(e);
                  notifications[key[0]] = e[key[0]];
                }
                resolve(notifications);
              })
              .catch((err) => {
                reject(err);
              });
          } else {
            // Process without
            logger.log("warn", "Process, without notifications");
            resolve();
          }
        }
      } else {
        logger.log("warn", "Process, notifications is not set");
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
    if (_this.hasOwnProperty("notifications") && _this.notifications !== undefined) {
      if (_this.notifications.hasOwnProperty(event)) {
        let notificationsLength = _this.notifications[event].length;
        while (notificationsLength--) {
          _this.notifications[event][notificationsLength].notificate(_this.values());
        }
      }
    }
  }

  historicize(event) {
    var _this = this;
    return new Promise((resolve) => {
      if (global.config.historyEnabled) {
        let mProcess = new mongoProcess
        ({
          id: _this.id,
          uId: _this.uId,
          parentUId: _this.parentUId,
          event: event || _this.status,
          date: _this.date,
          name: _this.name,
          exec: _this.exec,
          depends_process: _this.depends_process,
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
          msg_output: _this.msg_output,
          err_output: _this.err_output,
          data_output: _this.data_output,
          extra_output: _this.extra_output || "",
          started_at: _this.started_at,
          ended_at: _this.ended_at,
          duration_seconds: _this.duration_seconds,
          output_size: sizeof(_this.msg_output||"") + sizeof(_this.messageLog||"") + sizeof(_this.err_output||"") + sizeof(_this.data_output||"") + sizeof(_this.extra_output||"")
        });

        mProcess.save((err) => {
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

  isIgnored() {
    return (this.status === "ignored");
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

    if (_this.executor && !_this.isStopped() && !_this.isEnded() && !_this.isErrored() && !_this.isIgnored()) {
      _this.status = "stop";
      _this.executor.killMain(reason);
      _this.stopChildChains();
    } else {
      _this.status = "stop";
    }
  }

  end(notificate, writeOutput) {
    var _this = this;
    var duration = chronometer(_this.hr_started_time);
    _this.duration_seconds = duration[0];
    _this.duration_humnized = duration[1];
    notificate = notificate || true;
    writeOutput = writeOutput || true;

    _this.status = "end";
    let currentDate = new Date();
    _this.ended_at = currentDate.toString();

    if (notificate) {
      _this.notificate("on_end");
    }
    _this.depends_files_ready = [];

    return new Promise(async (resolve) => {
      if (writeOutput) {
        await _this.write_output();
      }
      await _this.setOutputShare();
      _this.historicize();
      resolve();
    });
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
            .then(() =>{})
            .catch((err) => {
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

  startChildChainsDependients() {
    var _this = this;

    return new Promise((resolve, reject) => {

      var chainsLength = global.runtimePlan.plan.chains.length;
      var chainsToRun = [];


      let output_iterable_string = _this.values()[_this.output_iterable];
      let childChainsinputIterable;

      if (output_iterable_string && output_iterable_string.length) {
        try {
          childChainsinputIterable = JSON.parse(output_iterable_string);
        } catch (err) {
          reject(`Invalid input (${output_iterable_string}), incorrect JSON` + "\nCaused by: " + err.stack);
        }
      }

      if(childChainsinputIterable && childChainsinputIterable.length > 0){
        while (chainsLength--) {
          var itemChain = global.runtimePlan.plan.chains[chainsLength];
          var procValues = _this.values();

          if (itemChain.hasOwnProperty("depends_chains") && itemChain.depends_chains.hasOwnProperty("chain_id") && itemChain.depends_chains.hasOwnProperty("process_id") && itemChain.depends_chains.chain_id === procValues.CHAIN_ID && itemChain.depends_chains.process_id === _this.id) {
            if (itemChain.isEnded()) {
              itemChain.status = "stop";
            }
            var executeInmediate = true;
            let childChain = global.runtimePlan.plan.scheduleChain(itemChain, _this, executeInmediate, childChainsinputIterable, _this.custom_values);
            if(childChain) chainsToRun.push(childChain);
          }
        }

        if (chainsToRun.length) {
          _this.startChildChains();

          Promise.all(chainsToRun)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });

        } else {
          logger.log("debug", `Process ${_this.id} whitout childs chains to run.`);
          resolve();
        }
      }else{
        logger.log("debug", `Process ${_this.id} whitout output_iterable items.`);
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

    return new Promise((resolve) => {
      if (_this.hasOwnProperty("output_share") && _this.output_share) {

        let options = {
          ignoreGlobalValues: false,
          altValueReplace: ""
        };

        replaceWithSmart(_this.output_share, _this.values(), options)
          .then((res) => {
            res.forEach((valOS) => {
              let _valOS = {};
              _valOS[valOS.key] = {};
              _valOS[valOS.key][valOS.name] = valOS.value;

              if(!global.config.global_values){
                global.config.global_values = [];
              }

              let gvresLength = global.config.global_values.length;
              let vReplaced = false;

              for (let i = 0; i < gvresLength; i++) {
                let valKey = Object.keys(_valOS)[0];
                let gvKey = Object.keys(global.config.global_values[i])[0];
                if(valKey === gvKey){
                  global.config.global_values[i] = lodash.defaultsDeep(_valOS, global.config.global_values[i]);
                  vReplaced = true;
                }
              }
              if(!vReplaced){
                global.config.global_values.push(_valOS);
              }
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
    _this.status = "error";

    if(notificate === undefined) notificate = true;
    writeOutput = writeOutput || true;

    if (notificate) {
      _this.notificate("on_fail");
    }

    if (writeOutput) {
      _this.write_output();
    }

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

  ignore() {
    var _this = this;
    _this.status = "ignored";
    _this.notificate("on_ignore");
  }

  start(isRetry) {
    var _this = this;
    _this.clean();
    _this.status = "running";
    _this.hr_started_time = chronometer();
    let currentDate = new Date();
    _this.started_at = currentDate.toString();

    if (!isRetry || isRetry === undefined) {
      _this.notificate("on_start");
      _this.historicize("start");
    }

    return new Promise((resolve, reject) => {

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
                      _this.executor.timeout = setTimeout(() => {
                        _this.executor.killMain("timeout");
                      }, _this.timeout);
                    }
                    //Execution
                    res.execMain(resolve, reject);
                  })
                  .catch((err) => {
                    _this.err_output = JSON.stringify(err);
                    _this.msg_output = "";
                    _this.error();
                    reject(err);
                  });

              } else {
                _this.err_output = `Executor ${_this.exec.id} type is not valid`;
                _this.msg_output = "";
                _this.error();
                reject(`Executor ${_this.exec.id} type is not valid`);
              }

            } else {
              _this.err_output = `Executor ${_this.exec.id} type is not valid`;
              _this.msg_output = "";
              _this.error();
              reject(`Executor ${_this.exec.id} type is not valid`);
            }
          })
          .catch((err) => {
            _this.err_output = `Process start loadExecutorConfig: ${err}`;
            _this.msg_output = "";
            _this.error();
            reject(err);
          });
      } else {
        // DUMMY PROCESS:
        if (Object.keys(_this.exec).length === 0 || _this.exec === "") {
          _this.end()
            .then(() => {
              resolve();
            });
        } else {
          reject(`Incorrect exec ${_this.exec}`);
        }
      }
    });
  }

  write_output() {
    var _this = this;

    function writeFile(filePath, mode, os) {
      return new Promise((resolve, reject) =>{
        var dirname = path.dirname(filePath);

        fs.ensureDir(dirname, (err) => {
          if (err) {
            logger.log("error", `Creating directory ${dirname} in ensureDir in ${_this.id}: `, err);
            reject(err);
          } else {
            fs.open(filePath, mode, (err, fd) => {
              if (err) {
                logger.log("error", `Writing output, open file ${filePath} in ${_this.id}: `, err);
                reject(err);
              } else {
                fs.write(fd, os, null, "utf8")
                  .then(() => {
                    fs.close(fd, (err) => {
                      if (err) {
                        logger.log("error", `Closing file ${filePath} in writeFile in ${_this.id}: `, err);
                        reject(err);
                      }else{
                        resolve();
                      }
                    });
                  })
                  .catch(err => {
                    logger.log("error", `Writing output file ${filePath} in ${_this.id}: `, err);
                    reject(err);
                  });
              }
            });
          }
        });
      });
    }

    function generateOutput(output) {
      return new Promise((resolve, reject) => {
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
                  fs.stat(filePath, (error, stats) => {

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

                      fs.open(filePath, "r", (error, fd) => {
                        if (lengthFileRead > 0) {
                          var buffer = new Buffer(lengthFileRead);

                          fs.read(fd, buffer, 0, buffer.length, positionFileRead, (error, bytesRead, buffer) => {
                            var data = buffer.toString("utf8", 0, buffer.length);
                            data = data.concat("\n", output_stream);
                            fs.close(fd, (err) => {
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

    return new Promise((resolve, reject) => {
      if (_this.output instanceof Array) {
        var outputCountItems = _this.output.length;
        let promisesGO = [];

        while (outputCountItems--) {
          promisesGO.push(generateOutput(_this.output[outputCountItems]));
        }

        Promise.all(promisesGO)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            resolve(err);
          });
      } else {
        generateOutput(_this.output)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            resolve(err);
          });
      }
    });
  }

  clean(){
    var _this = this;
    delete _this.ended_at;
    delete _this.command_executed;
    delete _this.retries_count;
    delete _this.msg_output;
    delete _this.err_output;
    delete _this.data_output;
    delete _this.extra_output;
    delete _this.duration_seconds;
    delete _this.childs_chains;
  }
}

module.exports = Process;