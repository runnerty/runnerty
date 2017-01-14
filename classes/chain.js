"use strict";

var schedule = require('node-schedule');
var anymatch = require('anymatch');
var logger = require("../libs/utils.js").logger;
var crypto = require('crypto');
var getProcessByUId = require("../libs/utils.js").getProcessByUId;
var checkEvaluation = require("../libs/utils.js").checkEvaluation;
var chronometer = require("../libs/utils.js").chronometer;

var Process = require("./process.js");
var Event = require("./event.js");

class Chain {
  constructor(id, name, parentUId, iterable, input, custom_values, start_date, end_date, schedule_interval, depends_chains, depends_chains_alt, events, processes, status, started_at, ended_at) {
    this.id = id;
    this.name = name;
    this.uId = '';
    this.iterable = iterable;
    this.parentUId = parentUId;
    this.input = input;
    this.custom_values = custom_values;
    this.start_date = start_date;
    this.end_date = end_date;
    this.schedule_interval = schedule_interval;
    this.depends_chains = depends_chains;
    this.depends_chains_alt = depends_chains_alt;
    this.events = {};

    this.status = status || "stop";
    this.started_at = started_at;
    this.ended_at = ended_at;
    this.processes = {};

    return new Promise((resolve) => {
      var _this = this;

      _this.setUid()
        .then(() => {
          _this.loadProcesses(processes)
            .then((processes) => {
              _this.processes = processes;
              _this.loadEvents(events)
                .then((events) => {
                  _this.events = events;
                  resolve(_this);
                })
                .catch(function (err) {
                  logger.log('error', `Chain ${_this.id} loadEvents: ` + err);
                  resolve();
                });
            })
            .catch(function (err) {
              logger.log('error', `Chain ${_this.id} loadProcesses: ` + err);
              resolve();
            });
        })
        .catch(function (err) {
          logger.log('error', `Chain ${_this.id} setUid: ` + err);
          resolve();
        });
    });
  };

  setUid() {
    var _this = this;
    return new Promise((resolve) => {
      crypto.randomBytes(16, function (err, buffer) {
        _this.uId = _this.id + '_' + buffer.toString('hex');
        resolve();
      });
    });
  }

  // Executed in construction:
  loadProcesses(processes) {
    var _this = this;
    return new Promise((resolve) => {
      var chainProcessPromises = [];
      var processesLength = processes.length;
      if (processes instanceof Array) {
        if (processesLength > 0) {

          while (processesLength--) {
            var process = processes[processesLength];
            chainProcessPromises.push(_this.loadProcess(process, _this.uId, _this.custom_values));
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
              logger.log('error', `Chain ${_this.id} loadProcesses:`, err);
              resolve();
            });

        } else {
          resolve();
        }
      } else {
        logger.log('error', `Chain ${_this.id} processes is not array`);
        resolve();
      }
    });
  }

  loadProcess(process, parentUId, custom_values) {
    var _this = this;
    return new Process(
      process.id,
      process.name,
      parentUId,
      process.depends_process,
      process.depends_process_alt,
      process.exec,
      process.args,
      process.retries,
      process.retry_delay,
      process.limited_time_end,
      process.end_on_fail,
      process.end_chain_on_fail,
      process.events,
      process.status,
      process.execute_return,
      process.execute_err_return,
      process.started_at,
      process.ended_at,
      process.output,
      process.output_iterable,
      process.output_share,
      custom_values,
      _this.values());
  }

  loadEvents(events) {
    var _this = this;
    return new Promise((resolve) => {
      var processEventsPromises = [];

      if (events instanceof Object) {
        var keys = Object.keys(events);
        var keysLength = keys.length;
        if (keysLength > 0) {
          while (keysLength--) {
            var event = events[keys[keysLength]];
            if (event.hasOwnProperty('notifications')) {
              processEventsPromises.push(new Event(keys[keysLength],
                event.process,
                event.notifications
              ));
            } else {
              logger.log('warn',`Chain ${_this.id} Events without procces and notifications`);
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
            .catch(function (err) {
              logger.log('error', `Chain ${_this.id} events: ` + err);
              resolve();
            });

        } else {
          logger.log('warn', `Chain ${_this.id} events is empty`);
          resolve();
        }
      } else {
        logger.log('warn', `Chain ${_this.id} events is not object`);
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
        var dependence = depends_process[dependsProcessLength];

        if (dependence instanceof Object) {
          if (dependence.hasOwnProperty('file_name') && dependence.hasOwnProperty('condition')) {

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
                  .then(function (res) {
                    //chain.end();
                  })
                  .catch(function (err) {
                    logger.log('error', 'Error in loadProcessFileDependencies startProcesses:', err);
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
      "CHAIN_STARTED_AT": _this.started_at
    };

    var values = Object.assign(chain_values, _this.execute_input);
    values = Object.assign(values, _this.custom_values);

    return values;
  }

  notificate(event) {
    var _this = this;
    if (_this.hasOwnProperty('events') && _this.events !== undefined) {
      if (_this.events.hasOwnProperty(event)) {
        if (_this.events[event].hasOwnProperty('notifications')) {
          var notificationsLength = _this.events[event].notifications.length;
          while (notificationsLength--) {
            _this.events[event].notifications[notificationsLength].notificate(_this.values());
          }
        }
      }
    }
  }

  isStopped() {
    var _this = this;
    return (_this.status === 'stop');
  }

  isEnded() {
    var _this = this;
    return (_this.status === 'end');
  }

  isRunning() {
    var _this = this;
    return (_this.status === 'running');
  }

  isErrored() {
    var _this = this;
    return (_this.status === 'error');
  }

  stop() {
    var _this = this;
    _this.status = 'stop';

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
    _this.status = 'end';
    _this.notificate('on_end');

    _this.refreshParentProcessChildsChainsStatus();
  }

  refreshParentProcessChildsChainsStatus() {
    var _this = this;
    var globalPlanChains = global.runtimePlan.plan.chains;

    var processParentFound = getProcessByUId(globalPlanChains, _this.parentUId);

    if (processParentFound) {
      processParentFound.refreshProcessChildsChainsStatus()
        .then(function (processChildsChainsStatus) {
          if (processChildsChainsStatus === 'end') {
            processParentFound.endChildChains();
          }
        })
        .catch(function (err) {
          logger.log('error', 'Error in chain refreshParentProcessChildsChainsStatus:', err);
        });
    }
  }

  running() {
    this.started_at = new Date();
    this.hr_started_time = chronometer();

    this.notificate('on_start');
  }

  error() {
    this.status = 'error';
    this.notificate('on_fail');
  }

  //Start Chain
  start(inputIteration, executeInmediate, /* for serie executions*/ waitEndChilds) {
    var chain = this;

    if (inputIteration) {

      var inputLength = chain.input.length;
      chain.execute_input = {};

      while (inputLength--) {
        var key = Object.keys(chain.input[inputLength])[0];
        var value = chain.input[inputLength][key];
        chain.execute_input[key] = inputIteration[value];
      }
    }

    return new Promise((resolve) => {

      if (chain.hasOwnProperty('processes')) {
        if (chain.processes instanceof Array && chain.processes.length > 0) {
          // Initialize Chain
          if (chain.schedule_interval && !executeInmediate) {

            chain.scheduleRepeater = schedule.scheduleJob(chain.schedule_interval, function (chain) {

              if ((new Date(chain.end_date)) < (new Date())) {
                chain.scheduleRepeater.cancel();
              }

              if (chain.isStopped() || chain.isEnded()) {
                chain.setChainToInitState()
                  .then(function () {
                    chain.startProcesses(waitEndChilds)
                      .then(function () {
                        //chain.end();
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log('error', 'Error in startProcesses:', err);
                        resolve();
                      });
                  })
                  .catch(function (err) {
                    logger.log('error', 'Error setChainToInitState: ', err);
                    resolve();
                  });
              } else {
                logger.log('warn', `Trying start processes of ${chain.id} but this is running`);
                resolve();
              }
            }.bind(null, chain));

          } else {
            chain.startProcesses(waitEndChilds)
              .then(function () {
                //if (inputIteration) chain.end();
                resolve();
              })
              .catch(function (err) {
                logger.log('error', 'Error in startProcesses:', err);
                resolve();
              });
          }
        } else {
          logger.log('error', `Chain ${chain.id} dont have processes`);
          throw new Error(`Chain ${chain.id} dont have processes`);
          //resolve();
        }
      } else {
        logger.log('error', `Invalid chain ${chain.id}, processes property not found.`);
        throw new Error(`Invalid chain ${chain.id}, processes property not found.`);
        //resolve();
      }
    });
  }

  waiting_dependencies() {
    var _this = this;
    _this.notificate('on_waiting_dependencies');
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
        logger.log('warn', `This chain ${_this.id} is running yet and is being initialized`)
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
      var statusChain = 'end';

      var processesError = 0;
      var processesEnd = 0;
      var processesRunning = 0;
      var processesStop = 0;

      while (processesLength--) {
        switch (this.processes[processesLength].status) {
          case 'stop'   :
            processesStop += 1;
            break;
          case 'end'    :
            processesEnd += 1;
            break;
          case 'running':
            processesRunning += 1;
            break;
          case 'error'  :
            processesError += 1;
            break;
        }
      }

      processesLength = this.processes.length;
      while (processesLength--) {
        switch (this.processes[processesLength].childs_chains_status) {
          case 'stop'   :
            processesStop += 1;
            break;
          case 'end'    :
            processesEnd += 1;
            break;
          case 'running':
            processesRunning += 1;
            break;
          case 'error'  :
            processesError += 1;
            break;
        }
      }

      //Set Chain Status
      if (processesRunning > 0 || processesStop > 0) {
        statusChain = 'running';
      } else {
        if (processesError > 0) {
          statusChain = 'error';
        } else {
          statusChain = 'end';
        }
      }

      this.status = statusChain;
      resolve(statusChain);
    });
  }


  startProcess(process, waitEndChilds) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      process.execute_input = _this.execute_input;

      if (process.isStopped()) {
        logger.log('debug', `Process ${process.id} scheduled`);

        var processMustDo = _this.checkProcessActionToDo(process);

        switch (processMustDo) {
          case 'run':

            logger.log('debug', `Starting ${process.id}`);

            process.start()
              .then(function () {

                process.startChildChainsDependients(waitEndChilds)
                  .then(function (res) {
                    _this.startProcesses(waitEndChilds)
                      .then(function (res) {
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log('error', 'Error in startProcess:', err);
                        resolve();
                      });
                  })
                  .catch(function (err) {
                    logger.log('error', 'Error in startProcess:', err);
                    _this.startProcesses(waitEndChilds)
                      .then(function (res) {
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log('error', 'Error in startProcess:', err);
                        resolve();
                      });
                  });

              })
              .catch(function (proc, err) {
                err = err || proc.execute_err_return;
                logger.log('error', 'Error in process.start: ', err);

                if (proc.end_chain_on_fail) {
                  _this.end();

                  _this.setChainToInitState()
                    .then(function () {
                      logger.log('debug', 'setChainToInitState end_chain_on_fail');
                      resolve();
                    })
                    .catch(function (err) {
                      logger.log('error', 'Error setChainToInitState on end_chain_on_fail: ', err);
                      resolve();
                    });

                } else {
                  // Aun cuando hay error puede que haya procesos que tengan que ejecutarse:
                  _this.startProcesses(waitEndChilds)
                    .then(function () {
                      resolve();
                    })
                    .catch(function (err) {
                      logger.log('error', 'Error in startProcesses (prev errored):', err);
                      resolve();
                    });
                }
              });

            break;
          case 'wait':
            process.waiting_dependencies();
            resolve();
            break;
          case 'end':
            logger.log('debug', `Ignored: Only executed on_fail ${process.id}`);
            var notificateEnd = false;
            process.end(notificateEnd);

            _this.startProcesses(waitEndChilds)
              .then(function (res) {
                resolve();
              })
              .catch(function (err) {
                logger.log('error', 'Error in startProcesses (end errored):', err);
                resolve();
              });

            break;
        }

      } else {
        // SI TODOS LOS PROCESOS DE LA CADENA ESTAN EN ESTADO DISTINTO DE STOP - RESOLVE - ELSE NO HACER NADA
        function checkAnyNotEnded(proc) {
          return !proc.isEnded();
        }

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

    return new Promise(function (resolve, reject) {
      _this.refreshChainStatus()
        .then(function (chainStatus) {

          if (chainStatus === 'running' && !runningBeforeRefresh) {
            _this.running();
          }

          // If Chains is running:
          if (chainStatus === 'running') {

            if (waitEndChilds) { //Serie
              function execSerie (processes) {
                var sequence = Promise.resolve();
                processes.forEach(function (itemProcess) {
                  sequence = sequence.then(function () {
                    return _this.startProcess(itemProcess, waitEndChilds)
                      .then(function (res) {
                      })
                      .catch(function (err) {
                        logger.log('error', 'chain startProcesses execSerie  startProcesses waitEndChilds. Error ', err);
                      });
                  });
                });
                return sequence;
              }

              execSerie(_this.processes)
                .then(function () {
                  resolve();
                })
                .catch(function (err) {
                  logger.log('error', 'chain startProcesses execSerie waitEndChilds. Error ', err);
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
                  logger.log('error', `chain startProcesses:`, err)
                  resolve();
                });
            }

          } else {
            if (chainStatus === 'end') {
              _this.end();
              resolve();
            } else {
              if (chainStatus === 'error') {
                _this.error();
                resolve();
              }
            }
          }
        })
        .catch(function (err) {
          logger.log('error', 'Error en chain startProcesses refreshChainStatus: ', err);
          resolve();
        });
    });
  }

  checkProcessActionToDo(process) {
    var _this = this;
    var action = 'run';

    if (process.hasOwnProperty('depends_process') && process.depends_process.length > 0) {
      var depends_process = process.depends_process;
      var planProcess = _this.processes;

      var dependsprocessLength = depends_process.length;

      //File dependences:
      // Check process dependencies
      while (dependsprocessLength--) {
        if (typeof depends_process[dependsprocessLength]) {
          if (depends_process[dependsprocessLength].hasOwnProperty('file_name')) {
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
                action = 'wait';
              }

            } else {
              action = 'wait';
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
            case 'string':

              if (depends_process[auxDependsprocessLength] === planProcess[planProcessLength].id) {
                if (!planProcess[planProcessLength].isEnded()) {
                  action = 'wait';
                } else {
                  if (planProcess[planProcessLength].isErrored()) {
                    action = 'wait';
                  } else {
                    action = 'run';
                  }
                }
              }

              break;
            case 'object':
              if (!depends_process[auxDependsprocessLength].hasOwnProperty('file_name')) {

                if (depends_process[auxDependsprocessLength].id === planProcess[planProcessLength].id) {

                  if (!planProcess[planProcessLength].isEnded() && !planProcess[planProcessLength].isErrored()) {
                    action = 'wait';
                  } else {

                    //CHECK ON_FAIL
                    var on_fail = false;
                    if (depends_process[auxDependsprocessLength].hasOwnProperty('on_fail')) {
                      on_fail = depends_process[auxDependsprocessLength].on_fail;
                    }

                    if (planProcess[planProcessLength].isErrored()) {
                      if (on_fail) {
                        action = 'run';
                      } else {
                        action = 'wait';
                      }
                    } else {
                      if (on_fail) {
                        action = 'end';
                      } else {
                        action = 'run';
                      }
                    }

                    // CHECK EVALUATE
                    if (action === 'run' && depends_process[auxDependsprocessLength].hasOwnProperty('evaluate')) {
                      var evaluate = depends_process[auxDependsprocessLength].evaluate;
                      var evaluateLength = evaluate.length;
                      var _eval = {};

                      while (evaluateLength--) {
                        _eval = evaluate[evaluateLength];
                        if (!checkEvaluation(_eval.oper_left, _eval.condition, _eval.oper_right, process.values())) {
                          action = 'wait';
                        }
                      }
                    }
                  }
                }
              }
              break;
          }
        }
      }
      return action;
    } else {
      return action;
    }
  }
}

module.exports = Chain;