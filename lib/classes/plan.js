"use strict";

const logger = require("../utils.js").logger;
const pick = require("../utils.js").pick;
const globToRegExp = require("glob-to-regexp");
const crypto = require("crypto");
const Chain = require("./chain.js");

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
        .catch((err) => {
          reject(err);
        });
    });
  }

  loadChains(chains) {
    let _this = this;

    return new Promise((resolve, reject) => {
      if (chains instanceof Array) {
        let chainLength = chains.length;
        if (chainLength > 0) {
          let planChainsPromises = [];

          while (chainLength--) {
            let chain = chains[chainLength];

            if (chain.disable) {
              logger.log("warn", `Chain ${chain.id} ignored: is setted to disable.`);
            } else {
              const isMainChain = true;
              planChainsPromises.push(_this.loadChain(chain,isMainChain));
            }
          }

          Promise.all(planChainsPromises)
            .then((chains) => {
              resolve(chains);
            })
            .catch((err) => {
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

  loadChain(chain, isMainChain) {
    return new Chain(chain, isMainChain);
  }

  scheduleChains() {
    let _this = this;
    _this.chains.forEach((chain) => {
      // IGNORE ITERABLE CHAINS. SCHEDULED IN PROCESS.END EVENT
      if (!chain.iterable) {
        _this.scheduleChain(chain)
          .then(() => {})
          .catch((err) => {
            logger.log("error", "scheduleChains scheduleChain", err);
          });
      }
    });
  }

  scheduleChain(chain, process, executeInmediate, inputIterableValues, customValues) {
    let _this = this;

    function createChainSerie(inputIterable) {
      let sequence = Promise.resolve();
      inputIterable.forEach(() => {
        sequence = sequence.then(() => {
          chain.parentUId = process.uId;
          if(customValues) Object.assign(chain.custom_values, customValues);
          return _this.loadChain(chain)
            .then((res) => {
              process.childs_chains.push(res);
            })
            .catch((err) => {
              logger.log("error", `scheduleChain createChainSerie loadChain ${chain.id}. Error: `, err);
            });
        });
      });
      return sequence;
    }

    function execSerie(chains, inputIterable) {
      let sequence = Promise.resolve();
      let i = 0;
      let abortIteration = false;
      chains.forEach((_chain) => {
        sequence = sequence.then(() => {
          if (!abortIteration){
            let options = {
              "inputIteration": inputIterable[i],
              "waitEndChilds": true
            };
            return _chain.start(options)
              .then(() => {
                if (_chain.causedByAnProcessError && chain.abort_iteration_serie_on_error){
                  abortIteration = true;
                }
                i = i + 1;
              })
              .catch((err) => {
                i = i + 1;
                logger.log("error", "scheduleChain execSerie Error ", err);
              });
          }else{
            return Promise.resolve();
          }
        });
      });
      return sequence;
    }

    return new Promise((resolve, reject) => {
      if (executeInmediate) {
        chain.stop();
      }

      logger.log("debug", `SCHEDULED CHAIN ${chain.id}`);

      if (!executeInmediate && _this.hasDependenciesBlocking(chain)) {
        chain.waiting_dependencies();
        logger.log("debug", `${chain.id} -> on_waiting_dependencies`);
      } else {

        if (chain.hasOwnProperty("iterable") && chain.iterable && chain.iterable !== "") {
          if (!inputIterableValues) {
            const procValues = process.values();
            const outputIterable = procValues[process.output_iterable];

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
            const execMode = chain.iterable;

            if (execMode === "parallel") {
              process.childs_chains = [];

              createChainSerie(inputIterable)
                .then(() => {
                  let chainsToExecLength = process.childs_chains.length;
                  while (chainsToExecLength--) {
                    const options = {"inputIteration": inputIterable[chainsToExecLength]};
                    process.childs_chains.push(process.childs_chains[chainsToExecLength].start(options));
                  }

                  Promise.all(process.childs_chains)
                    .then(() => {
                      resolve();
                    })
                    .catch((err) => {
                      reject(err);
                    });

                });
            } else {
              //SERIE:
              process.childs_chains = [];

              if (process.fail_on_child_fail && !chain.abort_iteration_serie_on_error){
                logger.log("warn", `Chain ${chain.id} abort_iteration_serie_on_error is setted to true because parent process ${process.id} fail_on_child_fail is true.`);
                chain.abort_iteration_serie_on_error = true;
              }

              createChainSerie(inputIterable)
                .then(() => {
                  execSerie(process.childs_chains, inputIterable)
                    .then(() => {
                      resolve();
                    })
                    .catch((err) => {
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
          if (customValues && chain.custom_values && Object.keys(chain.custom_values).length !== 0) {
            _this.loadChainToPlan(chain)
              .then(() => {
                resolve();
              })
              .catch((err) => {
                reject(`scheduleChain customsValues loadChain ${chain.id}. Error: ${err}`);
              });

            /*
            _this.loadChain(chain)
              .then((_chain) => {
                _this.loadChainToPlan(_chain);
                const options = {"executeInmediate": executeInmediate};
                _chain.start(options)
                  .then(() => {
                    resolve();
                  })
                  .catch((err) => {
                    reject(err);
                  });
              })
              .catch((err) => {
                reject(`scheduleChain customsValues loadChain ${chain.id}. Error: ${err}`);
              });
            */
          } else {
            const options = {"executeInmediate": executeInmediate};
            chain.start(options)
              .then(() => {
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          }
        }
      }
    });
  }

  dependenciesBlocking(chain) {
    let chainsDependencies = [];

    if (chain.hasOwnProperty("depends_chains") && chain.depends_chains.length > 0) {
      const depends_chains = chain.depends_chains;
      let planChains = this.chains;

      let planChainsLength = this.chains.length;
      let dependsChainsLength = depends_chains.length;

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
        let auxDependsChainsLength = dependsChainsLength;

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

                if (!planChains[planChainsLength].isEnded() && !(depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored() && !depends_chains[auxDependsChainsLength].hasOwnProperty("process_id"))) {
                  if (depends_chains[auxDependsChainsLength].hasOwnProperty("process_id")) {
                    let planProcessLength = planChains[planChainsLength].processes.length;

                    //EN LA VALIDACION DE DEPENDENCIES_CHAIN comprobar que tanto el chain ID como el process_id existen
                    while (planProcessLength--) {
                      if (planChains[planChainsLength].processes[planProcessLength].id === depends_chains[auxDependsChainsLength].process_id) {
                        if (!planChains[planChainsLength].processes[planProcessLength].isEnded()) {
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
    let input = [];

    if (chain.hasOwnProperty("depends_chains") && chain.depends_chains.length > 0) {
      const depends_chains = chain.depends_chains;
      let planChains = this.chains;

      let planChainsLength = this.chains.length;
      let dependsChainsLength = depends_chains.length;

      //Chains dependences:
      while (planChainsLength--) {
        let auxDependsChainsLength = dependsChainsLength;
        while (auxDependsChainsLength--) {
          if (typeof depends_chains[auxDependsChainsLength] === "object") {
            if (depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id) {
              if (depends_chains[auxDependsChainsLength].hasOwnProperty("process_id")) {
                let planProcessLength = planChains[planChainsLength].processes.length;
                while (planProcessLength--) {
                  if (planChains[planChainsLength].processes[planProcessLength].id === depends_chains[auxDependsChainsLength].process_id) {
                    const dep_process = planChains[planChainsLength].processes[planProcessLength];
                    const dep_process_values = dep_process.values();
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

  // API:
  getAllChains(_pick) {
    let _this = this;
    let res = [];

    for (const chain of _this.chains){
      if (_pick){
        res.push(pick(chain,_pick));
      }else{
        res.push(chain);
      }
    }

    return res;
  }

  getChainById(chainId, uniqueId, _pick) {
    let _this = this;

    function byId(chain) {
      return (chain.id === chainId && (chain.uId === uniqueId || chain.execId === uniqueId));
    }

    if (_pick){
      return pick(_this.chains.find(byId),_pick);
    }else{
      return _this.chains.find(byId);
    }

  }

  getIndexChainById(chainId, uniqueId, _pick) {
    let _this = this;

    function byId(chain) {
      return (chain.id === chainId && (chain.uId === uniqueId || chain.execId === uniqueId));
    }

    if (_pick){
      return pick(_this.chains.findIndex(byId),_pick);
    }else{
      return _this.chains.findIndex(byId);
    }
  }

  getChainsByName(name, _pick) {
    let _this = this;
    let res = [];

    for (const chain of _this.chains){
      if(globToRegExp(name).test(chain.name)){
        if (_pick){
          res.push(pick(chain,_pick));
        }else{
          res.push(chain);
        }
      }
    }

    return res;
  }

  getChainsByStatus(status, _pick) {
    let _this = this;
    let res = [];

    for (let chain of _this.chains){
      if (status === chain.status){
        if (_pick){
          res.push(pick(chain,_pick));
        }else{
          res.push(chain);
        }
      }
    }

    return res;
  }


  startChain(chainId, uId, inputValues, customValues, noWait){
    let _this = this;
    return new Promise(async (resolve, reject) => {
      let chain = _this.getChainById(chainId, uId);

      if (chain) {
        if (chain.iterable) {
          crypto.randomBytes(16, (err, buffer) => {
            if (err){
              reject("Error creating dummy process. crypto: ",err);
            }else{
              let res_msg = "";
              if (!inputValues) res_msg = "WARNING: empty input values.";
              // CREATE DUMMY PROCESS NEEDED FOR ITERABLE CHAIN:
              let dummy_process = {};
              dummy_process.uId = chainId + "_VP_" + buffer.toString("hex");
              dummy_process.childs_chains = [];

              _this.scheduleChain(chain, dummy_process, true, inputValues, customValues)
                .then(()=>{
                  if(!noWait){
                    resolve(res_msg);
                  }
                })
                .catch(err => {
                  logger.log("error", `scheduleChain ${chainId}`, err);
                });
              if(noWait){
                resolve(res_msg);
              }
            }
          });

        } else {
          _this.scheduleChain(chain, null, true, null, customValues)
            .then(()=>{
              if(!noWait){
                resolve();
              }
            })
            .catch(err => {
              logger.log("error", `scheduleChain ${chainId}`, err);
            });
          if(noWait){
            resolve();
          }
        }
      } else {
        reject(`Chain not found: ID ${chainId}`);
      }
    });
  }

  stopChain(chainId, uniqueId){
    let _this = this;
    return new Promise(async (resolve, reject) => {
      let chain = _this.getChainById(chainId, uniqueId);
      if (chain){
        chain.stop();
        resolve();
      }else{
        reject(`Chain not found: ID ${chainId} - UniqueId: ${uniqueId}`);
      }
    });
  }

  // Load a Chain. If exists replace and If not exists add the chain:
  loadChainToPlan(newChain) {

    let _this = this;
    const chainId = newChain.id;
    const chainuId = newChain.uId;
    const indexChain = _this.getIndexChainById(chainId,chainuId);

    return new Promise(async (resolve, reject) => {
      if (indexChain > -1) {
        _this.chains[indexChain] = newChain;
      } else {
        _this.chains.push(newChain);
      }
      // Schedule load/reload chain
      _this.scheduleChain(_this.getChainById(chainId,chainuId))
        .then(() => {
          resolve();
        })
        .catch((err) => {
          logger.log("error", "loadChainToPlan scheduleChain", err);
          reject("loadChainToPlan scheduleChain" + err);
        });
    });
  }

}
module.exports = Plan;
