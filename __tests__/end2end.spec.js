const exec = require('./test_src/exec.js');
jest.setTimeout(80000);

describe('Queues', () => {
  const successOutput = `info: 1 CHAIN_ONE
info: CHAIN
info: CHAIN
info: 4 CHAIN_TWO_PROC_ONE
info: 5 CHAIN_TWO_PROC_TWO
info: 6 CHAIN_TWO END
info: 7 CHAIN_THREE
info: 8 CHAIN_THREE_PROC_ONE
info: 9 CHAIN_THREE_PROC_TWO
info: 10 CHAIN_THREE END
info: 11 CHAIN_ONE_PROC_ONE
info: 12 CHAIN_ONE_PROC_TWO
info: 13 CHAIN_ONE END
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res).toEqual(successOutput);
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
  info: -> [5-echo PROCESS-LAUNCHER-2_3] CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-1] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-2] PROCESS PROCESS-ITER-2-2 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-3] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 START
  info: -> -> [5-echo PROCESS-LAUNCHER-2_3-4] PROCESS PROCESS-ITER-2-3 OF CHAIN CHAIN-ITERABLE-2 END
  info: -> [5-echo PROCESS-LAUNCHER-2_3] CHAIN CHAIN-ITERABLE-2 END
  info: 6 Inicio: PROCESS-LAUNCHER-3
  info: 8 Inicio: PROC-FIN
  info: 7 Fin: PROCESS-LAUNCHER-3
  info: 9 Fin: PROC-FIN
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
        '--end'
      ],
      16000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
  info: - 4     [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE END
  info: - 4     [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
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
        '--end'
      ],
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
        '--end'
      ],
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
  info: ERR!        [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE FAIL: /bin/sh: lol: command not found
  info: ERR!  [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE FAIL
  info: - 4     [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE START
  info: - 5       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE START
  info: - 6       [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-ONE OF CHAIN CHAIN-ITERABLE END
  info: - 7      [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE START
  info: - 8      [I:echo PROCESS-LAUNCHER_5] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE END
  info: - 9   [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE END
  info: ERR! 10 CHAIN CHAIN-LAUNCHER FAIL`;

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
        '--end'
      ],
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
        '--end'
      ],
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
        done();
      }
    );
  });
});


describe('RetryProcessCAOF', () => {
  const successOutput = `info: CHAIN CHAIN_ONE START
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:
  info: [[DP]]! ERR! PROCESS PROCESS_TWO FAIL
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:
  info: CHAIN CHAIN_ONE FAIL
  info: CHAIN CHAIN_ONE RETRY
  info: CHAIN CHAIN_ONE END
  info: CHAIN CHAIN_ONE START
  info: [[DP]]! PROCESS PROCESS_TWO START - TS:1
  info: [[DP]]! PROCESS PROCESS_ONE START - TS:1
  info: [[DP]]! PROCESS PROCESS_TWO END - TS:1
  info: [[DP]]! PROCESS PROCESS_ONE END - TS:1
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
      9000,
      res => {
        const _res = res.substring(res.indexOf('\n') + 1);
        expect(_res.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')).toEqual(
          successOutput.replace(/(\r\n\t|\n|\r\t|\ )/gm, '')
        );
        done();
      }
    );
  });
});

