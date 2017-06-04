# Plan

The chain or chains that are going to be executed are defined in the plan.json file. 

It is possible to load a chain from an external file using "chain_path". 

```json
{
  "chains":[
    {"chain_path":"/var/runnerty/chains/my-chain-one.json"},
    {"chain_path":"/var/runnerty/chains/my-chain-two.json"},
    [...]
  ]
}
```

Or directly as an object of the "chains" array: 

```json
{
  "chains":[
    {
      "id":"MY_CHAIN_ONE",
      [...]
    }
  ]
}
```

Runnerty will try to get the plan.json file in the actual path but it is possible to indicate a plan.json file in the config.json:

```json
{
  "config": {
    "general": {
      "planFilePath": "/var/runnerty/my-plan.json"
    }
  }
}
```

### structure (chain and process)

A plan is formed by one or more chains. A chain is a set of processes with it’s owns properties like scheduling, events, outputs, etc.

This is the basic structure of a plan with chain with one process:

```json
{
  "chains":[
    {
      "id":"EXAMPLE_CHAIN",
      "name":"Name of the sample chain",
      "schedule_interval":"* * * * *",
      "depends_chains":[],
      "processes":[
        {
          "id":"CONCAT_ALL_CSV_FILES",
          "name":"Concatena todos los archivos .csv en uno",
          "exec":{
            "id":"shell default",
            "command":"echo 'Hello world'",
          },
          "end_chain_on_fail":true,
        }
      ]
    }
  ]
}
```

