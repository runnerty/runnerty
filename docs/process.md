# processes

In Runnerty, processes are calls to the executors. The executors are plugins which encapsulate functionalities. Know more about executors [here](executors.md).

There is a bunch of executors with different functionalities, have a look at the official [here](plugins.md).

One of the most important executors could be the shell executor [@runnerty/executor-shell](https://github.com/Coderty/runnerty-executor-shell). As it is the Command-Line Interface, with this plugin is possible to execute existing processes that you may already have.

### identification

Each process has two identification fields: `id` and `name`

`id` is the unique identification string of the process.
`name` is a drescription of the process

```json
"processes": [
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain"
    }
],
```

### dependencies

With Runnerty is possible to establish dependencies betwwen processes. Runnerty provides a powerful feature for this task. 

In the example below we can see how `PROCESS_ONE` has a dependcien with `PROCESS_TWO`. This way, `PROCESS_TWO` will only start when `PROCESS_ONE` had finished.

```json
"processes": [
    {
      "id": "PROCESS_TWO",
      "name": "Second process of the chain",
      "depends_process": ["PROCESS_ONE"],
    }
]
```

Not only it is possible to set up dependencies to other processes end states. You can also use operators to evaluate values, add complex conditions using operators and multiple expressions.

It is highly recommended to have a look at **dependencies** documentation [here](dependencies.md).

### exec

In the exec property are the fields that identifie the executor that is going to be used and the params needed. 

```json
"processes":[
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain",
      "exec":
        {
          "id": "shell_default",
          "command": "echo 'Hello world'",
        }
    }
  ]
```
In this example we are using our shell_default executor, the configuration for this executor should be in our config.json file:

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

With the `id` field we are indicating the executor that we are going tov use. The rest of the fields are params for the executor. Know more about the executors and their usage in [here](executors.md). You can also chekc the [config](config.md) documentation to know how to configure them.

### notifications

Runnerty also provides a notification system for your workflows. With the notifications property you can have access to the different states of the process: `"on_start", "on_fail", "on_retry" and "on_end"` and use them to send notifications.

For this task, Runnerty uses **notificators**, know more about them [here](notificators.md).

This is an example of usage of notifications in a process. In this case, we are using the Telegram notificator to notify the different states of the process to a Telegram chat:

```json
{
  "id": "PROCESS_ONE",
  "name": "First process of the chain",
  "exec":
    {
      "id": "shell_default",
      "command": "echo 'Hello world'"
    },
  "notifications": {
    "on_start": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS :PROCESS_ID HAS STARTED"
      }
      ],
    "on_fail": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS :PROCESS_ID HAS FAILED"
      }
      ],
    "on_end": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS :PROCESS_ID HAS FINISHED"
      }
      ]
  }
}
```
Note that in the example it is used the global value :PROCESS_ID, this value will have the id of the process. Know more about [global_values].

There is an official list of the available notificators [here](plugins.md).

### output

Another property of ther processes is that we can reditrect the output of a procces to a file. 

```json
{
  "id": "PROCESS_ONE",
  	"name": "First process of the chain",
    "exec":
      {
        "id": "shell_default",
        "command": "echo 'Hello world'"
      },
  "output": [{
			"file_name": "/var/log/runnerty/general.log", 
			"write": ["EXECUTION *:PROCESS_ID* :DD-:MM-:YY :HH::mm::ss\n"], 
			"concat": true, 
			"maxsize": "1mb"
			}]
}
```

Runnerty provides some options to manage logs. Using the property `concat` we can indicate runnerty if we want to concatente the output or overwrite it. 

With the maxsize option we indicate Runnerty the maximun size that the log's file could have. Runnerty will automatically delete the firt lines of the file when it is full and needs to continue writting.

### output_share

The output_share property it is used to define values from the output of a process. Theses values area availables for the rest of the procesess of the chain.

For example:

```json
{
	"processes":[
    {
      "id": "GET-USER-EMAIL",
      "name": "it get an user email",
      "exec":
        { "id": "mysql_default",
          "command": "SELECT email FROM USERS WHERE ID = 1"
        },
      "output_share": [{"key":"USER","name":"EMAIL","value":":PROCESS_EXEC_MSG_OUTPUT"}]
    }
  ]
}
```
In this example we are getting the email of an user from the database using the @runnerty/executor_mysql and assigning it to a value. This way we can use the `:USER_EMAIL` value anywhere of the chain.

Note that in this example we are are using the value `:PROCESS_EXEC_MSG_OUTPUT` This is a global_value that contains the return of the process. Have a look at the [values](values.md) documentation.

### output_iterable

The output_iterable property it's used to iterate a chain depending of the output of a process. An iterale chain is a chain that is going to be executed for each object of the array returned by a process. For example, if we have a process which returns an objects array we can execute an iterable chain for each object of the array.

You can have a look at the [chains](chains.md) documentation to see an usage example.
