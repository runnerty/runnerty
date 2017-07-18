"use strict";

const program = require("commander");
const init = require("./init.js").init;
const utils = require("./utils.js");
const logger = utils.logger;
const encrypt = utils.encrypt;
const path = require("path");
const mongooseCloseConnection = utils.mongooseCloseConnection;

var configFilePath = path.join(process.cwd(), "config.json");
var restorePlan = false;

process.title = require("../package.json").name;

// ASYNC INIT:
(async function() {
  // CHECK ARGS APP:
  await program
    .version("Runnerty " + require("../package.json").version)
    .option("-c, --config <path>", `set config path. defaults to ${configFilePath}`, (filePath) => {
      configFilePath = filePath;
    })
    .option("-r, --restore", "restore backup plan (experimental)", () => {
      restorePlan = true;
    })
    .option("-p, --password <password>", "Master cryptor password")
    .option("-e, --encrypt <password_to_encrypt>", "Util: Encrypt password (to use crypted_password in config instead of literal password)")
    .option("-m, --memorylimit <memory_limit_Mb>", "Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.");

  await program.parse(process.argv);
  if(program.password){
    global.cryptoPassword = program.password;
  }

  /* eslint-disable no-console */
  if(program.encrypt){
    if(!program.password){
      console.log("warn", "Please set --password and --encrypt for encrypt yor password.");
    }else{
      console.log("Your cryped password is: ",encrypt(program.encrypt, program.password));
    }
    process.exit();
  }

  if(program.memorylimit){
    await utils.setMemoryLimit(program.memorylimit)
      .then((memorylimitSetted) => {
        console.log(`New memory limit ${memorylimitSetted} successfully setted.`);
        process.exit();
      })
      .catch((err) => {
        console.error(err);
        process.exit();
      });
  }
  /* eslint-enable no-console */

  // INIT:
  init(configFilePath, restorePlan);

  process.on("exit", (err) => {
    logger.log("warn", "--> [R]unnerty stopped.", err);
  });

}());

//==================================================================
//
process.on("uncaughtException", (err) => {
  logger.log("error", err.stack);
});

process.on("SIGINT", () => {
  mongooseCloseConnection();
});