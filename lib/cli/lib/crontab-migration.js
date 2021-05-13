'use strict';

const path = require('path');
const fs = require('fs');

class crontabMigration {
  constructor(crontabObject, schemasConfig, projectPath) {
    this.crontab = crontabObject;
    this.schemas = schemasConfig;
    this.projectPath = projectPath;
    this.plan = {};
    this.config = {};
    this.generateConfig();
    this.generatePlan();
  }

  saveFile(filename, planLinkObj) {
    fs.writeFileSync(path.join(this.projectPath, filename), JSON.stringify(planLinkObj, null, 2), 'utf-8');
  }

  generateConfig() {
    this.config['$schema'] = this.schemas['config'].schema;
    this.config['general'] = { 'runnerty.io': { apikey: 'API_KEY_HERE', disable: true } };
    this.config['triggers'] = [
      {
        id: 'schedule_default',
        type: '@runnerty-trigger-schedule'
      }
    ];
    this.config['executors'] = [
      {
        id: 'shell_default',
        type: '@runnerty-executor-shell'
      }
    ];
    this.config['notifiers'] = [
      {
        id: 'console_default',
        type: '@runnerty-notifier-console'
      }
    ];
    this.config['global_values'] = [];
    this.saveFile('config.json', this.config);
  }

  generatePlan() {
    this.plan['$schema'] = this.schemas['plan_chains_link'].schema;
    this.plan.chains = [];

    for (let i = 0; i < this.crontab.crontabLines.length; i++) {
      const line = this.crontab.crontabLines[i];
      this.plan.chains.push({ chain_path: `chains/chain-${i + 1}.json` });

      this.generateChain(line, i);
    }
    this.saveFile('plan.json', this.plan);
  }

  generateChain(chainLine, chainLineNumber) {
    const chain = {};
    chain['$schema'] = this.schemas['chains'].schema;
    chain.id = `CHAIN-${chainLineNumber + 1}`;
    chain.name = `CHAIN-${chainLineNumber + 1}`;
    chain.triggers = [
      {
        id: 'schedule_default',
        schedule_interval: chainLine.cron
      }
    ];

    // DEFAULTS PROCESSES
    chain['defaults_processes'] = {
      notifications: {
        on_start: [
          {
            id: 'console_default',
            message: 'PROCESS @GV(PROCESS_ID) START'
          }
        ],
        on_fail: [
          {
            id: 'console_default',
            message: 'PROCESS @GV(PROCESS_ID) FAIL: @GV(PROCESS_EXEC_ERR_OUTPUT)'
          }
        ],
        on_end: [
          {
            id: 'console_default',
            message: 'PROCESS @GV(PROCESS_ID) END'
          }
        ]
      }
    };

    // PROCESSES
    chain.processes = [];
    for (let i = 0; i < chainLine.commands.length; i++) {
      const command = chainLine.commands[i];
      const cmd = {};
      cmd.id = `PROCESS-${i + 1}`;
      cmd.name = `PROCESS-${i + 1}`;

      // EXEC
      cmd.exec = {};
      cmd.exec.id = 'shell_default';
      cmd.exec.command = command.command;

      // DEPENDENCIES
      if (command['depends_process']) {
        cmd['depends_process'] = command['depends_process'];
      }

      // DEPENDENCIES (NEXT PROCESS)
      if (command.nextRunOnEnd) {
        if (chainLine.commands[i + 1]) {
          chainLine.commands[i + 1]['depends_process'] = [cmd.id];
        }
      }
      if (command.nextRunOnFail) {
        if (chainLine.commands[i + 1]) {
          chainLine.commands[i + 1]['depends_process'] = { $fail: cmd.id };
        }
      }

      // OUTPUTS
      if (command.outputs) {
        cmd.output = [];
        for (const outputItem of command.outputs) {
          const output = {};
          output.file_name = outputItem.file;
          output.concat = !outputItem.overwrite;
          output.maxsize = '10mb';
          output.write = [];

          if (outputItem.errorOutput && !outputItem.errorToStandard) {
            output.write.push(
              "@GETDATE('YYYY-MM-DD HH:mm:ss') - @GV(CHAIN_ID) / @GV(PROCESS_ID): @GV(PROCESS_EXEC_ERR_OUTPUT)\n"
            );
          } else {
            output.write.push(
              `@GETDATE('YYYY-MM-DD HH:mm:ss') - @GV(CHAIN_ID) / @GV(PROCESS_ID): @GV(PROCESS_EXEC_MSG_OUTPUT)${
                outputItem.errorToStandard ? '@GV(PROCESS_EXEC_ERR_OUTPUT)' : ''
              }\n`
            );
          }
          cmd.output.push(output);
        }
      }

      // OUTPUT SHARE
      if (command.shareOutputForInputOfNext) {
        cmd.outputShare = [
          {
            key: 'OUTPUT',
            name: cmd.id,
            value: `@GV(PROCESS_EXEC_MSG_OUTPUT)`
          }
        ];
        // STDIN
        if (chainLine.commands[i + 1]) {
          chainLine.commands[i + 1].command = `${chainLine.commands[i + 1].command} <<< @GV(OUTPUT_${cmd.id})`;
        }
      }

      chain.processes.push(cmd);
    }
    // console.log(chainLine);
    this.saveFile(`chains/chain-${chainLineNumber + 1}.json`, chain);
  }
}

module.exports = crontabMigration;
