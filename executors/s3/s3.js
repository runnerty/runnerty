"use strict";

var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');

var Execution = require("../../classes/execution.js");

class s3Executor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      process.loadExecutorConfig()
        .then((configValues) => {

          var s3 = new AWS.S3(configValues);

          var method = _this.replaceWith(process.exec.method || configValues.method, process.values());

          if (method === 'upload') {

            var bucket = _this.replaceWith(process.execute_args.bucket || configValues.bucket, process.values());

            // call S3 to retrieve upload file to specified bucket
            var uploadParams = {Bucket: bucket, Key: '', Body: ''};
            var file = _this.replaceWith(process.exec.file, process.values());
            var file_name = _this.replaceWith(process.exec.file_name || path.basename(file), process.values());

            var fileStream = fs.createReadStream(file);
            fileStream.on('error', function (err) {
              _this.logger.log('error', 'S3 upload reading file Error', file, err);
            });

            uploadParams.Body = fileStream;
            uploadParams.Key = file_name;

            s3.upload(uploadParams, function (err, data) {
              if (err) {
                _this.logger.log('error', `S3 upload file Error: ${err}`);
                process.execute_err_return = `S3 upload file error: ${err}`;
                process.execute_return = '';
                process.error();
                reject(process);
              }
              if (data) {
                process.execute_err_return = '';
                process.execute_return = JSON.stringify(data);
                process.end();
                resolve();
              }
            });
          } else {
            _this.logger.log('error', `S3 method not accepted: ${method}`);
            process.execute_err_return = `S3 method not accepted: ${method}`;
            process.execute_return = '';
            process.error();
            reject(process);
          }
        });
    });
  }
}

module.exports = s3Executor;