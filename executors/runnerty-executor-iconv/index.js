"use strict";

var iconv = require('iconv-lite');
var fs = require('fs');
var path = require('path');

var Execution = global.ExecutionClass;

class iconvExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec() {
    var _this = this;

    return new Promise(function (resolve, reject) {
      _this.getValues()
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
                  var endOptions = {
                    end: 'error',
                    messageLog: `Error Iconv reading file ${res.file_input}: ${err}`,
                    execute_err_return: `Error Iconv reading file ${res.file_input}: ${err}`
                  };
                  _this.end(endOptions, resolve, reject);
                });

                decoderStream.on('error', function (err, str) {
                  var endOptions = {
                    end: 'error',
                    messageLog: `Error Iconv decoding (${res.decode_encoding}) file ${res.file_input}: ${err}`,
                    execute_err_return: `Error Iconv decoding (${res.decode_encoding}) file ${res.file_input}: ${err}`
                  };
                  _this.end(endOptions, resolve, reject);
                });

                fileStreamOutput.on('error', function (err) {
                  var endOptions = {
                    end: 'error',
                    messageLog: `Error Iconv writing encoded file ${res.file_output}: ${err}`,
                    execute_err_return: `Error Iconv writing encoded file ${res.file_output}: ${err}`
                  };
                  _this.end(endOptions, resolve, reject);
                });

                fileStreamOutput.on('close', function () {
                  var endOptions = {
                    end: 'end'
                  };
                  _this.end(endOptions, resolve, reject);
                });
              } else {
                var endOptions = {
                  end: 'error',
                  messageLog: `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${res.file_output}`,
                  execute_err_return: `Error Iconv files not setted: file_input: ${_file_input} / file_output: ${res.file_output}`
                };
                _this.end(endOptions, resolve, reject);
              }

            } else {
              var endOptions = {
                end: 'error',
                messageLog: `Error Iconv encodings not supported. decode_encoding: ${res.decode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${res.encode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'}`,
                execute_err_return: `Error Iconv encodings not supported. decode_encoding: ${res.decode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'} / encode_encoding: ${res.encode_encoding} ${iconv.encodingExists(res.decode_encoding) ? 'supported' : 'not supported'}`
              };
              _this.end(endOptions, resolve, reject);
            }

          } else {
            var endOptions = {
              end: 'error',
              messageLog: `Error Iconv encoders not setted. decode_encoding: ${res.decode_encoding} / encode_encoding: ${res.encode_encoding}`,
              execute_err_return: `Error Iconv encoders not setted. decode_encoding: ${res.decode_encoding} / encode_encoding: ${res.encode_encoding}`
            };
            _this.end(endOptions, resolve, reject);
          }
        })
        .catch((err) => {
          var endOptions = {
            end: 'error',
            messageLog: `iconvExecutor Error getValues: ${err}`,
            execute_err_return: `iconvExecutor Error getValues: ${err}`
          };
          _this.end(endOptions, resolve, reject);
        });
    });
  }
}

module.exports = iconvExecutor;