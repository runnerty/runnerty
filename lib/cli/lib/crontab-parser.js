'use strict';

const cronCheker = require('cron-parser');

class CronParser {
  constructor(crontabData) {
    this.mailTo = '';
    this.comentLines = [];
    this.crontabLines = [];
    this.splitConfig = [
      {
        separator: '||',
        nextRunOnFail: true
      },
      { separator: '|', shareOutputForInputOfNext: true, nextRunOnEnd: true },
      {
        separator: '&&',
        nextRunOnEnd: true
      },
      {
        separator: '&',
        nextRunOnEnd: false
      }
    ];

    this.splitOutputConfig = [
      {
        separator: '1>>',
        overwrite: false
      },
      {
        separator: '2>>',
        errorOutput: true,
        overwrite: false
      },
      {
        separator: '>>',
        overwrite: false
      },
      {
        separator: '2>',
        errorOutput: true,
        overwrite: true
      },
      {
        separator: '1>',
        overwrite: true
      },
      {
        separator: '>',
        overwrite: true
      }
    ];

    this.init(crontabData);
  }

  // INIT
  init(crontabPath) {
    try {
      const lines = crontabPath.split(/\r?\n/);
      lines.forEach(line => {
        this.checkCrontabLine(line);
      });

      const result = {};
      if (this.mailTo) result.mailTo = this.mailTo;
      if (this.comentLines) result.comentLines = this.comentLines;
      if (this.crontabLines) result.crontabLines = this.crontabLines;

      return result;
    } catch (err) {
      throw err;
    }
  }

  checkCrontabLine(crontabLine) {
    switch (true) {
      case this.isCronLine(crontabLine):
        break;
      case this.isCommentLine(crontabLine):
        break;
      case this.isMailtoLine(crontabLine):
        break;
      default:
        break;
    }
  }

  isCommentLine(crontabLine) {
    if (crontabLine.startsWith('#')) {
      this.comentLines.push(crontabLine.substr(1));
      return true;
    } else {
      return false;
    }
  }

  isMailtoLine(crontabLine) {
    if (crontabLine.startsWith('MAILTO')) {
      const equalPosition = crontabLine.indexOf('=');
      this.mailTo = crontabLine.substr(equalPosition + 1).replace(/['"]+/g, '');
      return true;
    } else {
      return false;
    }
  }

  isCronLine(crontabLine) {
    let commandLine = '';
    const cron = crontabLine.split(' ').slice(0, 5).join(' ');
    if (cron.length) {
      try {
        cronCheker.parseExpression(cron);
        commandLine = crontabLine.substr(cron.length + 1).trim();
        const parsedCommand = this.parseCommandLine(commandLine);
        this.crontabLines.push({ commandLine, cron, commands: parsedCommand });
        return true;
      } catch (err) {
        return false;
      }
    } else {
      return false;
    }
  }

  getOutputs(cmd) {
    let commandsSplited = cmd;
    const outputs = {};
    for (const separator of this.splitOutputConfig) {
      commandsSplited = this.splitterOutputs(commandsSplited, separator);
    }

    for (const command of commandsSplited) {
      // Command
      if (Object.keys(command).length === 1) {
        outputs.cmd = command.file;
        // Outputs
      } else {
        if (!outputs.outputs) outputs.outputs = [];
        outputs.outputs.push(command);
      }
    }
    return outputs;
  }

  splitterOutputs(input, separator) {
    if (typeof input === 'string') {
      input = [{ file: input }];
    }

    const commandsSplited = [];
    for (const item of input) {
      const subCommands = item.file.trim().split(` ${separator.separator}`);

      if (subCommands.length > 1) {
        for (let i = 0; i < subCommands.length; i++) {
          const element = { file: subCommands[i].trim() };

          if (i > subCommands.length - 2) {
            for (const separatorAtribute of Object.keys(separator)) {
              if (separatorAtribute !== 'separator') element[separatorAtribute] = separator[separatorAtribute];
            }
          } else {
            for (const itemAtribute of Object.keys(item)) {
              if (itemAtribute !== 'file') element[itemAtribute] = item[itemAtribute];
            }
          }

          if (element['file'] === '&1') {
            element.errorToStandard = true;
          }

          commandsSplited.push(element);
        }
      } else {
        commandsSplited.push(item);
      }
    }

    return commandsSplited;
  }

  splitter(input, separator) {
    if (typeof input === 'string') {
      input = [{ cmd: input }];
    }

    const commandsSplited = [];
    for (const item of input) {
      const subCommands = item.cmd.trim().split(` ${separator.separator} `);

      for (let i = 0; i < subCommands.length; i++) {
        const element = { cmd: subCommands[i].trim() };

        if (i < subCommands.length - 1) {
          for (const separatorAtribute of Object.keys(separator)) {
            if (separatorAtribute !== 'separator') element[separatorAtribute] = separator[separatorAtribute];
          }
        }

        if (i == subCommands.length - 1) {
          for (const itemAtribute of Object.keys(item)) {
            if (itemAtribute !== 'cmd') element[itemAtribute] = item[itemAtribute];
          }
        }
        commandsSplited.push(element);
      }
    }

    return commandsSplited;
  }

  parseCommandLine(commandLine) {
    let commandsSplited = commandLine;
    for (const separator of this.splitConfig) {
      commandsSplited = this.splitter(commandsSplited, separator);
    }

    const pasedCommands = [];
    for (const command of commandsSplited) {
      command.cmd = command.cmd.trim();
      const cmdRes = {};
      cmdRes.command = command.cmd;
      for (const commandAtribute of Object.keys(command)) {
        if (commandAtribute !== 'cmd') cmdRes[commandAtribute] = command[commandAtribute];
      }

      const outputs = this.getOutputs(command.cmd);
      if (outputs.cmd) cmdRes.command = outputs.cmd;

      if (outputs.outputs) cmdRes.outputs = outputs.outputs;
      pasedCommands.push(cmdRes);
    }
    return pasedCommands;
  }
}

module.exports = CronParser;
