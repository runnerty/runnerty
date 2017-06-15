"use strict";

var schedule = require("node-schedule");
var chokidar = require("chokidar");
var logger = require("../utils.js").logger;
var Chain = require("./chain.js");

class Plan {
  constructor(version, chains) {
    this.version = version;
    this.chains = {};
    return new Promise((resolve, reject) => {
      this.loadChains(chains)
        .then((chains) => {
          this.chains = chains;
          resolve(this);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }

  loadChains(chains) {
    var _this = this;

    return new Promise((resolve, reject) => {
      if (chains instanceof Array) {
        var chainLength = chains.length;
        if (chainLength > 0) {
          var planChainsPromises = [];

          while (chainLength--) {
            let chain = chains[chainLength];

            if (chain.disable) {
              logger.log("warn", `Chain ${chain.id} ignored: is setted to disable.`);
            } else {
              planChainsPromises.push(_this.loadChain(chain));
            }
          }

          Promise.all(planChainsPromises)
            .then(function (chains) {
              var chainsLength = chains.length;
              while (chainsLength--) {
                _this.loadChainFileDependencies(chains[chainsLength]);
              }
              resolve(chains);
            })
            .catch(function (err) {
              //logger.log("error", "Loading chains:", err);
              reject(err);
            });

        } else {
          logger.log("error", "Plan have not Chains");
          reject();
        }
      } else {
        logger.log("error", "Chain, processes is not array");
        reject();
      }
    });
  }

  loadChain(chain) {
    return new Chain(chain);
  }

  loadChainFileDependencies(chain) {
    var _this = this;

    if(chain.depends_chains){
      var depends_chain = chain.depends_chains;
      var dependsChainLength = depends_chain.length;

      if (dependsChainLength > 0) {
        while (dependsChainLength--) {
          var dependence = depends_chain[dependsChainLength];

          if (dependence instanceof Object) {
            if (dependence.hasOwnProperty("file_name") && dependence.hasOwnProperty("condition")) {

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
                if (chain.depends_files_ready) {
                  chain.depends_files_ready.push(pathfile);
                } else {
                  chain.depends_files_ready = [pathfile];
                }

                if (!chain.isRunning() && !chain.isErrored()) {
                  _this.scheduleChain(chain)
                    .then(function () {})
                    .catch(function (err) {
                      logger.log("error", "loadChainFileDependencies scheduleChain", err);
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

  }

  scheduleChains() {
    var _this = this;
    _this.chains.forEach(function (chain) {
      // IGNORE ITERABLE CHAINS. SCHEDULED IN PROCESS.END EVENT
      if (!chain.iterable) {
        _this.scheduleChain(chain)
          .then(function () {})
          .catch(function (err) {
            logger.log("error", "scheduleChains scheduleChain", err);
          });
      }
    });
  }

  scheduleChain(chain, process, executeInmediate, inputIterableValues, customValues) {
    var _this = this;

    function createChainSerie(inputIterable) {
      var sequence = Promise.resolve();
      inputIterable.forEach(function () {
        sequence = sequence.then(function () {
          chain.parentUId = process.uId;
          if(customValues) Object.assign(chain.custom_values, customValues);
          return _this.loadChain(chain)
            .then(function (res) {
              process.childs_chains.push(res);
            })
            .catch(function (err) {
              logger.log("error", `scheduleChain createChainSerie loadChain ${chain.id}. Error: `, err);
            });
        });
      });
      return sequence;
    }

    function execSerie(chains, inputIterable) {
      var sequence = Promise.resolve();
      var i = 0;
      chains.forEach(function (chain) {
        sequence = sequence.then(function () {
          var options = {
            "inputIteration": inputIterable[i],
            "waitEndChilds": true
          };
          return chain.start(options)
            .then(function () {
              i = i + 1;
            })
            .catch(function (err) {
              i = i + 1;
              logger.log("error", "scheduleChain execSerie Error ", err);
            });
        });
      });
      return sequence;
    }

    return new Promise((resolve, reject) => {
      if ((chain.schedule_interval !== undefined && chain.scheduleRepeater === undefined) || executeInmediate) {
        chain.stop();
      }
      if ((!chain.end_date || (chain.hasOwnProperty("end_date") && new Date(chain.end_date) > new Date())) && (chain.isStopped()) && (chain.schedule_interval || executeInmediate)) {
        if (chain.hasOwnProperty("start_date") || (chain.hasOwnProperty("iterable") || chain.iterable)) {

          logger.log("debug", `SCHEDULED CHAIN ${chain.id} EN ${(new Date(chain.start_date))}`);

          // Remove Chain from pool
          if (chain.end_date) {
            logger.log("debug", `SCHEDULED CHAIN CANCELATION ${chain.id} IN ${(new Date(chain.end_date))}`);
            chain.scheduleCancel = schedule.scheduleJob(new Date(chain.end_date), function (chain) {
              logger.log("debug", `CANCELANDO CADENA ${chain.id}`);
              chain.schedule.cancel();
            }.bind(null, chain));
          }

          if ((new Date(chain.start_date)) <= (new Date()) || (chain.hasOwnProperty("iterable") || chain.iterable)) {

            logger.log("debug", `start_date: ${(new Date(chain.start_date)) } / now: ${(new Date())}`);
            logger.log("debug", `TRYING START CHAIN ${chain.id} IN ${(new Date(chain.start_date))}`);

            if (!executeInmediate && _this.hasDependenciesBlocking(chain)) {
              chain.waiting_dependencies();
              logger.log("debug", `${chain.id} -> on_waiting_dependencies`);
            } else {

              if (chain.hasOwnProperty("iterable") && chain.iterable && chain.iterable !== "") {
                if (!inputIterableValues) {
                  //var inputIterableValues;
                  var procValues = process.values();

                  var outputIterable = procValues[process.output_iterable];

                  if (!outputIterable) {
                    inputIterableValues = _this.getValuesInputIterable(chain);
                  } else {
                    inputIterableValues = outputIterable;
                  }
                }

                let inputIterable = [];
                if (inputIterableValues && inputIterableValues.length && (inputIterableValues instanceof String)) {
                  try {
                    inputIterable = JSON.parse(inputIterableValues);
                  } catch (err) {
                    reject(`Invalid input (${inputIterableValues}), incorrect JSON` + "\nCaused by: " + err.stack);
                  }
                }else{
                  if(inputIterableValues instanceof Array){
                    inputIterable = inputIterableValues;
                  }
                }

                if (inputIterable.length) {
                  var execMode = chain.iterable;

                  if (execMode === "parallel") {

                    process.childs_chains = [];

                    createChainSerie(inputIterable)
                      .then(function () {
                        var chainsToExecLength = process.childs_chains.length;
                        while (chainsToExecLength--) {
                          var options = {"inputIteration": inputIterable[chainsToExecLength]};
                          process.childs_chains.push(process.childs_chains[chainsToExecLength].start(options));
                        }

                        Promise.all(process.childs_chains)
                          .then(function () {
                            resolve();
                          })
                          .catch(function (err) {
                            reject(err);
                          });

                      });
                  } else {
                    //SERIE:

                    process.childs_chains = [];

                    createChainSerie(inputIterable)
                      .then(function () {
                        execSerie(process.childs_chains, inputIterable)
                          .then(function () {
                            resolve();
                          })
                          .catch(function (err) {
                            reject(err);
                          });
                      });
                  }
                } else {
                  process.stopChildChains();
                  process.endChildChains();
                  logger.log("debug", `input not found for iterable process ${process.id}`);
                  resolve();
                }

              } else {

                Object.assign(chain.custom_values, customValues);
                if (chain.custom_values && Object.keys(chain.custom_values).length !== 0) {
                  _this.loadChain(chain)
                    .then(function (_chain) {
                      var options = {"executeInmediate": executeInmediate};
                      _chain.start(options)
                        .then(function () {
                          //_this.scheduleChains();
                          resolve();
                        })
                        .catch(function (err) {
                          reject(err);
                        });
                    })
                    .catch(function (err) {
                      reject(`scheduleChain customsValues loadChain ${chain.id}. Error: ${err}`);
                    });
                } else {
                  var options = {"executeInmediate": executeInmediate};
                  chain.start(options)
                    .then(function () {
                      resolve();
                    })
                    .catch(function (err) {
                      reject(err);
                    });
                }
              }
            }
          } else {
            // Will execute in start_date set
            chain.schedule = schedule.scheduleJob(new Date(chain.start_date), function (chain) {
              if (_this.hasDependenciesBlocking(chain)) {
                chain.waiting_dependencies();
                logger.log("debug", `${chain.id} -> on_waiting_dependencies`);
                resolve();
              } else {
                logger.log("debug", `${chain.id} -> start`);
                chain.start()
                  .then(function () {
                    resolve();
                  })
                  .catch(function (err) {
                    reject(`scheduleChain chain.start Error: ${err}`);
                  });
              }
            }.bind(null, chain));
          }

        } else {
          reject(`Invalid PlanFile, chain ${chain.id} don´t have start_date.`);
        }
      } else {
        logger.log("debug", `CHAIN ${chain.id} IGNORED: END_DATE ${chain.end_date} < CURRENT DATE: `, new Date(), "-  chain.status:" + chain.status, "- chain.schedule_interval:", chain.schedule_interval, "- chain.scheduleRepeater:", (chain.scheduleRepeater === undefined));
        resolve();
      }
    });
  }

  getChainById(chainId) {
    var _this = this;

    function byId(chain) {
      return chain.id === chainId;
    }

    return _this.chains.find(byId);
  }

  getIndexChainById(chainId) {
    var _this = this;

    function byId(chain) {
      return chain.id === chainId;
    }

    return _this.chains.findIndex(byId);
  }

  // Load a Chain. If exists replace and If not exists add the chain:
  loadChainToPlan(newChain) {

    var _this = this;
    var chainId = newChain.id;
    var indexChain = _this.getIndexChainById(chainId);

    if (indexChain > -1) {
      _this.chains[indexChain] = newChain;
    } else {
      _this.chains.push(newChain);
    }
    // Schedule load/reload chain
    _this.scheduleChain(_this.getChainById(chainId))
      .then(function () {})
      .catch(function (err) {
        logger.log("error", "loadChainToPlan scheduleChain", err);
      });
  }

  dependenciesBlocking(chain) {
    var chainsDependencies = [];

    if (chain.hasOwnProperty("depends_chains") && chain.depends_chains.length > 0) {
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //File dependences:
      while (dependsChainsLength--) {
        if (depends_chains[dependsChainsLength]) {
          if (depends_chains[dependsChainsLength].hasOwnProperty("file_name")) {
            if (chain.depends_files_ready) {
              if (chain.depends_files_ready.indexOf(depends_chains[dependsChainsLength].file_name) < 0) {
                chainsDependencies.push(depends_chains[dependsChainsLength]);
              }
            } else {
              chainsDependencies.push(depends_chains);
            }
          }
        }
      }

      //Chains dependences:
      dependsChainsLength = depends_chains.length;

      while (planChainsLength--) {
        var auxDependsChainsLength = dependsChainsLength;

        while (auxDependsChainsLength--) {
          switch (typeof depends_chains[auxDependsChainsLength]) {
            case "string":
              if (depends_chains[auxDependsChainsLength] === planChains[planChainsLength].id) {
                if (!planChains[planChainsLength].isEnded()) {
                  chainsDependencies.push(planChains[planChainsLength]);
                }
              }
              break;
            case "object":
              if (depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id) {

                //if (planChains[planChainsLength].isEnded() || (depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored() && !depends_chains[auxDependsChainsLength].hasOwnProperty("process_id"))) {
                if (!planChains[planChainsLength].isEnded() && !(depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored() && !depends_chains[auxDependsChainsLength].hasOwnProperty("process_id"))) {
                  if (depends_chains[auxDependsChainsLength].hasOwnProperty("process_id")) {
                    var planProccessLength = planChains[planChainsLength].processes.length;

                    //EN LA VALIDACION DE DEPENDENCIES_CHAIN comprobar que tanto el chain ID como el proccess_id existen
                    while (planProccessLength--) {
                      if (planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id) {
                        if (!planChains[planChainsLength].processes[planProccessLength].isEnded()) {
                          chainsDependencies.push(planChains[planChainsLength]);
                        }
                      }
                    }
                  } else {
                    chainsDependencies.push(planChains[planChainsLength]);
                  }
                }
              }
              break;
            default:
              break;
          }
        }
      }
      return chainsDependencies;
    } else {
      return chainsDependencies;
    }
  }

  hasDependenciesBlocking(chain) {
    return (this.dependenciesBlocking(chain).length > 0);
  }

  getValuesInputIterable(chain) {
    var input = [];

    if (chain.hasOwnProperty("depends_chains") && chain.depends_chains.length > 0) {
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //Chains dependences:
      while (planChainsLength--) {
        var auxDependsChainsLength = dependsChainsLength;
        while (auxDependsChainsLength--) {
          if (typeof depends_chains[auxDependsChainsLength] === "object") {
            if (depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id) {
              if (depends_chains[auxDependsChainsLength].hasOwnProperty("process_id")) {
                var planProccessLength = planChains[planChainsLength].processes.length;
                while (planProccessLength--) {
                  if (planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id) {
                    var dep_process = planChains[planChainsLength].processes[planProccessLength];
                    var dep_process_values = dep_process.values();
                    input = dep_process_values[dep_process.output_iterable];
                  }
                }
              }
            }
          }
        }
      }
      return input;
    } else {
      return input;
    }
  }
}
module.exports = Plan;
