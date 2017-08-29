"use strict";

const utils = require("../utils.js");
const dependsProcess = require("../depends-process.js");
const logger = utils.logger;
const getProcessByUId = utils.getProcessByUId;
const checkCalendar = utils.checkCalendar;
const chokidar = require("chokidar");
const chronometer = utils.chronometer;
const schedule = require("node-schedule");
const crypto = require("crypto");
const mongoChain = require("../mongodb-models/chain.js");

const Process = require("./process.js");
const notificationEvent = require("./notificationEvent.js");

class Chain {
  constructor(chain) {
    this.id = chain.id;
    this.name = chain.name;
    this.uId = "";
    this.iterable = chain.iterable;
    this.parentUId = chain.parentUId;
    this.input = chain.input;
    this.custom_values = chain.custom_values || {};
    this.start_date = chain.start_date;
    this.end_date = chain.end_date;
    this.schedule_interval = chain.schedule_interval;
    this.depends_chains = chain.depends_chains || [];
    this.calendars = chain.calendars;
    this.notifications = {};

    this.status = chain.status || "stop";
    this.started_at = chain.started_at;
    this.ended_at = chain.ended_at;
    this.processes = {};

    return new Promise((resolve, reject) => {
      let _this = this;

      _this.setUid()
        .then(() => {
          _this.loadProcesses(chain.processes)
            .then((processes) => {
              _this.processes = processes;
              _this.loadChainNotifications(chain.notifications)
                .then((notifications) => {
                  _this.notifications = notifications;
                  resolve(_this);
                })
                .catch((err) => {
                  reject(err);
                });
            })
            .catch((err) => {
              reject(err);
            });
        })
        .catch((err) => {
          reject(`Chain ${_this.id} setUid: ` + err);
        });
    });
  }

  setUid() {
    let _this = this;
    return new Promise((resolve) => {
      crypto.randomBytes(16, (err, buffer) => {
        _this.uId = _this.id + "_" + buffer.toString("hex");
        resolve();
      });
    });
  }

  // Executed in construction:
  loadProcesses(processes) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let chainProcessPromises = [];
      let processesLength = processes.length;
      if (processes instanceof Array) {
        if (processesLength > 0) {

          while (processesLength--) {
            processes[processesLength].parentUId = _this.uId;
            processes[processesLength].custom_values = _this.custom_values;
            processes[processesLength].chain_values = _this.values();
            chainProcessPromises.push(_this.loadProcess(processes[processesLength]));
          }

          Promise.all(chainProcessPromises)
            .then((processes) => {
              let processesLength = processes.length;
              while (processesLength--) {
                _this.loadProcessFileDependencies(processes[processesLength]);
              }
              resolve(processes);
            })
            .catch((err) => {
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

  /**
   * Load plan chain notifications and create notifications events.
   * Used in class Chain creation.
   * @param notifications (plan chain object)
   * @returns {Promise} Empty
   */
  loadChainNotifications(notifications) {
    let _this = this;
    return new Promise((resolve, reject) => {
      let processNotificationsPromises = [];

      if (notifications instanceof Object) {
        let events = Object.keys(notifications);
        let eventsLength = events.length;
        if (eventsLength > 0) {
          while (eventsLength--) {
            let event = notifications[events[eventsLength]];
            if (event.length) {
              processNotificationsPromises.push(new notificationEvent(events[eventsLength], event));
            } else {
              logger.log("debug", `Chain ${_this.id} event ${events[eventsLength]} without notifications`);
            }
          }

          Promise.all(processNotificationsPromises)
            .then((notificationsArr) => {
              let notifications = {};
              let notificationsArrLength = notificationsArr.length;
              while (notificationsArrLength--) {
                let e = notificationsArr[notificationsArrLength];
                let key = Object.keys(e);
                notifications[key[0]] = e[key[0]];
              }
              resolve(notifications);
            })
            .catch((err) => {
              //logger.log("error", `Chain ${_this.id} notifications: ` + err);
              reject(err);
            });

        } else {
          logger.log("debug", `Chain ${_this.id} notifications is empty`);
          resolve();
        }
      } else {
        logger.log("debug", `Chain ${_this.id} notifications is not set`);
        resolve();
      }
    });
  }

  loadProcessFileDependencies(process) {
    let _this = this;

    const depends_process = process.depends_process;
    let dependsProcessLength = depends_process.length;

    if (dependsProcessLength > 0) {
      while (dependsProcessLength--) {
        let dependence = depends_process[dependsProcessLength];

        if (dependence instanceof Object) {
          if (dependence.hasOwnProperty("file_name") && dependence.hasOwnProperty("condition")) {

            //TODO: VALIDATE CONDITIONS VALUES
            let watcher = chokidar.watch(dependence.file_name, {
              ignored: /[/\\](\.|~)/,
              persistent: true,
              usePolling: true,
              awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 150
              }
            });

            watcher.on(dependence.condition, (pathfile) => {
              if (process.depends_files_ready) {
                process.depends_files_ready.push(pathfile);
              } else {
                process.depends_files_ready = [pathfile];
              }

              // If chain is running try execute processes:
              if (_this.isRunning()) {
                _this.startProcesses()
                  .then(() => {})
                  .catch((err) => {
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

  getProcessById(processId, _pick) {
    let _this = this;

    function byId(process) {
      return process.id === processId;
    }

    if (_pick){
      return utils.pick(_this.processes.find(byId), _pick);
    }else{
      return _this.processes.find(byId);
    }
  }

  values() {
    let _this = this;

    let chain_values = {
      "CHAIN_ID": _this.id,
      "CHAIN_NAME": _this.name,
      "CHAIN_STARTED_AT": _this.started_at,
      "CHAIN_DURATION_SECONDS": _this.duration_seconds,
      "CHAIN_DURATION_HUMANIZED": _this.duration_humanized
    };
    let values = {};
    Object.assign(values, chain_values);
    Object.assign(values, _this.execute_input);
    Object.assign(values, _this.custom_values);
    return values;
  }

  notificate(event) {
    let _this = this;
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
    let _this = this;

    return new Promise((resolve) => {
      if (global.config.historyEnabled) {
        let mChain = new mongoChain
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
          depends_chains: _this.depends_chains
        });

        mChain.save((err) => {
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
    let _this = this;
    return (_this.status === "stop");
  }

  isEnded() {
    let _this = this;
    return (_this.status === "end");
  }

  isRunning() {
    let _this = this;
    return (_this.status === "running");
  }

  isErrored() {
    let _this = this;
    return (_this.status === "error");
  }

  stop() {
    let _this = this;
    _this.status = "stop";
    let processesLength = _this.processes.length;
    while (processesLength--) {
      _this.processes[processesLength].stop();
    }

  }

  end() {
    let _this = this;
    if (!_this.isEnded()){
      _this.status = "end";
      let duration = chronometer(_this.hr_started_time);
      _this.duration_seconds = duration[0];
      _this.duration_humanized = duration[1];
      let currentDate = new Date();
      _this.ended_at = currentDate.toString();
      _this.notificate("on_end");
      _this.refreshParentProcessChildsChainsStatus();
      _this.historicize();
    }
  }

  refreshParentProcessChildsChainsStatus() {
    let _this = this;
    const globalPlanChains = global.runtimePlan.plan.chains;

    let processParentFound = getProcessByUId(globalPlanChains, _this.parentUId);

    if (processParentFound) {
      processParentFound.refreshProcessChildsChainsStatus()
        .then((processChildsChainsStatus) => {
          if (processChildsChainsStatus === "end") {
            processParentFound.endChildChains();
          }
        })
        .catch((err) => {
          logger.log("error", "Error in chain refreshParentProcessChildsChainsStatus:", err);
        });
    }
  }

  running() {
    let _this = this;
    _this.status = "running";
    let currentDate = new Date();
    _this.started_at = currentDate.toString();
    _this.hr_started_time = chronometer();

    _this.notificate("on_start");
    _this.historicize("start");
  }

  error() {
    let _this = this;
    _this.status = "error";
    _this.notificate("on_fail");
    _this.historicize();
  }

  //Start Chain
  start(options) {
    let _this = this;
    _this.clean();

    if (options.inputIteration) {
      let inputLength = _this.input.length;
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
              let chainCalendarEnable = true;
              if (_this.calendars) {
                chainCalendarEnable = await checkCalendar(_this.calendars);
              }
              if (chainCalendarEnable) {
                if (_this.isStopped() || _this.isEnded()) {
                  _this.setChainToInitState()
                    .then(() => {
                      _this.startProcesses(options.waitEndChilds)
                        .then(() => {
                          global.runtimePlan.plan.scheduleChains();
                        })
                        .catch((err) => {
                          logger.log("error", "Error in startProcesses:", err);
                        });
                    })
                    .catch((err) => {
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
              .then(() => {
                global.runtimePlan.plan.scheduleChains();
                resolve();
              })
              .catch((err) => {
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
    let _this = this;
    _this.notificate("on_waiting_dependencies");
  }

  setChainToInitState() {
    let _this = this;

    if (_this.isRunning() || _this.isErrored()) {
      _this.end();
    }

    return new Promise((resolve) => {
      // Clear depends_files_ready
      _this.depends_files_ready = [];
      _this.execute_input = {};
      //Warning
      if (_this.isRunning()) {
        logger.log("warn", `This chain ${_this.id} is running yet and is being initialized`);
      }
      // Set All Process to stopped
      let processesLength = _this.processes.length;
      while (processesLength--) {
        _this.processes[processesLength].stop();
      }
      resolve();
    });
  }

  refreshChainStatus() {
    let _this = this;
    return new Promise((resolve) => {
      let processesLength = this.processes.length;
      let statusChain = "end";

      let processesError = 0;
      let processesRunning = 0;
      let processesIgnored = 0;
      let processesStop = 0;
      let processesEnded = 0;

      while (processesLength--) {
        switch (this.processes[processesLength].status) {
          case "end":
            processesEnded += 1;
            break;
          case "stop":
            processesStop += 1;
            break;
          case "running":
            processesRunning += 1;
            break;
          case "ignored":
            processesIgnored += 1;
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
          case "ignored":
            processesIgnored += 1;
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

          if(_this.processes.length === (processesIgnored + processesEnded)){
            statusChain = "end";
          }else{
            if(processesIgnored > 0){
              statusChain = "ignore";
            }else{
              if(_this.status === "end"){
                statusChain = "ignore";
              }else{
                statusChain = "end";
              }
            }
          }
        }
      }

      if(statusChain === "end"){
        this.end();
      }else{
        this.status = statusChain;
      }

      resolve(statusChain);
    });
  }


  startProcess(process, waitEndChilds) {
    let _this = this;

    function checkAnyNotEnded(proc) {
      return !(proc.isEnded() || proc.isIgnored());
    }

    return new Promise(async (resolve) => {
      process.execute_input = _this.execute_input;

      if (process.isStopped()) {
        logger.log("debug", `Process ${process.id} scheduled`);

        const processMustDo = await _this.checkProcessActionToDo(process);

        switch (processMustDo) {
          case "run":

            logger.log("debug", `Starting ${process.id}`);
            process.start()
              .then(() => {
                process.startChildChainsDependients(waitEndChilds)
                  .then(() => {
                    _this.startProcessesCtrl(waitEndChilds, resolve);
                  })
                  .catch((err) => {
                    logger.log("error", "Error in startProcess:", err);
                    _this.startProcessesCtrl(waitEndChilds, resolve);
                  });

              })
              .catch((err) => {
                err = err || process.execute_err_return;
                logger.log("error", "Process " + process.id, err);

                if (process.end_chain_on_fail) {
                  _this.end();

                  _this.setChainToInitState()
                    .then(() => {
                      logger.log("debug", "setChainToInitState end_chain_on_fail");
                      resolve();
                    })
                    .catch((err) => {
                      logger.log("error", "Error setChainToInitState on end_chain_on_fail: ", err);
                      resolve();
                    });

                } else {
                  // Try run process on fail:
                  _this.startProcessesCtrl(waitEndChilds, resolve);
                }
              });

            break;
          case "wait":
            process.waiting_dependencies();
            resolve();
            break;
          case "ignore":
            logger.log("debug", `Process ignored: ${process.id}`);
            process.ignore();
            _this.startProcessesCtrl(waitEndChilds, resolve);
            break;
          case "end":
            logger.log("debug", `End ignored: Only executed on_fail ${process.id}`);
            var notificateEnd = false;
            process.end(notificateEnd)
              .then(() => {
                _this.startProcessesCtrl(waitEndChilds, resolve);
              });
            break;
          default:
            break;
        }

      } else {
        // IF ALL PROCESS OF CHAIN ARE IN STATE DISTINCT OF STOP - RESOLVE - ELSE NOT DO NOTHING
        if (!_this.processes.find(checkAnyNotEnded)) {
          resolve();
        } else {
          resolve();
        }
      }
    });
  }

  startProcessesCtrl(waitEndChilds, _resolve){
    let _this = this;
    _this.startProcesses(waitEndChilds)
      .then(() => {
        _resolve();
      })
      .catch((err) => {
        logger.log("error", "Error in startProcesses:", err);
        _resolve();
      });
  }

  startProcesses(waitEndChilds) {
    let _this = this;
    const runningBeforeRefresh = _this.isRunning();

    function execSerie(processes, waitEndChilds) {
      let sequence = Promise.resolve();
      processes.forEach((itemProcess) => {
        sequence = sequence.then(() => {
          return _this.startProcess(itemProcess, waitEndChilds)
            .then(() => {})
            .catch((err) => {
              logger.log("error", "chain startProcesses execSerie  startProcesses waitEndChilds. Error ", err);
            });
        });
      });
      return sequence;
    }

    return new Promise((resolve) => {
      _this.refreshChainStatus()
        .then((chainStatus) => {

          if (chainStatus === "running" && !runningBeforeRefresh) {
            _this.running();
          }

          // If Chains is running:
          if (chainStatus === "running") {

            if (waitEndChilds) { //Serie

              execSerie(_this.processes, waitEndChilds)
                .then(() => {
                  resolve();
                })
                .catch((err) => {
                  logger.log("error", "chain startProcesses execSerie waitEndChilds. Error ", err);
                  resolve();
                });

            } else {

              let processRuns = [];
              let processesLength = _this.processes.length;

              while (processesLength--) {
                processRuns.push(_this.startProcess(_this.processes[processesLength], waitEndChilds));
              }

              Promise.all(processRuns)
                .then(() => {
                  resolve();
                })
                .catch((err) => {
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
              }else{
                resolve();
              }
            }
          }
        })
        .catch((err) => {
          logger.log("error", "Error en chain startProcesses refreshChainStatus: ", err);
          resolve();
        });
    });
  }

  checkProcessActionToDo(process) {
    let _this = this;
    return new Promise( (resolve, reject) => {
      // If process have depends_process:
      if (process.hasOwnProperty("depends_process")) {
        dependsProcess.getAction(process.depends_process, _this.processes)
          .then(res => {
            resolve(res);
          })
          .catch(err => {
            reject(err);
          });
      }else{
        // If process dont have depends_process must run.
        resolve("run");
      }
    });
  }

  clean(){
    let _this = this;
    delete _this.duration_seconds;
    delete _this.started_at;
    delete _this.ended_at;
  }

}

module.exports = Chain;