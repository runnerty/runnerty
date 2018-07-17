"use strict";

const program = require("commander");
const init = require("./init.js").init;
const utils = require("./utils.js");
const logger = require("./logger.js");
const encrypt = utils.encrypt;
const path = require("path");
const mongooseCloseConnection = utils.mongooseCloseConnection;

let configFilePath = path.join(process.cwd(), "config.json");
let restorePlan = false;

process.title = require("../package.json").name;

// ASYNC INIT:
(async function() {
  // CHECK ARGS APP:
  await program
    .version("Runnerty " + require("../package.json").version, "-v, --version")
    .option("-c, --config <path>", `set config path. defaults to ${configFilePath}`, (filePath) => {
      configFilePath = filePath;
    })
    .option("-P, --plan <plan_path>", "Overwrite path file plan of config file.")
    .option("-r, --restore", "restore backup plan (experimental)", () => {
      restorePlan = true;
    })
    .option("-p, --password <password>", "Master cryptor password")
    .option("-e, --encrypt <password_to_encrypt>", "Util: Encrypt password (to use crypted_password in config instead of literal password)")
    .option("-m, --memorylimit <memory_limit_Mb>", "Set default memory space limit for Runnerty (--max-old-space-size). It is necessary to restart Runnerty.")
    .option("-f, --force_chain_exec <chainId>", "Force chain execution (For development tests).")
    .option("--input_values <inputValues>", "Input values for force chain execution (-f) (For development tests).")
    .option("--custom_values <customValues>", "Custom values for force chain execution (-f) (For development tests).")
    .option("--config_user <config_user>", "User for remote (url) config file (Basic Auth User)")
    .option("--config_password <config_password>", "Password for remote (url) config file (Basic Auth Password)");

  await program.parse(process.argv);
  if(program.password){
    global.cryptoPassword = program.password;
  }

  /* eslint-disable no-console */

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

  // INIT:
  init(configFilePath, restorePlan, program.plan, program.config_user, program.config_password)
    .then(() =>{

      if(program.encrypt){
        if(!program.password){
          console.log("warn", "Please set --password and --encrypt for encrypt yor password.");
        }else{
          console.log("Your cryped password is: ",encrypt(program.encrypt, program.password));
        }
        process.exit();
      }

      utils.forceInitChainExecution(program);
    })
    .catch((err) => {
      console.error(err);
      process.exit();
    });

  /* eslint-enable no-console */

  process.on("exit", (err) => {
    logger.log("warn", "--> [R]unnerty stopped.", err);
  });

}());

//==================================================================
//
process.on("uncaughtException", (err) => {
  logger.log("error", err.stack);
});

process.on("unhandledRejection", (reason, p) => {
  logger.log("error",p,reason);
  process.exit();
});

process.on("SIGINT", () => {
  mongooseCloseConnection();
});