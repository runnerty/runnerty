const exec = require('../exec.js');

describe('Queues', () => {
  jest.setTimeout(10000);

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
        '-P',
        './__tests__/end2end/plan_queue.json',
        '-f',
        'CHAIN_ONE,CHAIN_TWO,CHAIN_THREE'
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

describe('SimpleIter', () => {
  jest.setTimeout(10000);

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
  info: 10 CHAIN CHAIN-LAUNCHER END
  info: - 9   [I:echo PROCESS-LAUNCHER_5] CHAIN CHAIN-ITERABLE END`;

  test('Execution End2End: SimpleIter', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-P',
        './__tests__/end2end/plan_simple_iter.json',
        '-f',
        'CHAIN-LAUNCHER'
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
  jest.setTimeout(10000);

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
  info: - 9   [I:lol PROCESS-LAUNCHER_4] CHAIN CHAIN-ITERABLE END
  info: ERR!        [I:lol PROCESS-LAUNCHER_4] PROCESS PROCESS-ITER-TWO OF CHAIN CHAIN-ITERABLE FAIL: /bin/sh:lol:commandnotfound`;
  
  test('Execution End2End: SimpleIterFail', done => {
    exec(
      'node',
      [
        'index.js',
        '-c',
        './__tests__/end2end/config.json',
        '-P',
        './__tests__/end2end/plan_simple_iter_fail.json',
        '-f',
        'CHAIN-LAUNCHER'
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
