"use strict";
const replaceWithSmart = require("./utils.js").replaceWithSmart;

/**
 * Check if key is equal to value.
 * @param key
 * @param value
 * @returns {boolean}
 * @private
 */
function _eq(key, value){
  return (key == value);
}

/**
 * Check if key is match to reg exp value.
 * @param key
 * @param value
 * @returns {boolean}
 * @private
 */
async function _match(key, value){
  let res = false;
  key = await replaceWithSmart(key);
  value = await replaceWithSmart(value);

  function regExpFromString(q) {
    let flags = q.replace(/.*\/([gimuy]*)$/, "$1");
    if (flags === q) flags = "";
    let pattern = (flags ? q.replace(new RegExp("^/(.*?)/" + flags + "$"), "$1") : q);
    try { return new RegExp(pattern, flags); } catch (e) { return null; }
  }

  if (typeof key === "string" && key.match(regExpFromString(value))){
    res = true;
  }
  return res;
}

/**
 * Return action that process have to do from status of previous process.
 * @param condic
 * @param statusPrevProc
 * @returns {string}
 * @private
 */
function _setAction(condic, statusPrevProc){
  let resAction = "ignore";
  switch (condic){
    case "$end":
      switch (statusPrevProc){
        case "end":
          resAction = "run";
          break;
        case "running":
          resAction = "wait";
          break;
        case "stop":
          resAction = "wait";
          break;
        case "error":
          resAction = "ignore";
          break;
        case "ignored":
          resAction = "ignore";
          break;
        default:
          resAction = "ignore";
          break;
      }
      break;
    case "$fail":
      switch (statusPrevProc){
        case "end":
          resAction = "ignore";
          break;
        case "running":
          resAction = "wait";
          break;
        case "stop":
          resAction = "wait";
          break;
        case "error":
          resAction = "run";
          break;
        case "ignored":
          resAction = "ignore";
          break;
        default:
          resAction = "ignore";
          break;
      }
      break;
    default:
      resAction = "ignore";
      break;
  }
  return resAction;
}

/**
 * Check condition and return action.
 * @param objToCheck
 * @returns {string}
 * @private
 */
async function _checkCondition(objToCheck){
  let result = "run";
  if (objToCheck instanceof Object){

    let key = Object.keys(objToCheck)[0];
    let keyVal = objToCheck[key];
    if (keyVal instanceof Object){
      let condition = Object.keys(keyVal)[0];
      let value = keyVal[condition];
      // RegExp:
      if (!condition){
        condition = "$eq";
        value = keyVal;
      }

      key = await replaceWithSmart(key);
      value = await replaceWithSmart(value);

      let resComp = false;
      switch (condition){
        case "$eq":
          resComp = _eq(key, value);
          break;
        case "$match":
          resComp = await _match(key, value);
          break;
        case "$lt":
          resComp = (key < value);
          break;
        case "$lte":
          resComp = (key <= value);
          break;
        case "$gt":
          resComp = (key > value);
          break;
        case "$gte":
          resComp = (key >= value);
          break;
        case "$ne":
          resComp = (key != value);
          break;
        case "$in":
          for (let i = 0; i < value.length; i++){
            if (value[i] == key){
              resComp = true;
              break;
            }
          }
          break;
        case "$nin":
          resComp = true;
          for (let i = 0; i < value.length; i++){
            if (value[i] == key){
              resComp = false;
              break;
            }
          }
          break;
        default:
          resComp = false;
          break;
      }
      if (!resComp){
        result = "wait";
      }
      return result;

    }else{
      key = await replaceWithSmart(key);
      keyVal = await replaceWithSmart(keyVal);
      // String
      if (key === "$end" || key === "$fail") {
        result = _setAction(key, keyVal);
      }else{
        if (!_eq(key, keyVal)){
          result = "wait";
        }
      }
      return result;
    }
  }else{
    result = "ignore";
    return result;
  }
}

/**
 * Return action that process have to do when operator of conditions is OR from current and new action:
 *   CURRENT  NEW     RETURN
 *   ignore   wait    wait
 *   ignore   run     run
 *   ignore   ignore  ignore
 *   wait     ignore  wait
 *   wait     run     run
 *   wait     wait    wait
 *   run      ignore  run
 *   run      wait    run
 *   run      run     run
 * @param currentAction
 * @param newAction
 * @returns {string}
 * @private
 */
function _setResOperOR(currentAction, newAction){
  let resAction = "ignore";
  switch (currentAction){
    case "run":
      resAction = "run";
      break;
    case "wait":
      switch (newAction){
        case "run":
          resAction = "run";
          break;
        default:
          resAction = "wait";
          break;
      }
      break;
    case "ignore":
      switch (newAction){
        case "run":
          resAction = "run";
          break;
        case "wait":
          resAction = "wait";
          break;
        default:
          resAction = "ignore";
          break;
      }
      break;
    default:
      resAction = currentAction;
      break;
  }
  return resAction;
}

/**
 * Return action that process have to do when operator is AND from current a new actions.
 *   CURRENT  NEW     RETURN
 *   ignore   wait    ignore
 *   ignore   run     ignore
 *   ignore   ignore  ignore
 *   wait     ignore  ignore
 *   wait     run     wait
 *   wait     wait    wait
 *   run      ignore  ignore
 *   run      wait    wait
 *   run      run     run
 *   run      run     run
 * @param currentAction
 * @param newAction
 * @returns {string}
 * @private
 */
function _setResOperAND(currentAction, newAction){
  let retresAction = "ignore";
  switch (currentAction){
    case "ignore":
      retresAction = "ignore";
      break;
    case "wait":
      switch (newAction){
        case "ignore":
          retresAction = "ignore";
          break;
        default:
          retresAction = "wait";
          break;
      }
      break;
    case "run":
      switch (newAction){
        case "wait":
          retresAction = "wait";
          break;
        case "ignore":
          retresAction = "ignore";
          break;
        default:
          retresAction = "run";
          break;
      }
      break;
    default:
      retresAction = currentAction;
      break;
  }
  return retresAction;
}

/**
 * Check operator (AND or OR) and return action
 * @param objOperator
 * @returns {string}
 * @private
 */
async function _checkOperator(objOperator, chain_process){
  let result = "ignore";
  if (objOperator instanceof Object){
    let operator = Object.keys(objOperator)[0];
    if (operator === "$and") result = "run";
    let operatorConditions = objOperator[operator];
    if (operatorConditions instanceof Array){
      for (let i = 0; i < operatorConditions.length; i++){
        let res = await checkDependsProcess(operatorConditions[i], chain_process);
        switch (operator){
          case "$or":
            result = _setResOperOR(result, res);
            break;
          case "$and":
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
 * Return status of process from process id.
 * @param processId
 * @param chain_process
 * @returns {string}
 * @private
 */
function _returnProcessStatus(processId, chain_process){
  for (const proc of chain_process) {
    if (proc.id === processId && proc.status)
      return proc.status;
  }
}

/**
 * Replace process ids from depends_process_obj by their status.
 * @param dependencies
 * @param chain_process
 * @returns {Promise}
 * @private
 */
function _replaceStausProcess(dependencies, chain_process) {
  return new Promise(async (resolve) => {
    if (dependencies instanceof Array) {
      let promArr = [];
      for (let i = 0; i < dependencies.length; i++) {
        promArr.push(await _replaceStausProcess(dependencies[i], chain_process));
      }
      Promise.all(promArr).then(values => {
        resolve(values);
      });
    } else {
      if (dependencies instanceof Object) {

        let keys = Object.keys(dependencies);
        let resObject = {};
        for (const key of keys) {
          switch (key){
            case "$end":
            case "$fail":
              resObject[key] = _returnProcessStatus(dependencies[key], chain_process) || dependencies[key];
              break;
            default:
              resObject[key] = await _replaceStausProcess(dependencies[key], chain_process);
              break;
          }
        }
        resolve(resObject);
      } else {
        resolve(dependencies);
      }
    }
  });
}

function _isAllDepProcessFinish(dependencies) {
  function _isEndFailFinishStatus(obj){
    let keys = Object.keys(obj);
    let keysLength = Object.keys(obj).length;
    let res = true;

    while(keysLength-- && res){
      let key = keys[keysLength];
      if (key === "$end" || key === "$fail"){
        if (obj[key] === "end" || obj[key] === "error" || obj[key] === "ignored"){
          res = true;
        }else{
          res = false;
        }
      }else{
        if (obj[key] instanceof Array){
          res = _isAllDepProcessFinish(obj[key]);
        }
      }
    }

    return res;
  }

  return new Promise(async (resolve) => {
    if (dependencies instanceof Array) {
      let res = true;
      let dependenciesLength = dependencies.length;

      while(dependenciesLength-- && res){
        let key = dependencies[dependenciesLength];
        res = await _isAllDepProcessFinish(key);
      }
      resolve(res);
    }else{
      resolve(_isEndFailFinishStatus(dependencies));
    }

  });
}


/**
 * Function:
 *  1.- Replace process ids from depends_process_obj by their status.
 *  2.- Return Action from depends_process object from process in plan.
 * @param depends_process_obj
 * @returns {string}
 */
function checkDependsProcess(depends_process_obj, chain_process) {
  return new Promise(async (resolve, reject) => {
    if (depends_process_obj instanceof Object) {
      let item = Object.keys(depends_process_obj)[0];
      if (depends_process_obj[item] instanceof Array) {
        resolve(await _checkOperator(depends_process_obj, chain_process));
      } else {
        resolve(await _checkCondition(depends_process_obj));
      }
    } else {
      reject("Check depends_process, is not valid object.");
    }
  });
}

/**
 * Return process action of depends_process.
 * @param depends_process_obj
 * @param chain_process
 * @returns {Promise}
 */
function getAction(depends_process_obj, chain_process){
  return new Promise((resolve, reject) => {

    // COMPATIBILITY WHIT STRINGS (PROCESS_ID) AND ARRAYS OF STRING (ARRAY OF PROCESS IDS):
    // depends_process is an Array of strings, this will be replaced by: ["PROCESS1_ID","PROCESS2_ID"] -> {"$and":[{"end":"PROCESS1_ID"},{"end":"PROCESS2_ID"}]}
    if (depends_process_obj instanceof Array){
      let depends_process_obj_tmp = {"$and":[]};
      for (const strItem of depends_process_obj) {
        if (typeof strItem === "string" ){
          depends_process_obj_tmp["$and"].push({"$end":strItem});
        }else{
          reject("getAction depends_process, is not valid. Arrays depends_process must be array of strings.");
        }
      }
      depends_process_obj = depends_process_obj_tmp;
    }else{
      // depends_process is a string, this will be replaced by: "PROCESS_ID" -> {"end":"PROCESS_ID"}
      if (typeof depends_process_obj === "string"){
        depends_process_obj = {"$end":depends_process_obj};
      }else{
        if (!(depends_process_obj instanceof Object)){
          reject("getAction depends_process, is not valid object.");
        }
      }
    }

    // Replace all PROCESS_IDs (in "$end" or "$fail") BY process status:
    _replaceStausProcess(depends_process_obj, chain_process)
      .then(async (depends_process_obj_psr) => {
        let cantWait = await _isAllDepProcessFinish(depends_process_obj_psr);
        let res = await checkDependsProcess(depends_process_obj_psr, chain_process);
        if (cantWait && res === "wait") res = "ignore";
        resolve(res);
      })
      .catch(err => {
        reject(err);
      });
  });
}


module.exports.getAction = getAction;

