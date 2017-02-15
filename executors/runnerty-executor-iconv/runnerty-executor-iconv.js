"use strict";

var iconv = require('iconv-lite');
var fs = require('fs');
var path = require('path');

var Execution = require("../../classes/execution.js");

class iconvExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(process) {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues(process)
        .then((res) => {

          if (res.decode_encoding && res.encode_encoding) {

            if (iconv.encodingExists(res.decode_encoding) && iconv.encodingExists(res.encode_encoding)) {

              // CONVERTING FILE
              if (res.file_input && res.file_output) {
                var fileStream = fs.createReadStream(res.file_input);
                var fileStreamOutput = fs.createWriteStream(res.file_output);
                var decoderStream = iconv.decodeStream(res.decode_encoding);

                fileStream
                  .pipe(decoderStream)
                  .pipe(iconv.encodeStream(res.encode_encoding))
                  .pipe(fileStreamOutput);


                fileStream.on('error', function (err) {
                  _this.logger.log('error', 'Error Iconv reading file', res.file_input, err);
                  process.execute_err_return = `Error Iconv reading file ${res.file_input}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                decoderStream.on('error', function (err, str) {
                  _this.logger.log('error', `Error Iconv decoding (${res.decode_encoding}) file ${res.file_input}:`, err);
                  process.execute_err_return = `Error Iconv decoding (${res.decode_encoding}) file ${res.file_input}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                fileStreamOutput.on('error', function (err) {
                  _this.logger.log('error', 'Error Iconv writing encoded file', res.file_output, err);
                  process.execute_err_return = `Error Iconv writing encoded file ${res.file_output}: ${err}`;
                  process.execute_return = '';
                  process.error();
                  reject(process);
                });

                fileStreamOutput.on('close', function () {
                  process.execute_err_return = '';
                  process.execute_return = '';
                  process.end();
                  resolve();
                });
              } else {
                _this.logger.log('error', `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${res.file_output}`);
                process.execute_err_return = `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${res.file_output}`;
                process.execute_return = '';
                process.error();
                reject(process);
              }

            } else {
              _this.logger.log('error', `Error Iconv encodings not supported. decode_encoding: ${res.decode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${res.encode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'}`);
              process.execute_err_return = `Error Iconv encodings not supported. decode_encoding: ${res.decode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${res.encode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'}`;
              process.execute_return = '';
              process.error();
              reject(process);
            }

          } else {
            _this.logger.log('error', `Error Iconv encoders not setted. decode_encoding: ${res.decode_encoding} / encode_encoding: ${res.encode_encoding}`);
            process.execute_err_return = `Error Iconv encoders not setted. decode_encoding: ${res.decode_encoding} / encode_encoding: ${res.encode_encoding}`;
            process.execute_return = '';
            process.error();
            reject(process);
          }
        })
        .catch((err) => {
          _this.logger.log('error', `iconvExecutor Error getValues: ${err}`);
          process.execute_err_return = `iconvExecutor Error getValues ${err}`;
          process.execute_return = '';
          process.error();
          reject(process);
        });
    });
  }
}

module.exports = iconvExecutor;