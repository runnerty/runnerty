"use strict";

var utils = require("../utils.js");
var logger = utils.logger;
var getProcessByUId = utils.getProcessByUId;
var checkEvaluation = utils.checkEvaluation;
var checkCalendar = utils.checkCalendar;
var chokidar = require("chokidar");
var chronometer = utils.chronometer;
var schedule = require("node-schedule");
var anymatch = require("anymatch");
var crypto = require("crypto");
var mongoChain = require("../mongodb-models/chain.js");

var Process = require("./process.js");
var Event = require("./event.js");

class Chain {
  constructor(chain) {
    this.id = chain.id;
    this.name = chain.name;
    this.uId = "";
    this.iterable = chain.iterable;
    this.parentUId = chain.parentUId;
    this.input = chain.input;
    this.custom_values = chain.custom_values;
    this.start_date = chain.start_date;
    this.end_date = chain.end_date;
    this.schedule_interval = chain.schedule_interval;
    this.depends_chains = chain.depends_chains || [];
    this.depends_conditions = chain.depends_conditions || [];
    this.depends_chains_alt = chain.depends_chains_alt;
    this.calendars = chain.calendars;
    this.events = {};

    this.status = chain.status || "stop";
    this.started_at = chain.started_at;
    this.ended_at = chain.ended_at;
    this.processes = {};

    return new Promise((resolve, reject) => {
      var _this = this;

      _this.setUid()
        .then(() => {
          _this.loadProcesses(chain.processes)
            .then((processes) => {
              _this.processes = processes;
              _this.loadEvents(chain.events)
                .then((events) => {
                  _this.events = events;
                  resolve(_this);
                })
                .catch(function (err) {
                  reject(err);
                });
            })
            .catch(function (err) {
              reject(err);
            });
        })
        .catch(function (err) {
          reject(`Chain ${_this.id} setUid: ` + err);
        });
    });
  }

  setUid() {
    var _this = this;
    return new Promise((resolve) => {
      crypto.randomBytes(16, function (err, buffer) {
        _this.uId = _this.id + "_" + buffer.toString("hex");
        resolve();
      });
    });
  }

  // Executed in construction:
  loadProcesses(processes) {
    var _this = this;
    return new Promise((resolve, reject) => {
      var chainProcessPromises = [];
      var processesLength = processes.length;
      if (processes instanceof Array) {
        if (processesLength > 0) {

          while (processesLength--) {
            processes[processesLength].parentUId = _this.uId;
            processes[processesLength].custom_values = _this.custom_values;
            processes[processesLength].chain_values = _this.values();
            chainProcessPromises.push(_this.loadProcess(processes[processesLength]));
          }

          Promise.all(chainProcessPromises)
            .then(function (processes) {
              var processesLength = processes.length;
              while (processesLength--) {
                _this.loadProcessFileDependencies(processes[processesLength]);
              }
              resolve(processes);
            })
            .catch(function (err) {
              reject(err);
            });

        } else {
          resolve();
        }
      } else {
        reject(`Chain ${_this.id} processes is not array`);
      }
    });
  }

  loadProcess(process) {
    return new Process(process);
  }

  loadEvents(events) {
    var _this = this;
    return new Promise((resolve, reject) => {
      var processEventsPromises = [];

      if (events instanceof Object) {
        var keys = Object.keys(events);
        var keysLength = keys.length;
        if (keysLength > 0) {
          while (keysLength--) {
            let event = events[keys[keysLength]];
            if (event.hasOwnProperty("notifications")) {
              processEventsPromises.push(new Event(keys[keysLength], event.notifications));
            } else {
              logger.log("debug", `Chain ${_this.id} Events without procces and notifications`);
            }
          }

          Promise.all(processEventsPromises)
            .then(function (eventsArr) {
              var events = {};
              var eventsArrLength = eventsArr.length;
              while (eventsArrLength--) {
                let e = eventsArr[eventsArrLength];
                let key = Object.keys(e);
                events[key[0]] = e[key[0]];
              }
              resolve(events);
            })
            .catch(function (err) {
              //logger.log("error", `Chain ${_this.id} events: ` + err);
              reject(err);
            });

        } else {
          logger.log("debug", `Chain ${_this.id} events is empty`);
          resolve();
        }
      } else {
        logger.log("debug", `Chain ${_this.id} events is not set`);
        resolve();
      }
    });
  }

  loadProcessFileDependencies(process) {
    var _this = this;

    var depends_process = process.depends_process;
    var dependsProcessLength = depends_process.length;

    if (dependsProcessLength > 0) {
      while (dependsProcessLength--) {
        let dependence = depends_process[dependsProcessLength];

        if (dependence instanceof Object) {
          if (dependence.hasOwnProperty("file_name") && dependence.hasOwnProperty("condition")) {

            //TODO: VALIDATE CONDITIONS VALUES

            var watcher = chokidar.watch(dependence.file_name, {
              ignored: /[\/\\](\.|\~)/,
              persistent: true,
              usePolling: true,
              awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 150
              }
            });

            watcher.on(dependence.condition, function (pathfile) {
              if (process.depends_files_ready) {
                process.depends_files_ready.push(pathfile);
              } else {
                process.depends_files_ready = [pathfile];
              }

              // If chain is running try execute processes:
              if (_this.isRunning()) {
                _this.startProcesses()
                  .then(function () {
                  })
                  .catch(function (err) {
                    logger.log("error", "Error in loadProcessFileDependencies startProcesses:", err);
                  });
              }
            });

            if (process.file_watchers) {
              process.file_watchers.push(watcher);
            } else {
              process.file_watchers = [watcher];
            }

          }
        }
      }
    }
  }

  getProcessById(processId) {
    var _this = this;

    function byId(process) {
      return process.id === processId;
    }

    return _this.processes.find(byId);
  }

  values() {
    var _this = this;

    var chain_values = {
      "CHAIN_ID": _this.id,
      "CHAIN_NAME": _this.name,
      "CHAIN_STARTED_AT": _this.started_at,
      "CHAIN_DURATION_SECONDS": _this.duration_seconds,
      "CHAIN_DURATION_HUMANIZED": _this.duration_humnized
    };
    var values = {};
    Object.assign(values, chain_values);
    Object.assign(values, _this.execute_input);
    Object.assign(values, _this.custom_values);
    return values;
  }

  notificate(event) {
    var _this = this;
    if (_this.hasOwnProperty("events") && _this.events !== undefined) {
      if (_this.events.hasOwnProperty(event)) {
        if (_this.events[event].hasOwnProperty("notifications")) {
          let notificationsLength = _this.events[event].notifications.length;
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
        var mChain = new mongoChain
        ({
          id: _this.id,
          uId: _this.uId,
          parentUId: _this.parentUId,
          event: event || _this.status,
          name: _this.name,
          iterable: _this.iterable,
          input: _this.input,
          custom_values: _this.custom_values,
          start_date: _this.start_date,
          end_date: _this.end_date,
          duration_seconds: _this.duration_seconds,
          schedule_interval: _this.schedule_interval,
          depends_chains: _this.depends_chains,
          depends_chains_alt: _this.depends_chains_alt
        });

        mChain.save(function (err) {
          if (err) {
            logger.log("error", `Error historicize ${event} chain ${_this.id}`, err);
          }
          resolve();
        });
      }else{
        resolve();
      }
    });
  }

  isStopped() {
    var _this = this;
    return (_this.status === "stop");
  }

  isEnded() {
    var _this = this;
    return (_this.status === "end");
  }

  isRunning() {
    var _this = this;
    return (_this.status === "running");
  }

  isErrored() {
    var _this = this;
    return (_this.status === "error");
  }

  stop() {
    var _this = this;
    _this.status = "stop";

    var processesLength = _this.processes.length;
    while (processesLength--) {
      _this.processes[processesLength].stop();
    }

  }

  end() {
    var _this = this;
    var duration = chronometer(_this.hr_started_time);
    _this.duration_seconds = duration[0];
    _this.duration_humnized = duration[1];

    _this.ended_at = new Date();
    _this.status = "end";
    _this.notificate("on_end");
    _this.refreshParentProcessChildsChainsStatus();
    _this.historicize();
  }

  refreshParentProcessChildsChainsStatus() {
    var _this = this;
    var globalPlanChains = global.runtimePlan.plan.chains;

    var processParentFound = getProcessByUId(globalPlanChains, _this.parentUId);

    if (processParentFound) {
      processParentFound.refreshProcessChildsChainsStatus()
        .then(function (processChildsChainsStatus) {
          if (processChildsChainsStatus === "end") {
            processParentFound.endChildChains();
          }
        })
        .catch(function (err) {
          logger.log("error", "Error in chain refreshParentProcessChildsChainsStatus:", err);
        });
    }
  }

  running() {
    this.started_at = new Date();
    this.hr_started_time = chronometer();

    this.notificate("on_start");
    this.historicize("start");
  }

  error() {
    this.status = "error";
    this.notificate("on_fail");
    this.historicize();
  }

  //Start Chain
  start(options) {
    var _this = this;

    _this.clean();

    if (options.inputIteration) {
      var inputLength = _this.input.length;
      _this.execute_input = {};

      while (inputLength--) {
        let key = Object.keys(_this.input[inputLength])[0];
        let value = _this.input[inputLength][key];
        _this.execute_input[key] = options.inputIteration[value];
      }
    }

    return new Promise((resolve) => {

      if (_this.hasOwnProperty("processes")) {
        if (_this.processes instanceof Array && _this.processes.length > 0) {
          // Initialize Chain
          if (_this.schedule_interval && !options.executeInmediate) {
            _this.scheduleRepeater = schedule.scheduleJob(_this.schedule_interval, async function () {
              if ((new Date(_this.end_date)) < (new Date())) {
                _this.scheduleRepeater.cancel();
              }
              var chainCalendarEnable = true;
              if (_this.calendars) {
                chainCalendarEnable = await checkCalendar(_this.calendars);
              }
              if (chainCalendarEnable) {
                if (_this.isStopped() || _this.isEnded()) {
                  _this.setChainToInitState()
                    .then(function () {
                      _this.startProcesses(options.waitEndChilds)
                        .then(function () {
                          global.runtimePlan.plan.scheduleChains();
                        })
                        .catch(function (err) {
                          logger.log("error", "Error in startProcesses:", err);
                        });
                    })
                    .catch(function (err) {
                      logger.log("error", "Error setChainToInitState: ", err);
                    });
                } else {
                  logger.log("debug", `Trying start processes of ${_this.id} but this is running`);
                }
              } else {
                logger.log("debug", `Running chain ${_this.id} disable in calendar`);
              }

            }.bind(null, _this));
            resolve();

          } else {
            _this.startProcesses(options.waitEndChilds)
              .then(function () {
                global.runtimePlan.plan.scheduleChains();
                resolve();
              })
              .catch(function (err) {
                logger.log("error", "Error in startProcesses:", err);
                resolve();
              });
          }
        } else {
          logger.log("error", `Chain ${_this.id} dont have processes`);
          throw new Error(`Chain ${_this.id} dont have processes`);
        }
      } else {
        logger.log("error", `Invalid chain ${_this.id}, processes property not found.`);
        throw new Error(`Invalid chain ${_this.id}, processes property not found.`);
      }
    });
  }

  waiting_dependencies() {
    var _this = this;
    _this.notificate("on_waiting_dependencies");
  }

  setChainToInitState() {
    var _this = this;

    if (_this.isRunning() || _this.isErrored()) {
      _this.end();
    }

    return new Promise((resolve) => {
      // Clear depends_files_ready
      // TODO: REVISAR ESTO - PROBLEMAS SI EXISTEN FICHEROS Y NO SE VUELVE A METER EN depends_files_ready
      _this.depends_files_ready = [];
      _this.execute_input = {};
      //Warning
      if (_this.isRunning()) {
        logger.log("warn", `This chain ${_this.id} is running yet and is being initialized`);
      }
      // Set All Process to stopped
      var processesLength = _this.processes.length;
      while (processesLength--) {
        _this.processes[processesLength].stop();
      }
      resolve();
    });
  }

  refreshChainStatus() {
    return new Promise((resolve) => {

      var processesLength = this.processes.length;
      var statusChain = "end";

      var processesError = 0;
      var processesRunning = 0;
      var processesStop = 0;

      while (processesLength--) {
        switch (this.processes[processesLength].status) {
          case "stop":
            processesStop += 1;
            break;
          case "running":
            processesRunning += 1;
            break;
          case "error":
            processesError += 1;
            break;
          default:
            break;
        }
      }

      processesLength = this.processes.length;
      while (processesLength--) {
        switch (this.processes[processesLength].childs_chains_status) {
          case "stop":
            processesStop += 1;
            break;
          case "running":
            processesRunning += 1;
            break;
          case "error":
            processesError += 1;
            break;
          default:
            break;
        }
      }

      //Set Chain Status
      if (processesRunning > 0 || processesStop > 0) {
        statusChain = "running";
      } else {
        if (processesError > 0) {
          statusChain = "error";
        } else {
          statusChain = "end";
        }
      }

      this.status = statusChain;
      resolve(statusChain);
    });
  }


  startProcess(process, waitEndChilds) {
    var _this = this;

    function checkAnyNotEnded(proc) {
      return !proc.isEnded();
    }

    return new Promise(function (resolve) {
      process.execute_input = _this.execute_input;

      if (process.isStopped()) {
        logger.log("debug", `Process ${process.id} scheduled`);

        var processMustDo = _this.checkProcessActionToDo(process);

        switch (processMustDo) {
          case "run":

            logger.log("debug", `Starting ${process.id}`);

            process.start()
              .then(function () {

                process.startChildChainsDependients(waitEndChilds)
                  .then(function () {
                    _this.startProcesses(waitEndChilds)
                      .then(function () {
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log("error", "Error in startProcess:", err);
                        resolve();
                      });
                  })
                  .catch(function (err) {
                    logger.log("error", "Error in startProcess:", err);
                    _this.startProcesses(waitEndChilds)
                      .then(function () {
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log("error", "Error in startProcess:", err);
                        resolve();
                      });
                  });

              })
              .catch(function (err) {
                err = err || process.execute_err_return;
                logger.log("error", "Process " + process.id, err);

                if (process.end_chain_on_fail) {
                  _this.end();

                  _this.setChainToInitState()
                    .then(function () {
                      logger.log("debug", "setChainToInitState end_chain_on_fail");
                      resolve();
                    })
                    .catch(function (err) {
                      logger.log("error", "Error setChainToInitState on end_chain_on_fail: ", err);
                      resolve();
                    });

                } else {
                  // Aun cuando hay error puede que haya procesos que tengan que ejecutarse:
                  _this.startProcesses(waitEndChilds)
                    .then(function () {
                      resolve();
                    })
                    .catch(function (err) {
                      logger.log("error", "Error in startProcesses (prev errored):", err);
                      resolve();
                    });
                }
              });

            break;
          case "wait":
            process.waiting_dependencies();
            resolve();
            break;
          case "end":
            logger.log("debug", `Ignored: Only executed on_fail ${process.id}`);
            var notificateEnd = false;
            process.end(notificateEnd)
              .then(() => {
                _this.startProcesses(waitEndChilds)
                  .then(function () {
                    resolve();
                  })
                  .catch(function (err) {
                    logger.log("error", "Error in startProcesses (end errored):", err);
                    resolve();
                  });
              });
            break;
          default:
            break;
        }

      } else {
        // SI TODOS LOS PROCESOS DE LA CADENA ESTAN EN ESTADO DISTINTO DE STOP - RESOLVE - ELSE NO HACER NADA
        if (!_this.processes.find(checkAnyNotEnded)) {
          resolve();
        } else {
          resolve();
        }
      }
    });
  }

  startProcesses(waitEndChilds) {
    var _this = this;

    var runningBeforeRefresh = _this.isRunning();

    function execSerie(processes, waitEndChilds) {
      var sequence = Promise.resolve();
      processes.forEach(function (itemProcess) {
        sequence = sequence.then(function () {
          return _this.startProcess(itemProcess, waitEndChilds)
            .then(function () {})
            .catch(function (err) {
              logger.log("error", "chain startProcesses execSerie  startProcesses waitEndChilds. Error ", err);
            });
        });
      });
      return sequence;
    }

    return new Promise(function (resolve) {
      _this.refreshChainStatus()
        .then(function (chainStatus) {

          if (chainStatus === "running" && !runningBeforeRefresh) {
            _this.running();
          }

          // If Chains is running:
          if (chainStatus === "running") {

            if (waitEndChilds) { //Serie

              execSerie(_this.processes, waitEndChilds)
                .then(function () {
                  resolve();
                })
                .catch(function (err) {
                  logger.log("error", "chain startProcesses execSerie waitEndChilds. Error ", err);
                  resolve();
                });

            } else {

              var processRuns = [];
              var processesLength = _this.processes.length;

              while (processesLength--) {
                processRuns.push(_this.startProcess(_this.processes[processesLength], waitEndChilds));
              }

              Promise.all(processRuns)
                .then(function () {
                  resolve();
                })
                .catch(function (err) {
                  logger.log("error", "chain startProcesses:", err);
                  resolve();
                });
            }

          } else {
            if (chainStatus === "end") {
              _this.end();
              resolve();
            } else {
              if (chainStatus === "error") {
                _this.error();
                resolve();
              }
            }
          }
        })
        .catch(function (err) {
          logger.log("error", "Error en chain startProcesses refreshChainStatus: ", err);
          resolve();
        });
    });
  }

  checkProcessActionToDo(process) {
    var _this = this;
    var action = "run";

    if ((process.hasOwnProperty("depends_process") && process.depends_process.length > 0) || (process.hasOwnProperty("depends_conditions") && process.depends_conditions.length > 0)) {
      var depends_process = process.depends_process;
      var planProcess = _this.processes;

      var dependsprocessLength = depends_process.length;

      //File dependences:
      // Check process dependencies
      while (dependsprocessLength--) {
        if (depends_process[dependsprocessLength]) {
          if (depends_process[dependsprocessLength].hasOwnProperty("file_name")) {
            // If any depends files is ready
            if (process.depends_files_ready) {

              // Check if all process depends files is ready
              var depends_files_ready_length = process.depends_files_ready.length;
              var dependenceFound = false;

              while (depends_files_ready_length--) {
                // Using anumatch to check regular expression glob:
                if (anymatch([depends_process[dependsprocessLength].file_name], process.depends_files_ready[depends_files_ready_length])) {
                  dependenceFound = true;
                }
              }

              if (!dependenceFound) {
                action = "wait";
              }

            } else {
              action = "wait";
            }
          }
        }
      }

      //Process dependences:
      var planProcessLength = _this.processes.length;
      dependsprocessLength = depends_process.length;

      while (planProcessLength--) {
        var auxDependsprocessLength = dependsprocessLength;

        while (auxDependsprocessLength--) {
          switch (typeof depends_process[auxDependsprocessLength]) {
            case "string":

              if (depends_process[auxDependsprocessLength] === planProcess[planProcessLength].id) {
                if (!planProcess[planProcessLength].isEnded()) {
                  action = "wait";
                } else {
                  if (planProcess[planProcessLength].isErrored()) {
                    action = "wait";
                  } else {
                    action = "run";
                  }
                }
              }

              break;
            case "object":
              if (!depends_process[auxDependsprocessLength].hasOwnProperty("file_name")) {

                if (depends_process[auxDependsprocessLength].id === planProcess[planProcessLength].id) {

                  if (!planProcess[planProcessLength].isEnded() && !planProcess[planProcessLength].isErrored()) {
                    action = "wait";
                  } else {

                    //CHECK ON_FAIL
                    var on_fail = false;
                    if (depends_process[auxDependsprocessLength].hasOwnProperty("on_fail")) {
                      on_fail = depends_process[auxDependsprocessLength].on_fail;
                    }

                    if (planProcess[planProcessLength].isErrored()) {
                      if (on_fail) {
                        action = "run";
                      } else {
                        action = "wait";
                      }
                    } else {
                      if (on_fail) {
                        action = "end";
                      } else {
                        action = "run";
                      }
                    }

                    // CHECK EVALUATE
                    if (action === "run" && depends_process[auxDependsprocessLength].hasOwnProperty("evaluate")) {
                      var evaluate = depends_process[auxDependsprocessLength].evaluate;
                      var evaluateLength = evaluate.length;
                      var _eval = {};

                      while (evaluateLength--) {
                        _eval = evaluate[evaluateLength];
                        if (!checkEvaluation(_eval.oper_left, _eval.condition, _eval.oper_right, process.values())) {
                          action = "end";
                        }
                      }
                    }
                  }
                }
              }
              break;
            default:
              break;
          }
        }
      }

      // CHECK DEPENDS CONDITIONS
      if (action === "run" && process.hasOwnProperty("depends_conditions")) {
        let depends_conditions = process.depends_conditions;
        let dependsConditionsLength = depends_conditions.length;
        let _eval = {};

        while (dependsConditionsLength--) {
          _eval = depends_conditions[dependsConditionsLength];
          if (!checkEvaluation(_eval.oper_left, _eval.condition, _eval.oper_right, process.values())) {
            action = "end";
          }
        }
      }

      return action;
    } else {
      return action;
    }
  }

  clean(){
    var _this = this;
    delete _this.duration_seconds;
    delete _this.started_at;
    delete _this.ended_at;
  }

}

module.exports = Chain;