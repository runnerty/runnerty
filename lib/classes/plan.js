'use strict';

const logger = require('../utils.js').logger;
const pick = require('../utils.js').pick;
const globToRegExp = require('glob-to-regexp');
const crypto = require('crypto');
const Chain = require('./chain.js');

class Plan {
  constructor(version, chains) {
    this.version = version;
    this.chains = chains;
  }

  async init() {
    try {
      const chains = await this.loadChains(this.chains);
      this.chains = chains;
      return this;
    } catch (err) {
      logger.log('error', `init Plan:`, err);
      throw err;
    }
  }

  async loadChains(chainsScaffold) {
    if (chainsScaffold instanceof Array) {
      try {
        if (chainsScaffold.length === 0) {
          logger.log('error', 'Plan have not Chains');
          throw new Error('Plan have not Chains');
        }

        const chains = [];
        for (const chainScaffold of chainsScaffold) {
          if (chainScaffold.disable) {
            logger.log('warn', `Chain ${chainScaffold.id} ignored: is setted to disable.`);
          } else {
            const isMainChain = true;
            const chain = new Chain(chainScaffold, isMainChain);
            await chain.init();
            chains.push(chain);
          }
        }
        return chains;
      } catch (err) {
        throw err;
      }
    } else {
      logger.log('error', 'Chain, processes is not array');
      throw new Error('Chain, processes is not array');
    }
  }

  loadChain(chain, isMainChain) {
    const newChain = new Chain(chain, isMainChain);
    return newChain.init();
  }

  scheduleChains() {
    this.chains.forEach(async chain => {
      // IGNORE ITERABLE CHAINS. SCHEDULED IN PROCESS.END EVENT
      if (!chain.iterable) {
        try {
          await this.scheduleChain(chain);
        } catch (err) {
          logger.log('error', 'scheduleChains scheduleChain', err);
        }
      }
    });
  }

  createChainSerie(inputIterable, chain, process, custom_values_overwrite) {
    let sequence = Promise.resolve();
    inputIterable.forEach(() => {
      sequence = sequence.then(async () => {
        chain.parentUId = process.parentUId;
        chain.parentProcessUId = process.uId;
        chain.parentExecutionId = process.parentExecutionId;
        chain.custom_values_overwrite = custom_values_overwrite;
        try {
          const _chain = new Chain(chain);
          await _chain.init();
          process.childs_chains.push(_chain);
        } catch (err) {
          logger.log('error', `scheduleChain createChainSerie loadChain ${chain.id}. Error: ${err}`);
        }
      });
    });
    return sequence;
  }

  async execSerie(chains, inputIterable, chain) {
    let sequence = Promise.resolve();
    let i = 0;
    let abortIteration = false;

    for await (const _chain of chains) {
      sequence = await sequence;
      if (!abortIteration) {
        const options = {
          inputIteration: inputIterable[i],
          waitEndChilds: true
        };
        try {
          await _chain.start(options);
          if (_chain.causedByAnProcessError && chain.abort_iteration_serie_on_error) {
            abortIteration = true;
          }
          i = i + 1;
        } catch (err) {
          i = i + 1;
          logger.log('error', 'scheduleChain execSerie Error ', err);
        }
      } else {
        return Promise.resolve();
      }
    }

    return sequence;
  }

  async scheduleChainIterableParallel(inputIterable, chain, process, custom_values_overwrite) {
    try {
      process.childs_chains = [];
      await this.createChainSerie(inputIterable, chain, process, custom_values_overwrite);
      let chainsToExecLength = process.childs_chains.length;
      while (chainsToExecLength--) {
        const options = {
          inputIteration: inputIterable[chainsToExecLength]
        };
        process.childs_chains.push(process.childs_chains[chainsToExecLength].start(options));
      }
      Promise.all(process.childs_chains);
    } catch (err) {
      throw err;
    }
  }

  async scheduleChainIterableSerie(inputIterable, chain, process, custom_values_overwrite) {
    try {
      process.childs_chains = [];
      if (process.fail_on_child_fail && !chain.abort_iteration_serie_on_error) {
        if (chain.abort_iteration_serie_on_error == false) {
          logger.log(
            'warn',
            `Chain ${chain.id} abort_iteration_serie_on_error is setted to true because parent process ${process.id} fail_on_child_fail is true.`
          );
        }
        chain.abort_iteration_serie_on_error = true;
      }
      await this.createChainSerie(inputIterable, chain, process, custom_values_overwrite);
      await this.execSerie(process.childs_chains, inputIterable, chain);
    } catch (err) {
      throw err;
    }
  }

  async scheduleChainDependent(executeInmediate, chain, process, custom_values_overwrite) {
    try {
      let _chain = chain;
      chain.custom_values_overwrite = custom_values_overwrite;
      chain.custom_values = Object.assign({}, chain.custom_values, custom_values_overwrite) || {};

      // CHAINS DEPENDENT OF CHAIN + PROCESS:
      if ((process !== undefined) & (process !== null)) {
        chain.parentUId = process.parentUId;
        chain.parentProcessUId = process.uId;
        chain.parentExecutionId = process.parentExecutionId;
        _chain = new Chain(chain);
        await _chain.init();
        if (process.childs_chains) {
          process.childs_chains.push(_chain);
        } else {
          process.childs_chains = [_chain];
        }
      }

      const options = { executeInmediate };
      await _chain.start(options);
    } catch (err) {
      throw err;
    }
  }

  async scheduleChain(chain, process, executeInmediate, input_values, custom_values_overwrite) {
    logger.log('debug', `SCHEDULED CHAIN ${chain.id}`);
    try {
      if (executeInmediate) {
        chain.stop();
      }

      // ITERABLE CHAINS:
      if (chain.hasOwnProperty('iterable') && chain.iterable && chain.iterable !== '') {
        if (!input_values && !process.isDummy) {
          const procValues = process.values();
          const outputIterable = procValues[process.output_iterable];

          if (!outputIterable) {
            input_values = this.getValuesInputIterable(chain);
          } else {
            input_values = outputIterable;
          }
        }

        let inputIterable = [];
        if (input_values && input_values.length && input_values instanceof String) {
          try {
            inputIterable = JSON.parse(input_values);
          } catch (err) {
            throw new Error(`Invalid input (${input_values}), incorrect JSON` + '\nCaused by: ' + err.stack);
          }
        } else {
          if (input_values instanceof Array) {
            inputIterable = input_values;
          }
        }

        if (inputIterable.length) {
          const execMode = chain.iterable;
          if (execMode === 'parallel') {
            // ITER.PARALLEL
            await this.scheduleChainIterableParallel(inputIterable, chain, process, custom_values_overwrite);
          } else {
            // ITER. SERIE:
            await this.scheduleChainIterableSerie(inputIterable, chain, process, custom_values_overwrite);
          }
        } else {
          if (!process.isDummy) {
            process.stopChildChains();
            process.endChildChains();
          }
          logger.log('debug', `input not found for iterable process ${process.id}`);
        }
      } else {
        // NO ITERABLE CHAINS + DEPENDENTS:
        await this.scheduleChainDependent(executeInmediate, chain, process, custom_values_overwrite);
      }
    } catch (err) {
      throw err;
    }
  }

  getValuesInputIterable(chain) {
    let input = [];

    if (chain.hasOwnProperty('depends_chains') && chain.depends_chains.length > 0) {
      const depends_chains = chain.depends_chains;
      const planChains = this.chains;

      let planChainsLength = this.chains.length;
      const dependsChainsLength = depends_chains.length;

      //Chains dependences:
      while (planChainsLength--) {
        let auxDependsChainsLength = dependsChainsLength;
        while (auxDependsChainsLength--) {
          if (typeof depends_chains[auxDependsChainsLength] === 'object') {
            if (depends_chains[auxDependsChainsLength].chain_id === planChains[planChainsLength].id) {
              if (depends_chains[auxDependsChainsLength].hasOwnProperty('process_id')) {
                let planProcessLength = planChains[planChainsLength].processes.length;
                while (planProcessLength--) {
                  if (
                    planChains[planChainsLength].processes[planProcessLength].id ===
                    depends_chains[auxDependsChainsLength].process_id
                  ) {
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
    const res = [];

    for (const chain of this.chains) {
      if (_pick) {
        res.push(pick(chain, _pick));
      } else {
        res.push(chain);
      }
    }

    return res;
  }

  getChainById(chainId, uniqueId, _pick) {
    function byId(chain) {
      return chain.id === chainId && (chain.uId === uniqueId || chain.execId === uniqueId);
    }

    if (_pick) {
      return pick(this.chains.find(byId), _pick);
    } else {
      return this.chains.find(byId);
    }
  }

  getIndexChainById(chainId, uniqueId, _pick) {
    function byId(chain) {
      return chain.id === chainId && (chain.uId === uniqueId || chain.execId === uniqueId);
    }

    if (_pick) {
      return pick(this.chains.findIndex(byId), _pick);
    } else {
      return this.chains.findIndex(byId);
    }
  }

  getChainsByName(name, _pick) {
    const res = [];

    for (const chain of this.chains) {
      if (globToRegExp(name).test(chain.name)) {
        if (_pick) {
          res.push(pick(chain, _pick));
        } else {
          res.push(chain);
        }
      }
    }
    return res;
  }

  getChainsByStatus(status, _pick) {
    const res = [];

    for (const chain of this.chains) {
      if (status === chain.status) {
        if (_pick) {
          res.push(pick(chain, _pick));
        } else {
          res.push(chain);
        }
      }
    }

    return res;
  }

  async generateRandomString() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buffer) => {
        if (err) reject(`Error creating dummy process. crypto: ${err}`);
        resolve(buffer);
      });
    });
  }

  async startChain(chainId, uId, input_values, custom_values_overwrite, noWait) {
    const chain = this.getChainById(chainId, uId);
    if (chain) {
      if (chain.iterable) {
        try {
          const randomStr = await this.generateRandomString();
          let res_msg = '';
          if (!input_values) res_msg = 'WARNING: empty input values.';
          // CREATE DUMMY PROCESS NEEDED FOR ITERABLE CHAIN:
          const dummy_process = {};
          dummy_process.uId = chainId + '_VP_' + randomStr.toString('hex');
          dummy_process.childs_chains = [];
          dummy_process.isDummy = true;

          if (noWait) {
            this.scheduleChain(chain, dummy_process, true, input_values, custom_values_overwrite);
          } else {
            await this.scheduleChain(chain, dummy_process, true, input_values, custom_values_overwrite);
          }
          return res_msg;
        } catch (err) {
          throw err;
        }
      } else {
        if (noWait) {
          this.scheduleChain(chain, null, true, null, custom_values_overwrite);
        } else {
          await this.scheduleChain(chain, null, true, null, custom_values_overwrite);
        }
      }
    } else {
      throw new Error(`Chain not found: ID ${chainId}`);
    }
  }

  stopChain(chainId, uniqueId) {
    const chain = this.getChainById(chainId, uniqueId);
    if (chain) {
      chain.stop();
    } else {
      throw new Error(`Chain not found: ID ${chainId} - UniqueId: ${uniqueId}`);
    }
  }

  // Load a Chain. If exists replace and If not exists add the chain:
  async loadChainToPlan(newChain) {
    const chainId = newChain.id;
    const chainuId = newChain.uId;
    const indexChain = this.getIndexChainById(chainId, chainuId);

    if (indexChain > -1) {
      this.chains[indexChain] = newChain;
    } else {
      this.chains.push(newChain);
    }
    // Schedule load/reload chain
    try {
      await this.scheduleChain(this.getChainById(chainId, chainuId));
    } catch (err) {
      logger.log('error', 'loadChainToPlan scheduleChain', err);
      throw err;
    }
  }
}
module.exports = Plan;
