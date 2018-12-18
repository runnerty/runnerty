const exec = require("../exec.js");

describe("Queues", () => {

  jest.setTimeout(10000);

  const successOutput = `info: 1 CHAIN_ONE
info: 2 CHAIN_ONE_PROC_ONE QUEUE
info: 3 CHAIN_TWO
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


  test("Execution End2End: Queues", done => {
    exec("node",["index.js","-c","./__tests__/end2end/config.json","-P","./__tests__/end2end/plan_queue.json","-f","CHAIN_ONE,CHAIN_TWO,CHAIN_THREE"],9000,(res)=>{
      const _res = res.substring(res.indexOf("\n") + 1);
      expect(_res).toEqual(successOutput);
      done();
    });
  });
});
