"use strict";

var logger            = require("../libs/utils.js").logger;
var replaceWith       = require("../libs/utils.js").replaceWith;

module.exports.exec = function executeWait(process){
  var secondsToWait = replaceWith(process.exec.wait, process.values());

  return new Promise(function(resolve) {
    setTimeout(function(){
      process.end();
      process.write_output();
      resolve();
    }, secondsToWait * 1000 || 0);
  });
};