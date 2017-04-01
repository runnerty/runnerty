"use strict";

var nodemailer = require('nodemailer');
var ejs = require('ejs');

var path = require('path');
var fs = require('fs');

var Execution = require("../../classes/execution.js");

function readFilePromise(type, file) {
  return new Promise(function (resolve, reject) {
    fs.readFile(file, function (err, data) {
      var res = {};
      if (err) {
        res[type] = err;
        reject(res);
      } else {
        res[type] = data;
        resolve(res);
      }
    });
  });
}

class mailExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {
          var mail = res;
          mail.params = {};

          if (res.to) {

            for (var i = 0, len = res.to.length; i < len; i++) {
              if (i) {
                mail.to = mail.to + res.to[i] + ((i < len - 1) ? ', ' : '');
              }
              else {
                mail.to = res.to[i] + ((i < len - 1) ? ', ' : '');
              }
            }

            if (res.cc) {
              for (var i = 0, len = res.cc.length; i < len; i++) {
                if (i) {
                  mail.cc = mail.cc + res.cc[i] + ((i < len - 1) ? ', ' : '');
                }
                else {
                  mail.cc = res.cc[i] + ((i < len - 1) ? ', ' : '');
                }
              }
            }

            if (res.bcc) {
              for (var i = 0, len = res.bcc.length; i < len; i++) {
                if (i) {
                  mail.bcc = mail.bcc + res.bcc[i] + ((i < len - 1) ? ', ' : '');
                }
                else {
                  mail.bcc = res.bcc[i] + ((i < len - 1) ? ', ' : '');
                }
              }
            }

            mail.params.subject = res.title;
            mail.params.message = res.message;

            var templateDir = path.resolve(mail.templateDir, mail.template);
            var htmlTemplate = path.resolve(templateDir, 'html.html');
            var txtTemplate = path.resolve(templateDir, 'text.txt');

            Promise.all([
              readFilePromise('html', htmlTemplate),
              readFilePromise('text', txtTemplate)
            ])
              .then(
                async function (res) {

                  var [html_data_file, text_data_file] = res;

                  var html_data = html_data_file.html.toString();
                  var text_data = text_data_file.text.toString();

                  var options = {
                    useArgsValues: true,
                    useProcessValues: true,
                    useGlobalValues: true,
                    useExtraValue: mail.params
                  };
                  var [html, text] = await Promise.all([
                    _this.paramsReplace(html_data, options),
                    _this.paramsReplace(text_data, options)
                  ]);

                  if (mail.ejsRender) {
                    html = ejs.render(html);
                    text = ejs.render(text);
                  }

                  var mailOptions = {
                    from: mail.from,
                    to: mail.to,
                    cc: mail.cc,
                    bcc: mail.bcc,
                    subject: mail.params.subject,
                    text: text,
                    html: html,
                    attachments: mail.attachments
                  };

                  if (mail.disable) {
                    _this.logger.log('warn', 'Mail sender is disable.');
                    var endOptions = {
                      end: 'end',
                      messageLogType: 'warn',
                      messageLog:  'Mail sender is disable.',
                      execute_err_return:  'Mail sender is disable.',
                      execute_return: 'Mail sender is disable.'
                    };
                    _this.end(endOptions, resolve, reject);
                  } else {
                    var transport = nodemailer.createTransport(mail.transport);

                    transport.sendMail(mailOptions,
                      function (err, res) {
                        if (err) {
                          var endOptions = {
                            end: 'error',
                            messageLog: `Error sending mail (sendMail): ${err}`,
                            execute_err_return: `Error sending mail: ${err}`,
                          };
                          _this.end(endOptions, resolve, reject);
                        } else {
                          var endOptions = {
                            end: 'end'
                          };
                          _this.end(endOptions, resolve, reject);
                        }
                      });
                  }
                })
              .catch(function (err) {
                var endOptions = {
                  end: 'error',
                  messageLog:  `Error sending mail: ${err}`,
                  execute_err_return: `Error sending mail: ${err}`,
                };
                _this.end(endOptions, resolve, reject);
              });

          } else {
            var endOptions = {
              end: 'error',
              messageLog:  `Error Mail recipient not setted.`,
              execute_err_return:  `Error Mail recipient not setted.`,
              execute_return: ''
            };
            _this.end(endOptions, resolve, reject);
          }
        })
        .catch((err) => {
          var endOptions = {
            end: 'error',
            messageLog: `mailExecutor Error getValues: ${err}`,
            execute_err_return: `mailExecutor Error getValues ${err}`,
            execute_return: ''
          };
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = mailExecutor;