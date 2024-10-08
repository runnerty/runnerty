'use strict';

const recursiveObjectInterpreter = require('./utils.js').recursiveObjectInterpreter;
const standardizeDependsProcesses = require('./utils.js').standardizeDependsProcesses;

const statusConditions = ['$end', '$fail', '$finalized', '$ignored', '$running', '$stopped'];

module.exports.statusConditions = statusConditions;

const statusConditionToProcessStatus = {
  $end: 'end',
  $fail: 'error',
  $finalized: ['end', 'error', 'ignored'],
  $ignored: 'ignored',
  $running: 'running',
  $stopped: 'stop'
};

const statusForWait = ['stop', 'running'];

/**
 * Check if key is equal to value.
 * @param key
 * @param value
 * @returns {boolean}
 * @private
 */
function _eq(key, value) {
  return key == value;
}

/**
 * Check if key is match to reg exp value.
 * @param key
 * @param value
 * @returns {boolean}
 * @private
 */
async function _match(key, value, values) {
  let res = false;
  key = await recursiveObjectInterpreter(key, values);
  value = await recursiveObjectInterpreter(value, values);

  function regExpFromString(q) {
    let flags = q.replace(/.*\/([gimuy]*)$/, '$1');
    if (flags === q) flags = '';
    const pattern = flags ? q.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1') : q;
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      return null;
    }
  }

  if (typeof key === 'string' && key.match(regExpFromString(value))) {
    res = true;
  }
  return res;
}

/**
 * Determines the next action to take based on the condition and the status of the previous process.

 * @param {string} condic - The condition string, with a leading '$' indicating the expected status.
 * @param {string} statusPrevProc - The status of the previous process (e.g., 'running', 'end').
 * @returns {string} - The determined action: 'run', 'wait', or 'ignore'.
 * @private
 */
function _setAction(condic, statusPrevProc) {
  let resAction = 'ignore';
  const expectedStatus = statusConditionToProcessStatus[condic];
  if (
    expectedStatus &&
    ((typeof expectedStatus === 'string' && expectedStatus === statusPrevProc) ||
      (Array.isArray(expectedStatus) && expectedStatus.includes(statusPrevProc)))
  ) {
    resAction = 'run';
  } else if (statusForWait.includes(statusPrevProc)) {
    resAction = 'wait';
  }
  return resAction;
}

/**
 * Check condition and return action.
 *
 * @param objToCheck
 * @returns {string}
 * @private
 */
async function _checkCondition(objToCheck, values) {
  let result = 'run';
  if (objToCheck instanceof Object) {
    let key = Object.keys(objToCheck)[0];
    let keyVal = objToCheck[key];
    if (keyVal instanceof Object) {
      let condition = Object.keys(keyVal)[0];
      let value = keyVal[condition];
      // RegExp:
      if (!condition) {
        condition = '$eq';
        value = keyVal;
      }

      key = await recursiveObjectInterpreter(key, values);
      value = await recursiveObjectInterpreter(value, values);

      // Trimming:
      key = key.trim();
      if (typeof value === 'string') {
        value = value.trim();
      }

      let resComp = false;

      // if the comparison is of numbers, we parse to integers:
      if (key && value && !isNaN(key) && !isNaN(value)) {
        key = parseInt(key);
        value = parseInt(value);
      }

      switch (condition) {
        case '$eq':
          resComp = _eq(key, value);
          break;
        case '$match':
          resComp = await _match(key, value, values);
          break;
        case '$lt':
          resComp = key < value;
          break;
        case '$lte':
          resComp = key <= value;
          break;
        case '$gt':
          resComp = key > value;
          break;
        case '$gte':
          resComp = key >= value;
          break;
        case '$ne':
          resComp = key != value;
          break;
        case '$in':
          for (let i = 0; i < value.length; i++) {
            if (value[i] == key) {
              resComp = true;
              break;
            }
          }
          break;
        case '$nin':
          resComp = true;
          for (let i = 0; i < value.length; i++) {
            if (value[i] == key) {
              resComp = false;
              break;
            }
          }
          break;
        default:
          resComp = false;
          break;
      }
      if (!resComp) {
        result = 'wait';
      }
      return result;
    } else {
      key = await recursiveObjectInterpreter(key, values);
      keyVal = await recursiveObjectInterpreter(keyVal, values);
      // String
      if (statusConditions.includes(key)) {
        result = _setAction(key, keyVal);
      } else {
        if (key === '$true' || key === '$false') {
          if (
            (key === '$true' && (keyVal === 'true' || keyVal === '1')) ||
            (key === '$false' && (keyVal === 'false' || keyVal === '0'))
          ) {
            result = 'run';
          } else {
            result = 'ignore';
          }
        } else {
          if (!_eq(key, keyVal)) {
            result = 'wait';
          }
        }
      }
      return result;
    }
  } else {
    result = 'ignore';
    return result;
  }
}

/**
 * Return action that process have to do when operator of conditions is OR from current and new action:
 * @param currentAction
 * @param newAction
 * @returns {string}
 * @private
 */
function _setResOperOR(currentAction, newAction) {
  if (currentAction === 'run' || newAction === 'run') return 'run';
  if (currentAction === 'wait' || newAction === 'wait') return 'wait';
  return newAction || currentAction;
}

/**
 * Return action that process have to do when operator is AND from current a new actions.
 * @param currentAction
 * @param newAction
 * @returns {string}
 * @private
 */
function _setResOperAND(currentAction, newAction) {
  if (currentAction === 'ignore' || newAction === 'ignore') return 'ignore';
  if (currentAction === 'run' && newAction === 'run') return 'run';
  return 'wait';
}

/**
 * Check operator (AND or OR) and return action
 * @param objOperator
 * @returns {string}
 * @private
 */
async function _checkOperator(objOperator, chain_process, values) {
  let result = 'ignore';
  if (objOperator instanceof Object) {
    const operator = Object.keys(objOperator)[0];
    if (operator === '$and') result = 'run';
    const operatorConditions = objOperator[operator];
    if (operatorConditions instanceof Array) {
      for (let i = 0; i < operatorConditions.length; i++) {
        const res = await checkDependsProcess(operatorConditions[i], chain_process, values);
        switch (operator) {
          case '$or':
            result = _setResOperOR(result, res);
            break;
          case '$and':
            result = _setResOperAND(result, res);
            break;
          default:
            break;
        }
      }
    }
  }

  return result;
}

/**
 * Return the status of a process from its process ID.
 * @param {string} processId - The ID of the process to find.
 * @param {Array} chain_process - The array of process objects.
 * @returns {string|undefined} - The status of the process, or undefined if not found.
 * @private
 */
function _returnProcessStatus(processId, chain_process) {
  const process = chain_process.find(proc => proc.id === processId);
  return process ? process.status : undefined;
}

/**
 * Replace process IDs from depends_process_obj with their status.
 * @param {Array|Object} dependencies - The dependencies to process.
 * @param {Object} chain_process - The process chain object.
 * @returns {Array|Object} - The modified dependencies with statuses.
 * @private
 */
function _replaceStatusProcess(dependencies, chain_process) {
  if (Array.isArray(dependencies)) {
    const res = [];
    // Recursively replace status in array dependencies
    for (let i = 0; i < dependencies.length; i++) {
      res[i] = _replaceStatusProcess(dependencies[i], chain_process);
    }

    return res;
  }

  if (typeof dependencies === 'object' && dependencies !== null) {
    const res = {};
    for (const key in dependencies) {
      if (statusConditions.includes(key)) {
        // Replace the process ID with its status or keep the original if no status is found
        res[key] = _returnProcessStatus(dependencies[key], chain_process) ?? dependencies[key];
      } else {
        // Recursively process nested objects
        res[key] = _replaceStatusProcess(dependencies[key], chain_process);
      }
    }

    return res;
  }

  // If not an array or object, return the value as is
  return dependencies;
}

function _isAllDepProcessFinish(dependencies) {
  if (Array.isArray(dependencies)) {
    return dependencies.every(dependency => _isAllDepProcessFinish(dependency));
  }

  if (typeof dependencies === 'object' && dependencies !== null) {
    for (const key in dependencies) {
      if (statusConditions.includes(key)) {
        // If any dependency is 'stop' or 'running', return false
        if (statusForWait.includes(dependencies[key])) {
          return false;
        }

        return true;
      } else {
        return _isAllDepProcessFinish(dependencies[key]);
      }
    }
  }

  return true;
}

/**
 * Function:
 *  1.- Replace process ids from depends_process_obj by their status.
 *  2.- Return Action from depends_process object from process in plan.
 * @param depends_process_obj
 * @returns {string}
 */
async function checkDependsProcess(depends_process_obj, chain_process, values) {
  if (depends_process_obj instanceof Object) {
    const item = Object.keys(depends_process_obj)[0];
    let res;
    if (depends_process_obj[item] instanceof Array) {
      res = await _checkOperator(depends_process_obj, chain_process, values);
    } else {
      res = await _checkCondition(depends_process_obj, values);
    }
    return res;
  } else {
    throw new Error('Check depends_process, is not valid object.');
  }
}

/**
 * Return process action of depends_process.
 * @param depends_process_obj
 * @param chain_process
 * @returns {Promise}
 */

async function getAction(process, chain_process, values) {
  try {
    const standDepsProc = standardizeDependsProcesses(process.depends_process);
    const depends_process_obj_psr = _replaceStatusProcess(standDepsProc, chain_process);
    const noWait = _isAllDepProcessFinish(depends_process_obj_psr);
    let res = await checkDependsProcess(depends_process_obj_psr, chain_process, values);
    if (noWait && res === 'wait') res = 'ignore';
    return res;
  } catch (err) {
    throw err;
  }
}

module.exports.getAction = getAction;
