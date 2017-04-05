"use strict";

var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');

var Execution = global.ExecutionClass;

class s3Executor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues()
        .then((res) => {

          var awsS3Config = {
            apiVersion: res.apiVersion,
            accessKeyId: res.accessKeyId,
            secretAccessKey: res.secretAccessKey,
            bucket: res.bucket,
            method: res.method,
            region: res.region
          };

          var s3 = new AWS.S3(awsS3Config);

          if (res.method === 'upload') {

            // call S3 to retrieve upload file to specified bucket
            var uploadParams = {Bucket: res.bucket, Key: '', Body: ''};
            var file_name = res.remote_file || path.basename(res.local_file);

            var fileStream = fs.createReadStream(res.local_file);
            fileStream.on('error', function (err) {
              _this.logger.log('error', 'S3 upload reading file Error', res.local_file, err);
            });

            uploadParams.Body = fileStream;
            uploadParams.Key = file_name;

            s3.upload(uploadParams, function (err, data) {
              if (err) {
                var endOptions = {
                  end: 'error',
                  messageLog: `S3 upload file Error: ${err}`,
                  execute_err_return: `S3 upload file Error: ${err}`
                };
                _this.end(endOptions, resolve, reject);
              }
              else {
                var endOptions = {
                  end: 'end',
                  execute_return: JSON.stringify(data)
                };
                _this.end(endOptions, resolve, reject);
              }
            });
          } else {
            var endOptions = {
              end: 'error',
              messageLog: `S3 method not accepted: ${method}`,
              execute_err_return: `S3 method not accepted: ${method}`
            };
            _this.end(endOptions, resolve, reject);
          }
        })
        .catch((err) => {
          var endOptions = {
            end: 'error',
            messageLog: `S3 Error getValues: ${err}`,
            execute_err_return: `S3 Error getValues: ${err}`
          };
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = s3Executor;