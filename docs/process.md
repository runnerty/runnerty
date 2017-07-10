# processes

In Runnerty, processes are calls to the executors. The executors are plugins which encapsulate functionalities. Know more about [executors].

There is a bunch of executors with different functionalities, have a look at the official [list].

One of the most important executors could be the shell executor ([@runnerty/executor-shell]). As it is the Command-Line Interface, with this plugin is possible to execute existing processes that you may already have.

### Identification

Each process has two identification fields: ```id``` and ```name```

```id``` is the unique identification string of the process.
```name``` is a drescription of the process

```json
"processes": [
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain"
    }
],
```

### dependencies

Like in the chains, it is possible to idicate that one process depends from another or various processes.

```json
"processes": [
    {
      "id": "PROCESS_TWO",
      "name": "Second process of the chain",
      "depends_process": ["PROCESS_ONE"],
    }
]
```

### depends_conditions

It is also possible to indicate dependencies using conditional operations. 

```json
"processes": [
    {
      "id": "PROCESS_TWO",
      "name": "Second process of the chain",
      "depends_process":[{"evaluate":[{"oper_left":":MY_VALUE","condition":">=","oper_right":"1"}]}],
    }
]
```

In oper_left and oper_right we can use values comming from the output of other process or chain, values defined in global_values in the conf.json or values defined in the custom_values of the chain.

These are the different conditions that can be used: ```"==", "!=", ">=", "<="```

### exec

In the exec property are the fields that identifie the executor that is going to be used and the params needed. 

```json
"processes":[
    {
      "id":"PROCESS_ONE",
      "name":"First process of the chain",
      "exec":
        {
          "id":"shell_default",
          "command":"echo 'Hello world'",
        }
    }
  ]
```
In this example we are using our shell_default executor, the configuration for this executor should be in our conf.json file:

```json
{
  "executors": [
    {
      "id": "shell_default",
      "type": "@runnerty/executor-shell"
    }
  ]
}
```

With the ```id``` field we are indicating the executor that we are going tov use. The rest of the fields are params for the executor. Know more about the executors and their usage in [executors] doc. Yo can also chekc the [conf] documentation to know how to configure them.

### events

With the events property Runnerty can access to the differnt states of the process: ```"on_start", "on_fail", "on_retry" and "on_end"```.

In this events we can notify anything on a state of the process using a notificator. know mor about [notificators].

This is an example of the events of a process using the Telegram notificator to notify the different states of the process to a Telegram chat:

```json
{
  "id":"PROCESS_ONE",
  "name":"First process of the chain",
  "exec":
    {
      "id":"shell_default",
      "command":"echo 'Hello world'",
    },
  "events": {
    "on_start": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE PROCESS :PROCESS_ID HAS STARTED"
        }
      ]
    },
    "on_fail": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE PROCESS :PROCESS_ID HAS FAILED"
        }
      ]
    },
    "on_end": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE PROCESS :PROCESS_ID HAS FINISHED"
        }
      ]
    }
  }
  ...
}
```
Note that in the example it is used the global value :PROCESS_ID, this value will have the id of the process. Know more about [global_values].

### output

Another property of ther processes is that we can reditrect the output of a procces to a file. 

```json
{
  "id":"PROCESS_ONE",
  	"name":"First process of the chain",
    "exec":
      {
        "id":"shell_default",
        "command":"echo 'Hello world'",
      },
  "output": [{
			"file_name":"/var/log/runnerty/general.log", 
			"write":["EXECUTION *:PROCESS_ID* :DD-:MM-:YY :HH::mm::ss\n"], 
			"concat":true, 
			"maxsize":"1mb"
			}]
}
```
Runnerty also provide some options to manage logs. Using the property ```concat``` we can indicate runnerty if we want to concatente the output or overwrite it. 

With the maxsize option we indicate Runnerty the maximun size that the log's file could have. Runnerty will automatically delete the firt lines of the file when it is full and needs to continue writting.

### output_share

The output_share property it is used to define values from the output of a process. Theses values area availables for the rest of the procesess of the chain.

For example:

```json
{
	"processes":[
    {
      "id":"GET-USER-EMAIL",
      "name":"it get an user email",
      "exec":
        { "id":"mysql_default",
          "command": "SELECT email FROM USERS WHERE ID = 1"
        },
      "output_share":[{"key":"USER","name":"EMAIL","value":":PROCESS_EXEC_RETURN"}]
    }
  ]
}
```
In this example we are getting the email of an user from the database using the @runnerty/executor_mysql and assigning it to a value. This way we can use the ```:USER_EMAIL``` value anywhere of the chain.

Note that in this example we are are using the value ```:PROCESS_EXEC_RETURN``` This is a global_value that contains the return of the process. Have a look at the [global_values] documentation.

### output iterable

The output_iterable property it's used to iterate a chain depending of the output of a process. An iterale chain is a chain that is going to be executed for each object of the array returned by a process. For example, if we have a process which returns an objects array we can execute an iterable chain for each object of the array.

You can have a lo at the [chains] documentation to see an usage example.

[list]: https://github.com/Coderty/runnerty/blob/master/docs/plugins.md
[executors]: https://github.com/Coderty/runnerty/blob/master/docs/executors.md
[@runnerty/executor-shell]: https://github.com/Coderty/runnerty-executor-shell
[conf]: https://github.com/Coderty/runnerty/blob/master/docs/conf.md
[notificators]: https://github.com/Coderty/runnerty/blob/master/docs/notificators.md
[global_values]: https://github.com/Coderty/runnerty/blob/master/docs/global_values.md
[chains]: https://github.com/Coderty/runnerty/blob/master/docs/chains.md