'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const lodash = require('lodash');
const logger = require('../utils.js').logger;
const loadRemoteFile = require('../utils.js').loadRemoteFile;
const isUrl = require('../utils.js').isUrl;
const consoleAjvErrors = require('../utils.js').consoleAjvErrors;
const planSchema = require('../schemas/plan.json');
const chainSchema = require('../schemas/chain.json');
const processSchema = require('../schemas/process.json');
const Ajv = require('ajv').default;
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  allowUnionTypes: true
});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

const Plan = require('./plan.js');

function parseAndValidate(fileContent, schema) {
  let fileParsed;
  if (typeof fileContent === 'object') {
    fileParsed = fileContent;
  } else {
    try {
      fileParsed = JSON.parse(fileContent);
    } catch (err) {
      throw new Error(`Invalid plan file, incorrect JSON: ${err}`);
    }
  }

  let valid = false;
  try {
    valid = ajv.validate(schema, fileParsed);
    if (valid) {
      return fileParsed;
    } else {
      consoleAjvErrors(schema, fileParsed, ajv.errors);
      throw ajv.errors;
    }
  } catch (err) {
    throw err;
  }
}

ajv.addFormat(
  'cron',
  /^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))|(jan|feb|mar|apr|may|jun|jul|aug|sep|okt|nov|dec)) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))|(sun|mon|tue|wed|thu|fri|sat)))$/
);
ajv.addSchema(planSchema, 'planSchema');
ajv.addSchema(processSchema, 'processSchema');
ajv.addSchema(chainSchema, 'chainSchema');

class FilePlan {
  constructor(filePath, planContent, config_user, config_password) {
    this.filePath = filePath;
    this.fileContent = '';
    this.planeFileChains = '';
    this.lastHashPlan = '';
    this.planContent = planContent;
    this.config_user = config_user;
    this.config_password = config_password;
    this.plan = {};
  }

  async init(namespace, exclude_namespace) {
    try {
      if (this.planContent) {
        this.fileContent = parseAndValidate(this.planContent, 'planSchema');
        const chains = await this.loadChains(namespace, exclude_namespace);
        return chains;
      } else {
        this.fileContent = await this.loadFileContent(
          this.filePath,
          'planSchema',
          this.config_user,
          this.config_password
        );
        const chains = await this.loadChains(namespace, exclude_namespace);
        return chains;
      }
    } catch (err) {
      logger.log('debug', `init filePlan:`, err);
      throw err;
    }
  }

  async loadChains(namespace, exclude_namespace) {
    try {
      const chains = await this.getChains(this.fileContent, namespace, exclude_namespace);
      if ((namespace.length || exclude_namespace.length) && !chains.length) {
        let ecludedMsg = '';
        if (exclude_namespace.length) {
          ecludedMsg = (namespace.length ? ' / ' : '') + `Excluded: ${exclude_namespace}`;
        }

        throw new Error(`No chain found for the indicated namespace. ${namespace}${ecludedMsg}`);
      }
      this.planeFileChains = lodash.cloneDeep(chains);
      const plan = new Plan('', chains);
      this.plan = await plan.init();
      return this;
    } catch (err) {
      throw err;
    }
  }

  async loadFileContent(filePath, schema, config_user, config_password) {
    // Check if Plan file is an URL:
    try {
      if (isUrl(filePath)) {
        const contentRemoteFile = await loadRemoteFile(filePath, config_user, config_password);
        const parsedContent = parseAndValidate(contentRemoteFile, schema);
        return parsedContent;
      } else {
        const file = await this._locateChainFile(filePath);
        const fileContent = await fsp.readFile(file, 'utf8');
        const parsedContent = parseAndValidate(fileContent, schema);
        return parsedContent;
      }
    } catch (err) {
      throw new Error(`File loadFileContent (${filePath}): ${err}`);
    }
  }

  async _locateChainFile(chainFilePath) {
    try {
      await fsp.access(chainFilePath, fs.constants.F_OK | fs.constants.W_OK);
      return chainFilePath;
    } catch (err) {
      const localChainFilePath = path.join(path.dirname(this.filePath), chainFilePath);
      try {
        await fsp.access(localChainFilePath, fs.constants.F_OK | fs.constants.W_OK);
        return localChainFilePath;
      } catch (err) {
        throw err;
      }
    }
  }

  async getChains(json, namespace, exclude_namespace) {
    if (json.hasOwnProperty('chains')) {
      if (json.chains instanceof Array) {
        const loadChains = [];
        for (const chain of json.chains) {
          let load = true;
          if (namespace.length && !namespace.includes(chain.namespace)) {
            load = false;
          }
          if (exclude_namespace.length && exclude_namespace.includes(chain.namespace)) {
            load = false;
          }
          if (load) {
            loadChains.push(this.getChain(chain));
          }
        }
        try {
          const loadedChains = await Promise.all(loadChains);
          return loadedChains;
        } catch (err) {
          throw err;
        }
      } else {
        throw new Error('Invalid PlanFile, chain is not an array.');
      }
    } else {
      throw new Error('Invalid PlanFile, chain property not found.');
    }
  }

  async getChain(chain) {
    try {
      if (chain.hasOwnProperty('chain_path')) {
        const fileContent = await this.loadFileContent(chain.chain_path, 'chainSchema');
        const realChain = this.getChain(fileContent);
        return realChain;
      } else {
        if (this.chainIsValid(chain, false)) {
          return chain;
        } else {
          throw new Error(`Chain ${chain.id} is not valid.`);
        }
      }
    } catch (err) {
      throw err;
    }
  }

  chainIsValid(chain, silent) {
    try {
      const valid = ajv.validate('chainSchema', chain);
      if (!valid) {
        if (!silent) {
          logger.log('error', `Invalid chain, id ${chain.id} for schema chainSchema:\n${ajv.errors}`);
          consoleAjvErrors(chainSchema, chain, ajv.errors);
        }
        return false;
      } else {
        return true;
      }
    } catch (err) {
      if (!silent) {
        logger.log('error', `Invalid chain, id ${chain.id} for schema chainSchema: ${err}`);
      }
      return false;
    }
  }
}

module.exports = FilePlan;
