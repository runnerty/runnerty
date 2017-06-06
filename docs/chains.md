# Chain

A chain is a set of processes with it’s own properties like scheduling, events, dependencies, outputs, etc.

This is an example of a basic chain with one process:

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
### Identification
A chain has two identification fields:

Id, identifies the chain. with this identifier Runnerty will provide a global value (:CHAIN_ID) that can be used in the whole chain. To know more about global variables have a look at: //TODO: link to global variables

```json
{
  ...
  "id":"EXAMPLE_CHAIN",
  ...
}
```

name, it's a description of the chain:

```json
{
  ...
  "name":"Name of the sample chain",
  ...
}
```

### scheduling
There are diferent ways to schedule a chain. It is possible to schedule a chains with a cron expression //TODO: add link to official page

This scheduling will execute the chain at every minute:

```json
{
  ...
  "schedule_interval":"*/1 * * * *",
  ...
}
```

There is also the possibility to schedule a chain using a calendar. //TODO: desc y ejemplo de calendarios.

In addition, Runnerty can execute a chain when a file is set in a path. (filewatcher).
//TODO: ejemplo.

### dependencies

It is possible to define dependencies with other chains or with processes of other chains. This means than a chain with dependencies will never execute after their dependencies are resolve. For example:

```json
{
  ...
  "depends_chains":["CHAIN_ONE"],
  ...
}
```

The chain of the example will no execute after the chain with the id CHAIN_ONE is finish. It is also possible to configure a dependence of a chain's process or chains or more:

```json
{
  ...
  "depends_chains":{"chain_id":"CHAIN_ONE","process_id":"PROCESS_ONE"},
  ...
}
```

### events

With the events property Runnerty can access to the differnts states of the chain: "on_start", "on_fail" and "on_end".

In this events we can notify anything using a notificator. (know mor about notificators //TODO: link).

This is an example o the events of a chain using the Telegam notificator:

```json
{
  ...
  "events": {
    "on_start": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE CHAIN HAS STARTED"
        }
      ]
    },
    "on_fail": {
      "notifications": [
        {
          "id": "telegram_default",
	  "message": "THE CHAIN HAS FAILED"
        }
      ]
    },
    "on_end": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE CHAIN HAS FINISHED"
        }
      ]
    }
  }
  ...
}
```


MONITORIZACION
Nos permiten monotorizar los procesos para conocer cuando terminan y en que estado. histórico.

ITERABLES

PROCESOS

GLOBAL VALUES (CHAIN ID, PROCESS ID)
