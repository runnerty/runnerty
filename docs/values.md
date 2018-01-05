# Values

Runnerty provides a bunch of different values that can be used in the whole plan of our chains by using the @GV/@GETVALUE function. They can be global or local values. Runnerty will automatically replace this variables with it's value. They are very useful to store params, save output values from the processes, making processes evaluations, etc... 

## Global values

These values are called `global` because they are automatically provided by Runnerty or defined in the config. Thereby, they can be used in the plan. 

### Environment values
These values allows you to get environment variables.
##### Sample if you define environment variable: export MYENVVAL=TESTVALUE
```
ENV_[ENVIRONMENT VARIABLE NAME] > @GV(ENV_MYENVVAL) = TESTVALUE
```

### Config values

In the `config.json` file it is possible to define our owns values to use them in our chains. This is an example of the `config.json` file with some values definitions:

```json
{
    "executors": [
      {"...":"..."}
    ],
    "notificators": [
      {"...":"..."}
    ],
    "global_values": [
      {
        "my_files": {
          "file_one":"/path/MYFILE_ONE.csv",
          "file_one":"/path/MYFILE_TWO.csv"
        },
        "my_values":{
          "value_one":"VALUE_ONE",
          "value_two":"VALUE_TWO"
        }
      }
    ]
  }
```


## Local values

They are called local because these values come from different parts of the plan. They take their values from different Runnerty changeable sources such as the processes or chains information.


### Process values 

Theses values are formed with the process information and configuration. For example, these two values takes it's value from the metadata of the process:

```
CHAIN_ID                       - Contains the process chain id
CHAIN_NAME                     - Contains the process chain name
CHAIN_STARTED_AT               - Contains the date and time when the process chain started
PROCESS_ID                     - Contains the process id
PROCESS_NAME                   - Contains the process name
```

This is an example of a process using the time and process values to write in a log file:

```json
{
  "id":"PROCESS_ONE",
    "name":"First process of the chain",
    "exec": {
      "id":"shell_default",
      "command":"echo 'Hello world'"
      },
  "output": [{
    "file_name":"/var/log/runnerty/general.log", 
    "write":["EXECUTION @GV(PROCESS_ID) - @GV(PROCESS_NAME) - AT @GETDATE('YYYY-MM-DD HH:mm:ss')\n"],
    "concat":true, 
    "maxsize":"1mb"
    }]
}
```

These are the rest of the values that takes information from the process execution. Once again, they can be used in the whole plan:


```
PROCESS_EXEC_ID                - Contains the execution id
PROCESS_EXEC_COMMAND           - Contains the command that is going to be executed by the executor
PROCESS_EXEC_COMMAND_EXECUTED  - Contains the command executed by the executor (once all the values have been translated)
PROCESS_EXEC_MSG_OUTPUT        - Contains the output message of the executor
PROCESS_EXEC_DATA_OUTPUT       - Contains the data output of the executor
PROCESS_EXEC_ERR_OUTPUT        - Contains the error returned by the executor
PROCESS_STARTED_AT             - Contains the date and time when the process started
PROCESS_ENDED_AT               - Contains the date and time when the process ended
PROCESS_DURATION_SECONDS       - Contains the duration in seconds (when is end).
PROCESS_DURATION_HUMANIZED     - Contains the humanized duration (when is end).
PROCESS_RETRIES_COUNT          - Contains the times that the process have been retried
```

In this example we can see a process that in the notification use some of the process values to send useful information:

```json
{
  "id":"PROCESS_ONE",
  "name":"First process of the chain",
  "exec":
    {
      "id":"shell_default",
      "command":"echo 'Hello world'"
    },
  "notifications": {
    "on_start": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS @GV(PROCESS_ID) HAS STARTED AT @GV(PROCESS_STARTED_AT)"
      }
      ],
    "on_fail": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS @GV(PROCESS_ID) HAS FAILED AT @GV(PROCESS_STARTED_AT) - THE EXECUTED COMMAND WAS @GV(PROCESS_COMMAND_EXECUTED)  - THE ERROR WAS @GV(PROCESS_EXEC_ERR_OUTPUT)"
      }
      ],
    "on_end": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS @GV(PROCESS_ID) HAS FINISHED AT @GV(PROCESS_ENDED_AT)"
      }
      ]
  }
}
```

### output_share

The output_share is a property of the process. This feature allows to share information returned by the process so it is available in the rest of the chain.

```json
{
  "processes":[
    {
      "id": "GET-USER-EMAIL",
      "name": "It get an user email",
      "exec":
        { 
          "id": "mysql_default",
          "command": "SELECT email FROM USERS WHERE ID = 1"
        },
      "output_share": [{"key":"USER","name":"EMAIL","value":"@GV(PROCESS_EXEC_DB_FIRSTROW_EMAIL)"}]
    }
  ]
}
```

In this example we are getting the email of an user from the database using the `@runnerty/executor_mysql` and assigning it to a value. This way we can use the `@GV(USER_EMAIL)` value anywhere of the chain.

Notice that in this example we are are using the value `@GV(PROCESS_EXEC_DB_FIRSTROW_EMAIL)` This is an extra value returned by this executor that contains the field selected by the query.


### Chain values 

Just like the process values, there are also some values formed with the chain information: 

```
CHAIN_ID                 - Contains the ID of the chain
CNAIN_NAME               - Contains the name of the chain
CHAIN_STARTED_AT         - Contains the date and time when the chain started
CHAIN_DURATION_SECONDS   - Contains the duration in seconds (when is end).
CHAIN_DURATION_HUMANIZED - Contains the humanized duration (when is end).  
```


### Custom values

This values can be defined in our chains and can be used in the whole plan of the chain. This is also very useful when you want to overwrite a value defined in the `config.json` file:

```json
{
  "id":"CHAIN_ONE",
  "name":"Example chain",
  "custom_values":{"MY_VALUE":"MY_VALUE"}
}
```

Notice that this values can be also past from the API. 


### Input values

This values cames from the output of an iterable chain. An iterable chain is an awasome feature of runnerty that allows you to be execute a chain for each object in the array previously returned by another chain.

You can know for more information about iterable chains in the chains [here](chains.md). 

```json
{
  "id": "SEND-MAIL-TO-USERS",
  "name": "it sends an email to the users returned",
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  },
  "iterable": "parallel",
  "input": [
    {
      "email": "email"
    },
    {
      "name": "name"
    }
  ],
  "processes": [
    {
      "id": "SEND-MAIL",
      "name": "sends the email to the user",
      "exec": {
        "id": "mail_default",
        "to": [
          "@GV(email)"
        ],
        "message": "Hello @GV(name)",
        "title": "Message set by Runnerty"
      },
      "end_chain_on_fail": true
    }
  ]
}
```

In this example we can see how the chain is receiving two input fields and the process is using their values to send an email.


### Executors extra values

As the executors are plugins for Runnerty, it is possible that some of them need to return additional information to Runnerty. For this task Runnerty provides the `EXTRA_OUTPUT` values that can be used by the executors. Know more about this in the executors development documentation.
