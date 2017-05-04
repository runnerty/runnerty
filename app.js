#!/usr/bin/env node
"use strict";

var program = require("commander");
var init = require("./libs/init.js").init;
var utils = require("./libs/utils.js");
var logger = utils.logger;
var encrypt = utils.encrypt;
var path = require("path");
var mongooseCloseConnection = utils.mongooseCloseConnection;


var configFilePath = path.join(process.cwd(), "conf.json");
var restorePlan = false;

process.title = require("./package.json").name;

// CHECK ARGS APP:
program
  .version("Runnerty " + require("./package.json").version)
  .option("-c, --config <path>", `set config path. defaults to ${configFilePath}`, function (filePath) {
    configFilePath = filePath;
  })
  .option("-r, --restore", "restore backup plan (experimental)", function () {
    restorePlan = true;
  })
  .option("-p, --password <password>", "Master cryptor password")
  .option("-e, --encrypt <password_to_encrypt>", "Util: Encrypt password (to use crypted_password in config instead of literal password)");

program.parse(process.argv);
if(program.password){
  global.cryptoPassword = program.password;
}

if(program.encrypt){
  if(!program.password){
    console.log("warn", `Please set --password and --encrypt for encrypt yor password.`);
  }else{
    console.log("Your cryped password is: ",encrypt(program.encrypt, program.password));
  }
  process.exit();
}

// INIT:
init(configFilePath, restorePlan);

//==================================================================
//
process.on("uncaughtException", function (err) {
  logger.log("error", err.stack);
});

process.on("exit", function (err) {
  logger.log("warn", "--> [R]unnerty stopped.", err);
});

process.on("SIGINT", function() {
  mongooseCloseConnection();
});