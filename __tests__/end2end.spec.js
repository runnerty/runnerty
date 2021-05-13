const exec = require('./test_src/exec.js');
jest.setTimeout(80000);

function flatOutput(output) {
  return output
    .replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
    .replace('/bin/sh:1:', '/bin/sh:')
    .replace('commandnotfound', 'notfound');
}
function flatSuccessOutput(successOutput) {
  return successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '').replace('commandnotfound', 'notfound');
}

describe('Queues', () => {
  const successOutput = `info: 1 CHAIN_TWO
  info: 2 CHAIN_TWO_PROC_ONE
  info: 3 CHAIN_ONE
  info: 4 CHAIN_ONE_PROC_ONE ON QUEUE
  info: 5 CHAIN_TWO_PROC_TWO
  info: 6 CHAIN_TWO END
  info: 7 CHAIN_THREE
  info: 8 CHAIN_THREE_PROC_ONE
  info: 9 CHAIN_THREE_PROC_TWO
  info: 10 CHAIN_THREE END
  info: 11 CHAIN_ONE_PROC_ONE START
  info: 12 CHAIN_ONE_PROC_ONE END
  info: 13 CHAIN_ONE_PROC_TWO
  info: 14 CHAIN_ONE END
`;

  test('Execution End2End: Queues', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_queue.json',
        '-f',
        'CHAIN_ONE,CHAIN_TWO,CHAIN_THREE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('Iterable-end-ok-ignore-process', () => {
  const successOutput = `info: 1 CHAIN CHAIN-LAUNCHER START
  info: 2 Inicio: PROC-1
  info: 3 Fin: PROC-1
  info: 4 Inicio: PROCESS-LAUNCHER-2
  info: 5 Fin: PROCESS-LAUNCHER-2
  info: -> [5-echo PROCESS-LAUNCHER-2_1] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-3] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-4] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-echo PROCESS-LAUNCHER-2_1] CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-lol PROCESS-LAUNCHER-2_2] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-lol PROCESS-LAUNCHER-2_2-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  error: ERR! [I:lol PROCESS-LAUNCHER-2_2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 FAIL
  info: -> [5-lol PROCESS-LAUNCHER-2_2] CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-echo PROCESS-LAUNCHER-2_3] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-3] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-4] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-echo PROCESS-LAUNCHER-2_3] CHAIN CHAIN-ITERABLE-2 END
  info: 6 Inicio: PROCESS-LAUNCHER-3
  info: 8 Inicio: PROC-FIN
  info: 7 Fin: PROCESS-LAUNCHER-3 
  info: -> [6-1] CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-1-1] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-1-2] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 END
  info: -> [6-1] CHAIN CHAIN-ITERABLE-3 END
  info: -> [6-2] CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-2-1] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-2-2] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 END
  info: -> [6-2] CHAIN CHAIN-ITERABLE-3 END
  info: -> [6-3] CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-3-1] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 START
  info: -> -> [6-3-2] PROCESS PROCESS-ITER-3-2 OF CHAIN CHAIN-ITERABLE-3 END
  info: -> [6-3] CHAIN CHAIN-ITERABLE-3 END
  info: 10 CHAIN CHAIN-LAUNCHER END`;

  test('Execution End2End: Iterable-end-ok-ignore-process', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_check_iter_end_ok.json',
        '-f',
        'CHAIN-LAUNCHER',
        '-fd',
        '--end'
      ],
      16000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('SimpleIter', () => {
  const successOutput = `info: 1 CHAIN CHAIN-LAUNCHER START
  info: 2   PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER START
  info: 3    PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER END
  info: - 4     [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START OK1
  info: - 8      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START OK1
  info: - 8      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START OK1
  info: - 8      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START OK1
  info: - 8      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START OK1
  info: - 8      [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE END
  info: 10 CHAIN CHAIN-LAUNCHER END`;

  test('Execution End2End: SimpleIter', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_simple_iter.json',
        '-f',
        'CHAIN-LAUNCHER',
        '--custom_values',
        '\'{"CUSTOM_V1":"OK1"}\'',
        '-fd',
        '--end'
      ],
      9000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('SimpleIterFail', () => {
  const successOutput = `info: 1 CHAIN CHAIN-LAUNCHER START
  info: 2   PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER START
  info: 3    PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER END
  info: - 4     [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: ERR!        [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE FAIL: /bin/sh: lol: command not found
  info: ERR!  [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE FAIL
  info: ERR! 10 CHAIN CHAIN-LAUNCHER FAIL`;

  test('Execution End2End: SimpleIterFail', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_simple_iter_fail.json',
        '-f',
        'CHAIN-LAUNCHER',
        '-fd',
        '--end'
      ],
      9000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('SimpleIterFailNotEnd', () => {
  const successOutput = `info: 1 CHAIN CHAIN-LAUNCHER START
  info: 2   PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER START
  info: 3    PROCESS PROCESS-LAUNCHER OF CHAIN CHAIN-LAUNCHER END
  info: - 4     [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_1] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_1] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_2] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_2] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_3] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_3] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  error: ERR!        [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE FAIL: /bin/sh: lol: command not found
  error: ERR!  [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE FAIL
  error: ERR! 10 CHAIN CHAIN-LAUNCHER FAIL`;

  test('Execution End2End: SimpleIterFailNotEnd', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_simple_iter_fail_not_end.json',
        '-f',
        'CHAIN-LAUNCHER',
        '-fd',
        '--end'
      ],
      9000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('ComplexDependencies', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: PROCESS PROCESS_ONE START
  info: PROCESS PROCESS_ONE END
  info: PROCESS PROCESS_TWO START
  info: PROCESS PROCESS_TWO END
  info: PROCESS PROCESS_THREE START
  info: PROCESS PROCESS_THREE FAILS
  info: PROCESS PROCESS_FOUR START
  info: PROCESS PROCESS_FOUR END
  info: PROCESS PROCESS_FIVE START
  info: PROCESS PROCESS_FIVE END
  info: CHAIN CHAIN_ONE FAIL`;

  test('Execution End2End: ComplexDependencies', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_complex_dependencies.json',
        '-f',
        'CHAIN_ONE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('Iterable-end-error-abort-serie', () => {
  const successOutput = `info: 1 CHAIN CHAIN-LAUNCHER START
  info: 2 Inicio: PROC-1
  info: 3 Fin: PROC-1
  info: 4 Inicio: PROCESS-LAUNCHER-2
  info: 5 Fin: PROCESS-LAUNCHER-2
  info: -> [5-echo PROCESS-LAUNCHER-2_1] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-3] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_1-4] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-echo PROCESS-LAUNCHER-2_1] CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-lol PROCESS-LAUNCHER-2_2] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-lol PROCESS-LAUNCHER-2_2-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  error: ERR! [I:lol PROCESS-LAUNCHER-2_2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 FAIL
  error: ERR CHAIN! [I:lol PROCESS-LAUNCHER-2_2] CHAIN CHAIN-ITERABLE-2 FAIL
  error: ERR! CHAIN CHAIN-LAUNCHER FAIL`;

  test('Execution End2End: Iterable-end-error-abort-serie', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_check_iter_end_error.json',
        '-f',
        'CHAIN-LAUNCHER',
        '-fd',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('SimpleDefaultsProcess', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: [[OVERR-PROC]] PROCESS PROCESS_ONE START
  info: [[DP]]! PROCESS PROCESS_ONE END
  info: [[DP]]! PROCESS PROCESS_TWO START
  info: [[DP]]! PROCESS PROCESS_TWO END
  info: CHAIN CHAIN_ONE END`;

  test('Execution End2End: SimpleDefaultsProcess', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_defaults_processes.json',
        '-f',
        'CHAIN_ONE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('ArgsCustomValuesProcess', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: PROCESS PROCESS_ONE CV: L1 / 2 / I1 / I2
  info: CHAIN CHAIN_ONE END
  info: CHAIN CHAIN_ONE START
  info: PROCESS PROCESS_ONE CV: L1 / 2 / I3 / I4
  info: CHAIN CHAIN_ONE END`;

  test('Execution End2End: ArgsCustomValuesProcess', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_args_custom-values.json',
        '-f',
        'CHAIN_ONE',
        '--custom_values',
        '\'{"KV_1":"L1"}\'',
        '--input_values',
        '\'[{"KI1":"I1", "KI2":"I2"},{"KI1":"I3", "KI2":"I4"}]\'',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('RetryProcess', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:
  info: [[DP]]! ERR! PROCESS PROCESS_TWO FAIL: expr: syntax error
  info: [[DP]]! RETRY PROCESS PROCESS_TWO:  - TS:
  info: [[DP]]! ERR! PROCESS PROCESS_TWO FAIL: expr: syntax error
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:
  info: [[DP]]! RETRY PROCESS PROCESS_TWO:  - TS:1
  info: [[DP]]! PROCESS PROCESS_TWO END - TS:1
  info: CHAIN CHAIN_ONE END`;

  test('Execution End2End: RetryProcess', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_retry.json ',
        '-f',
        'CHAIN_ONE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('RetryProcessCAOF', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START 
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:
  info: [[DP]]! ERR! PROCESS PROCESS_TWO FAIL
  info: CHAIN CHAIN_ONE RETRY
  info: CHAIN CHAIN_ONE END
  info: CHAIN CHAIN_ONE START 
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:
  info: [[DP]]! ERR! PROCESS PROCESS_TWO FAIL
  info: CHAIN CHAIN_ONE RETRY
  info: CHAIN CHAIN_ONE END
  info: CHAIN CHAIN_ONE START 1
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:1
  info: [[DP]]! PROCESS PROCESS_TWO END - TS:1
  info: CHAIN CHAIN_ONE END`;

  test('Execution End2End: RetryProcessCAOF', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_retry_caof_obj.json',
        '-f',
        'CHAIN_ONE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('ParallelError', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: [[OVERR-PROC]] PROCESS PROCESS_1_ERR START
  info: [[DP]]! PROCESS PROCESS_2_OK START
  info: [[DP]]! ERR! PROCESS PROCESS_1_ERR FAIL: /bin/sh: cmd_fail: command not found
  info: [[DP]]! PROCESS PROCESS_2_OK END
  info: [[DP]]! PROCESS PROCESS_3_OK START
  info: [[DP]]! PROCESS PROCESS_3_OK END
  info: CHAIN CHAIN_ONE FAIL`;

  test('Execution End2End: ParallelError', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_parallel_error.json',
        '-f',
        'CHAIN_ONE',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanFD-NOT-FD', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info: START: PROCESS C1_P2
  info: END: PROCESS C1_P2
  info: >1> END OF THE CHAIN: CHAIN_1`;

  test('Execution End2End: PlanFD-NOT-FD', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_fd.json',
        '-f',
        'CHAIN_1',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanFD-FD', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info:   >2> START OF THE CHAIN: CHAIN_2 MYVAR1:C1_P1
  info:   START: PROCESS C2-P1 - C1_P1
  info:   END: PROCESS C2-P1
  info:   >2> END OF THE CHAIN: CHAIN_2
  info: START: PROCESS C1_P2
  info: END: PROCESS C1_P2
  info: >1> END OF THE CHAIN: CHAIN_1
  info: >3> START OF THE CHAIN: CHAIN_3
  info: START: PROCESS C3_P1
  info: END: PROCESS C3_P1 - A
  info: START: PROCESS C3_P2
  info: END: PROCESS C3_P2 - A
  info: >3> END OF THE CHAIN: CHAIN_3`;

  test('Execution End2End: PlanFD-FD', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_fd.json',
        '-f',
        'CHAIN_1',
        '-fd',
        '--end'
      ],
      8000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanFD-NOT-FORCED', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info:   >2> START OF THE CHAIN: CHAIN_2 MYVAR1:C1_P1
  info:   START: PROCESS C2-P1 - C1_P1
  info:   END: PROCESS C2-P1
  info:   >2> END OF THE CHAIN: CHAIN_2
  info: START: PROCESS C1_P2
  info: END: PROCESS C1_P2
  info: >1> END OF THE CHAIN: CHAIN_1
  info: >3> START OF THE CHAIN: CHAIN_3
  info: START: PROCESS C3_P1
  info: END: PROCESS C3_P1 - A
  info: START: PROCESS C3_P2
  info: END: PROCESS C3_P2 - A
  info: >3> END OF THE CHAIN: CHAIN_3`;

  test('Execution End2End: PlanFD-NOT-FORCED', done => {
    exec(
      'node',
      ['index.js', '-c', './__tests__/end2end/config.json', '-p', './__tests__/end2end/plan_fd.json','--end'],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanDepChains-NOT-FORCED', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info:   >2> START OF THE CHAIN: CHAIN_2 MYVAR1:C1_P1
  info:   START: PROCESS C2-P1 - C1_P1
  info:   END: PROCESS C2-P1
  info:   >2> END OF THE CHAIN: CHAIN_2
  info: START: PROCESS C1_P2
  info: END: PROCESS C1_P2
  info: >1> END OF THE CHAIN: CHAIN_1
  info: >3> START OF THE CHAIN: CHAIN_3
  info: START: PROCESS C3_P1
  info: END: PROCESS C3_P1 - A
  info: START: PROCESS C3_P2
  info: >4> START OF THE CHAIN: CHAIN_4
  info: START: PROCESS C4_P1
  info: END: PROCESS C4_P1
  info: >4> END OF THE CHAIN: CHAIN_4
  info: END: PROCESS C3_P2 - A
  info: >3> END OF THE CHAIN: CHAIN_3`;

  test('Execution End2End: PlanDepChains-NOT-FORCED', done => {
    exec(
      'node',
      ['index.js', '-c', './__tests__/end2end/config.json', '-p', './__tests__/end2end/plan_dep_chains.json','--end'],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanIterEndsIgnoringProcess', () => {
  const successOutput = `info: >>>> CHAIN CHAIN-ONE START
  info: init: PROCESS-LAUNCHER
  info: end: PROCESS-LAUNCHER 
  info: - 4     [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE START
  info: - 7      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:lol PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE START
  info: - 7      [I:lol PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: ERR!        [I:lol PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE FAIL: /bin/sh: lol: command not found
  info: ERR!  [I:lol PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE FAIL
  info: init: PROCESS-FOUR
  info: end: PROCESS-FOUR 
  info: >>>> CHAIN CHAIN-ONE END`;

  test('Execution End2End: PlanIterEndsIgnoringProcess', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_parallel_ends.json',
        '-f',
        'CHAIN-ONE',
        '-fd',
        '--end'
      ],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanPrevFinalProcFails', () => {
  const successOutput = `info: CHAIN START CHAIN-ONE
  info: PROCESS START P-1
  info: PROCESS END P-1 
  info: PROCESS START P-2
  error: PROCESS ERROR P-2 MSG ERROR
  error: CHAIN FAIL CHAIN-ONE`;

  test('Execution End2End: PlanPrevFinalProcFails', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_prev_final_proc_fails.json',
        '-f',
        'CHAIN-ONE',
        '--end'
      ],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanForcedProcForcedfdfp', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info: >1> END OF THE CHAIN: CHAIN_1`;

  test('Execution End2End: PlanForcedProcForcedfdfp', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_fd.json',
        '-f',
        'CHAIN_1',
        '-fp',
        'C1_P1',
        '--end'
      ],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});

describe('PlanForcedProcForcedfdfpfpd', () => {
  const successOutput = `info: >1> START OF THE CHAIN: CHAIN_1
  info: START: PROCESS C1_P1
  info: END: PROCESS C1_P1
  info:   >2> START OF THE CHAIN: CHAIN_2 MYVAR1:C1_P1
  info:   START: PROCESS C2-P1 - C1_P1
  info:   END: PROCESS C2-P1
  info:   >2> END OF THE CHAIN: CHAIN_2
  info: START: PROCESS C1_P2
  info: END: PROCESS C1_P2
  info: >1> END OF THE CHAIN: CHAIN_1
  info: >3> START OF THE CHAIN: CHAIN_3
  info: START: PROCESS C3_P1
  info: END: PROCESS C3_P1 - A
  info: START: PROCESS C3_P2
  info: END: PROCESS C3_P2 - A
  info: >3> END OF THE CHAIN: CHAIN_3`;

  test('Execution End2End: PlanForcedProcForcedfdfpfpd', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-p',
        './__tests__/end2end/plan_fd.json',
        '-f',
        'CHAIN_1',
        '-fd',
        '-fp',
        'C1_P1',
        '-fpd',
        '--end'
      ],
      2000,
      res => {
        expect(flatOutput(res)).toEqual(flatSuccessOutput(successOutput));
        done();
      }
    );
  });
});
