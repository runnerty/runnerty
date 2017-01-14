"use strict";

var schedule   = require('node-schedule');
var chokidar   = require('chokidar');
var logger     = require("../libs/utils.js").logger;
var Chain      = require("./chain.js");

class Plan{
  constructor(version, chains){
    this.version = version;
    this.chains;
    return new Promise((resolve) => {
      this.loadChains(chains)
      .then((chains) => {
        this.chains = chains;
        resolve(this);
      })
      .catch(function(e){
        logger.log('error','Plan constructor:'+e);
        resolve(this);
      });
  });
  }

  loadChains(chains){
    var _this = this;

    return new Promise((resolve) => {
        if (chains instanceof Array) {
      var chainLength = chains.length;
      if (chainLength > 0) {
        var planChainsPromises = [];

        while(chainLength--){
          var chain = chains[chainLength];

          if(chain.disable){
            logger.log('warn',`Chain ${chain.id} ignored: is setted to disable.`);
          }else{
            planChainsPromises.push(_this.loadChain(chain));
          }
        }

        Promise.all(planChainsPromises)
          .then(function(chains) {
            var chainsLength = chains.length;
            while(chainsLength--){
              _this.loadChainFileDependencies(chains[chainsLength]);
            }
            resolve(chains);
          })
          .catch(function(e){
            logger.log('error','Loading chains:'+e);
            resolve();
          });

      }else{
        logger.log('error','Plan have not Chains');
        resolve();
      }
    }else{
      logger.log('error','Chain, processes is not array');
      resolve();
    }
  });
  }

  loadChain(chain, parentUId, custom_values){

    return new Promise((resolve) => {
        new Chain(chain.id,
          chain.name,
          parentUId,
          chain.iterable,
          chain.input,
          custom_values,
          chain.start_date,
          chain.end_date,
          chain.schedule_interval,
          chain.depends_chains,
          chain.depends_chains_alt,
          chain.events,
          chain.processes,
          chain.status,
          chain.started_at,
          chain.ended_at)
          .then(function(res) {
            // console.log(res);
            resolve(res);
          })
          .catch(function(e){
            logger.log('error','Loading chain:'+e);
            resolve();
          });
  });
  }

  loadChainFileDependencies(chain){
    var _this = this;

    var depends_chain = chain.depends_chains;
    var dependsChainLength = depends_chain.length;

    if (dependsChainLength > 0) {
      while (dependsChainLength--) {
        var dependence = depends_chain[dependsChainLength];

        if(dependence instanceof Object){
          if(dependence.hasOwnProperty('file_name') && dependence.hasOwnProperty('condition')){

            var watcher = chokidar.watch(dependence.file_name, { ignored: /[\/\\](\.|\~)/,
              persistent: true,
              usePolling: true,
              awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 150
              }
            });

            watcher.on(dependence.condition, function(pathfile) {
              if(chain.depends_files_ready){
                chain.depends_files_ready.push(pathfile);
              }else{
                chain.depends_files_ready = [pathfile];
              }

              if(!chain.isRunning() && !chain.isErrored()){
                _this.scheduleChain(chain)
                  .then(function(res) {
                  })
                  .catch(function(e){
                    logger.log('error','loadChainFileDependencies scheduleChain'+e);
                  });
              }
            })

            if(process.file_watchers){
              process.file_watchers.push(watcher);
            }else{
              process.file_watchers = [watcher];
            }

          }
        }
      }
    }
  }

  scheduleChains(){
    var _this = this;

    _this.chains.forEach(function (chain) {
      // IGNORE ITERABLE CHAINS. SCHEDULED IN PROCESS.END EVENT
      if(!chain.iterable){
        _this.scheduleChain(chain)
          .then(function(res) {
          })
          .catch(function(e){
            logger.log('error','scheduleChains scheduleChain'+e);
          });
      }
    });
  };

  scheduleChain(chain, process, executeInmediate, inputIterableValues, customValues){
    var _this = this;
    // Cuando llega una cadena con running pero sin scheduleRepeater la cadena debe volver a empezar
    // Espero que se den por ejecutados los procesos con estado "end" y así continue la ejecución por donde debe:

    return new Promise((resolve) => {
        if((chain.schedule_interval !== undefined && chain.scheduleRepeater === undefined) || executeInmediate){
      chain.stop();
    };
    if ((!chain.end_date || (chain.hasOwnProperty('end_date') && new Date(chain.end_date) > new Date())) && (chain.isStopped()))
    {
      console.log('CHAIN '+chain.id+' ENTRA! ');
      if(chain.hasOwnProperty('start_date') || (chain.hasOwnProperty('iterable') || chain.iterable)){

        logger.log('debug', `SCHEDULED CHAIN ${chain.id} EN ${(new Date(chain.start_date))}`);

        // Remove Chain from pool
        if(chain.end_date){
          logger.log('debug',`SCHEDULED CHAIN CANCELATION ${chain.id} IN ${(new Date(chain.end_date))}`);
          chain.scheduleCancel = schedule.scheduleJob(new Date(chain.end_date), function(chain){
            logger.log('debug',`CANCELANDO CADENA ${chain.id}`);
            chain.schedule.cancel();
          }.bind(null,chain));
        }

        if ((new Date(chain.start_date)) <= (new Date()) || (chain.hasOwnProperty('iterable') || chain.iterable)){

          logger.log('debug', `start_date: ${(new Date(chain.start_date)) } / now: ${(new Date())}`);

          //.log('- - - - - - - - - - - - - - - - - - - - - - - - ',chain.id,' - - - - - - - - - - - - - - - - - - - - - - - -');
          //console.log('- chain.id:',chain.id);
          //console.log('- chain.status:',chain.status);
          //console.log('- chain.end_date:',chain.end_date);
          //console.log('- chain.!chain.end_date:',!chain.end_date);
          //console.log('- chain.hasOwnProperty(end_date):',chain.hasOwnProperty('end_date'));


          logger.log('debug', `TRYING START CHAIN ${chain.id} IN ${(new Date(chain.start_date))}`);

          if(!executeInmediate && _this.hasDependenciesBlocking(chain)){
            chain.waiting_dependencies();
            logger.log('warn', `Ejecutar cadena ${chain.id} -> on_waiting_dependencies`);
          }else{

            //console.log('SIN BLOQUEOS PARA LA EJECUCION! ',chain.id);
            if(chain.hasOwnProperty('iterable') && chain.iterable && chain.iterable !== ''){

              if(!inputIterableValues){
                //var inputIterableValues;
                var procValues = process.values();
                var outputIterable = procValues[process.output_iterable];

                if(!outputIterable){
                  inputIterableValues = _this.getValuesInputIterable(chain);
                }else{
                  inputIterableValues = outputIterable;
                }
              }

              if (inputIterableValues){
                var inputIterable;
                var inputIterableLength;

                try {
                  inputIterable = JSON.parse(inputIterableValues);
                  inputIterableLength = inputIterable.length;
                } catch(err) {
                  var newErr = new Error(`Invalid input (${inputIterableValues}), incorrect JSON`);
                  newErr.stack += '\nCaused by: '+err.stack;
                  logger.log('error',`Invalid input (${inputIterableValues}), incorrect JSON`+'\nCaused by: '+err.stack);
                  throw newErr;
                }
              }

              if(inputIterableLength){
                var execMode = chain.iterable;

                if (execMode === 'parallel'){

                  //console.log('EMPIEZA EJECUCION EN PARALELO! ',chain.id,inputIterable);

                  process.childs_chains = [];

                  function createChainSerie(inputIterable) {
                    var sequence = Promise.resolve();
                    inputIterable.forEach(function(item) {
                      sequence = sequence.then(function() {
                        return _this.loadChain(chain, process.uId, customValues)
                          .then(function(res) {
                            process.childs_chains.push(res);
                          })
                          .catch(function(e){
                            logger.log('error', `scheduleChain loadChain ${chain.id} parallel. Error: `+e)
                          });
                      });
                    });
                    return sequence;
                  }

                  createChainSerie(inputIterable)
                    .then(function() {
                      var chainsToExecLength = process.childs_chains.length;
                      while(chainsToExecLength--){
                        process.childs_chains.push(process.childs_chains[chainsToExecLength].start(inputIterable[chainsToExecLength]));
                      }

                      Promise.all(process.childs_chains)
                        .then(function (res) {
                          resolve();
                        })
                        .catch(function(e){
                          logger.log('error', 'scheduleChain createChainSerie createChainSerie parallel. Error: '+e);
                          resolve();
                        });

                    });
                }else{
                  //SERIE:

                  process.childs_chains = [];

                  function createChainSerie(inputIterable) {
                    var sequence = Promise.resolve();
                    inputIterable.forEach(function(item) {
                      sequence = sequence.then(function() {
                        return _this.loadChain(chain, process.uId, customValues)
                               .then(function(res) {
                                 process.childs_chains.push(res);
                               })
                               .catch(function(e){
                                 logger.log('error','scheduleChain createChainSerie Error '+e);
                               });
                      });
                    });
                    return sequence;
                  }

                  function execSerie(chains) {
                    var sequence = Promise.resolve();
                    var i = 0;
                    chains.forEach(function(chain) {
                      sequence = sequence.then(function() {
                        var waitEndChilds = true;
                        return chain.start(inputIterable[i], undefined, waitEndChilds)
                          .then(function(res) {
                            i = i+1;
                          })
                          .catch(function(e){
                            i = i+1;
                            logger.log('error','scheduleChain execSerie Error '+e);
                          });
                      });
                    });
                    return sequence;
                  }

                  createChainSerie(inputIterable)
                    .then(function() {
                      execSerie(process.childs_chains)
                        .then(function() {
                          resolve();
                        })
                        .catch(function(e){
                          logger.log('error','scheduleChain createChainSerie Error '+e);
                          resolve();
                      });
                    });
                }
              }else{
                logger.log('error','Error input not found for iterable process');
                resolve();
              }

            }else{
              if(customValues){
                _this.loadChain(chain, undefined, customValues)
                  .then(function (_chain) {
                    _chain.start(undefined, executeInmediate)
                      .then(function () {
                        _this.scheduleChains();
                        resolve();
                      })
                      .catch(function (err) {
                        logger.log('error', 'Error ', err);
                        resolve();
                      });
                  })
                  .catch(function (err) {
                    logger.log('error', `scheduleChain customsValues loadChain ${chain.id}. Error: `, err);
                  });
              }else{
                chain.start(undefined, executeInmediate)
                  .then(function () {
                    _this.scheduleChains();
                    resolve();
                  })
                  .catch(function (err) {
                    logger.log('error', 'Error ', err);
                    resolve();
                  });
              }
            }
          }
        }else{
          // Will execute in start_date set
          chain.schedule = schedule.scheduleJob(new Date(chain.start_date), function(chain){
            if(_this.hasDependenciesBlocking(chain)){
              chain.waiting_dependencies();
              logger.log('debug', `Ejecutar a FUTURO ${chain.id} -> on_waiting_dependencies`);
              resolve();
            }else{
              logger.log('debug', `Ejecutar a FUTURO ${chain.id} -> start`);
              chain.start()
                .then(function() {
                  _this.scheduleChains();
                  resolve();
                })
                .catch(function(e){
                  logger.log('error','scheduleChain chain.start Error '+e)
                  resolve();
                });
            }
          }.bind(null,chain));
        }

      }else{
        logger.log('error',`Invalid PlanFile, chain ${chain.id} don´t have start_date.`);
        throw new Error(`Invalid PlanFile, chain ${chain.id} don´t have start_date.`);
        resolve();
      }
    }else{
      logger.log('warn',`CHAIN ${chain.id} IGNORED: END_DATE ${chain.end_date} < CURRENT DATE: `,new Date(),'-  chain.status:'+chain.status,'- chain.schedule_interval:',chain.schedule_interval,'- chain.scheduleRepeater:',(chain.scheduleRepeater===undefined));
      resolve();
    }
    });
  };

  getChainById(chainId){
    var _this = this;

    function byId(chain){
      return chain.id === chainId;
    }
    return _this.chains.find(byId);
  }

  getIndexChainById(chainId){
    var _this = this;

    function byId(chain){
      return chain.id === chainId;
    }
    return _this.chains.findIndex(byId);
  }

  // Load a Chain. If exists replace and If not exists add the chain:
  loadChainToPlan(newChain){

    var _this = this;
    var chainId = newChain.id;
    var indexChain = _this.getIndexChainById(chainId);

    if(indexChain > -1){
      _this.chains[indexChain] = newChain;
    }else{
      _this.chains.push(newChain);
    }
    // Schedule load/reload chain
    _this.scheduleChain(_this.getChainById(chainId))
      .then(function(res) {
      })
      .catch(function(e){
        logger.log('error','loadChainToPlan scheduleChain'+e);
      });
  }

  dependenciesBlocking(chain){
    var chainsDependencies = [];

    if(chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0){
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //File dependences:
      while(dependsChainsLength--) {
        if (typeof depends_chains[dependsChainsLength]) {
          if(depends_chains[dependsChainsLength].hasOwnProperty('file_name')){
            if(chain.depends_files_ready){

              if(chain.depends_files_ready.indexOf(depends_chains[dependsChainsLength].file_name) > -1){
              }else{
                chainsDependencies.push(depends_chains[dependsChainsLength]);
              }
            }else{
              chainsDependencies.push(depends_chains);
            }
          }
        }
      }

      //Chains dependences:
      dependsChainsLength = depends_chains.length;

      while(planChainsLength--){
        var auxDependsChainsLength = dependsChainsLength;

        while(auxDependsChainsLength--){
          switch (typeof depends_chains[auxDependsChainsLength]) {
            case 'string':
              if(depends_chains[auxDependsChainsLength] === planChains[planChainsLength].id){
                if(!planChains[planChainsLength].isEnded()){
                  chainsDependencies.push(planChains[planChainsLength]);
                }
              }
              break;
            case 'object':
              if(depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id){

                if(planChains[planChainsLength].isEnded() || (depends_chains[auxDependsChainsLength].ignore_fail && planChains[planChainsLength].isErrored() && !depends_chains[auxDependsChainsLength].hasOwnProperty('process_id'))){
                }else{
                  if(depends_chains[auxDependsChainsLength].hasOwnProperty('process_id')){
                    var planProccessLength = planChains[planChainsLength].processes.length;

                    //EN LA VALIDACION DE DEPENDENCIES_CHAIN comprobar que tanto el chain ID como el proccess_id existen
                    while(planProccessLength--){
                      if(planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id){
                        if(planChains[planChainsLength].processes[planProccessLength].isEnded()){
                        }else{
                          //console.log('NO SE EJECUTA PORQUE EL PROCESO ',planChains[planChainsLength].processes[planProccessLength].id,' ESTA A ',planChains[planChainsLength].processes[planProccessLength].status);
                          chainsDependencies.push(planChains[planChainsLength]);
                        }
                      }
                    }
                  }else{
                    chainsDependencies.push(planChains[planChainsLength]);
                    //hasDependencies = true;
                  }
                }
              }
              break;
          }
        }
      }
      return chainsDependencies;
    }else{
      return chainsDependencies;
    }
  }

  hasDependenciesBlocking(chain){
    return (this.dependenciesBlocking(chain).length > 0);
  }

  getValuesInputIterable(chain){
    var input = [];

    if(chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0){
      var depends_chains = chain.depends_chains;
      var planChains = this.chains;

      var planChainsLength = this.chains.length;
      var dependsChainsLength = depends_chains.length;

      //Chains dependences:
      while(planChainsLength--){
        var auxDependsChainsLength = dependsChainsLength;
        while(auxDependsChainsLength--){
          if(typeof depends_chains[auxDependsChainsLength] === 'object'){
            if(depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id){
              if (depends_chains[auxDependsChainsLength].hasOwnProperty('process_id')){
                var planProccessLength = planChains[planChainsLength].processes.length;
                while(planProccessLength--){
                  if(planChains[planChainsLength].processes[planProccessLength].id === depends_chains[auxDependsChainsLength].process_id){
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
    }else{
      return input;
    }
  }
};

module.exports = Plan;
