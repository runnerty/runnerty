"use strict";
var Notification = require("../../classes/notification.js");
var nodemailer = require('nodemailer');
var path = require('path');
var fs = require('fs');

class mailNotificator extends Notification {
  constructor(notification) {
    super(notification);
  }

  notificate(values) {
    var _this = this;
    _this.getValues(values)
      .then((res) => {
        _this.queue(_this.channel, res);
      });
  }

  send(notification) {
    var _this = this;
    return new Promise((resolve, reject) => {
      notification.to = (notification.to)?notification.to.toString():'';
      notification.cc = (notification.cc)?notification.cc.toString():'';
      notification.bcc = (notification.bcc)?notification.bcc.toString():'';

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

      var transport = nodemailer.createTransport(notification.transport);
      var filesReads = [];

      var templateDir = path.resolve(notification.templateDir, notification.template);
      var htmlTemplate = path.resolve(templateDir, 'html.html');
      var txtTemplate = path.resolve(templateDir, 'text.txt');


      if(notification.attachments && notification.attachments.length > 0){
        var attachments = [];
        var attachmentsLength = notification.attachments.length;

        while (attachmentsLength--) {
          var keys = Object.keys(notification.attachments[attachmentsLength]);
          var keysLength = keys.length;
          var attAux = {};
          if (keysLength > 0) {
            while (keysLength--) {
              attAux[keys[keysLength]] = _this.replaceWith(notification.attachments[attachmentsLength][keys[keysLength]], notification.params);
            }
            attachments.push(attAux);
          }
        }
      }

      filesReads.push(readFilePromise('html', htmlTemplate));
      filesReads.push(readFilePromise('text', txtTemplate));

      Promise.all(filesReads)
        .then(function (res) {

          var html_data;
          var text_data;

          if (res[0].hasOwnProperty('html')) {
            [html_data, text_data] = [res[0].html.toString(), res[1].text.toString()];
          } else {
            [html_data, text_data] = [res[1].html.toString(), res[0].text.toString()];
          }

          var textData = [];
          textData.push(_this.replaceWith(html_data, notification));
          textData.push(_this.replaceWith(text_data, notification));

          Promise.all(textData)
            .then(function (res) {
              var [html, text] = res;
              var mailOptions = {
                from: notification.from,
                to: notification.to,
                cc: notification.cc,
                bcc: notification.bcc,
                subject: notification.subject,
                text: text,
                html: html,
                attachments: attachments
              };

              if (notification.disable) {
                _this.logger('warn', 'Mail sender is disable.');
                resolve();
              } else {
                transport.sendMail(mailOptions,
                  function (err, res) {
                    if (err) {
                      _this.logger('error', 'Mail sender:',err);
                      reject(err);
                    } else {
                      resolve(res);
                    }
                  });
              }
            })
            .catch(function (err) {
              _this.logger('error', 'Mail sender:',err);
              reject(err);
            });

        })
        .catch(function (err) {
          _this.logger('error', 'Mail sender:',err);
          reject(err);
        });

    });
  }

}

module.exports = mailNotificator;