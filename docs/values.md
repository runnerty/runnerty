# values

Runnerty provides a bunch of different values that can be used in the whole plan of our chains. They can be global or local values. Runnerty will automatically replace this variables with it's value. They are very useful to store params, save output values from the processes, making processes evaluations, etc... 


## global values

These values are called ```global``` because they are automatically provided by Runnerty or defined in the config. Thereby, they can be used in the plan. 


### time values

These values contain time values, this is the list of the time values provided by Runnerty:

```
YY   - Last two digits of the current year
YYYY - Current year
MM   - Current month
WW   - Current week number
DD   - Current day
HH   - Current hour
mm   - Current minute
ss   - Current second
```
##### Sample current year: 2017
##### Sample current month: DECEMBER
##### Sample current week day: THURSDAY
```
MMMM_[LANGUAGE_INITIALS] > :MMMM_EN = DECEMBER, :MMMM_ES = DICIEMBRE
MMM_[LANGUAGE_INITIALS]  > :MMM_EN  = DEC,      :MMM_ES = DIC.
DDDD_[LANGUAGE_INITIALS] > :DDDD_EN = THURSDAY, :DDDD_ES = JUEVES 
DDD_[LANGUAGE_INITIALS]  > :DDD_EN  = THU,      :DDD_ES = JUE.
```
```
YYYY_[INCREMENT] > :YYYY_1 = 2018,    :YYYY_-2 = 2015
YY_[INCREMENT]   > :YY_1   = 18,      :YY_-2   = 15
MMMM_[INCREMENT] > :MMMM_1 = JANUARY, :MMMM_-2 = OCTOBER
MMM_[INCREMENT]  > :MMM_1  = JAN,     :MMM_-2  = OCT
DDDD_[INCREMENT] > :DDDD_1 = FRIDAY,  :DDDD_-2 = TUESDAY 
DDD_[INCREMENT]  > :DDD_1  = FRI,     :DDD_-2  = TUE
```
```
MMMM_[INCREMENT]_[LANGUAGE_INITIALS] > :MMMM_1_EN = JANUARY, :MMMM_-2_ES = OCTUBRE
MMM_[INCREMENT]_[LANGUAGE_INITIALS]  > :MMM_1_EN  = JAN,     :MMM_-2_EN = OCT.
DDDD_[INCREMENT]_[LANGUAGE_INITIALS] > :DDDD_1_EN = FRIDAY,  :DDDD_-2_ES = MARTES 
DDD_[INCREMENT]_[LANGUAGE_INITIALS]  > :DDD_1_EN  = FRI,     :DDD_-2_ES = MAR
```

These values are very useful for example to write the output information of a process in a log file:

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
    "write": ["EXECUTION AT :DD-:MM-:YY :HH::mm::ss"], 
    "concat": true, 
    "maxsize": "1mb"
    }]
}
```

Runnerty will replace ```:DD-:MM-:YYYY :HH::mm::ss``` for it's value: ```31-07-2017 16:00:00```


### config values

In the ```config.json``` file it is possible to define our owns values to use them in our chains. This is an example of the ```config.json``` file with some values definitions:

```json
{
    "executors": [
      ...
    ],
    "notificators": [
      ...
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


## local values

They are called local because these values come from different parts of the plan. They take their values from different Runnerty changeable sources such as the processes or chains information.


### process values 

Theses values are formed with the procces information and configuration. For example, these two values takes it's value from the metadata of the process:

```
PROCESS_ID -- contains the ID of the process
PROCESS_NAME -- contains the name of the process 
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
    "write":["EXECUTION *:PROCESS_ID* *PROCESS_NAME* AT :DD-:MM-:YY :HH::mm::ss\n"], 
    "concat":true, 
    "maxsize":"1mb"
    }]
}
```

These are the rest of the values that takes information from the process execution. Once again, they can be used in the whole plan:


```
PROCESS_COMMAND           - Contains the command that is going to be executed by the executor
PROCESS_ARGS              - Contains the args past to the executors
PROCESS_COMMAND_EXECUTED  - Contains the command executed by the executor (once all the values have been translated)
PROCESS_EXEC_MSG_OUTPUT   - Contains the output message of the executor
PROCESS_EXEC_ERR_RETURN   - Contains the error returned by the executor
PROCESS_STARTED_AT        - Contains the date and time when the process started
PROCESS_ENDED_AT          - Contains the date and time when the process ended
PROCESS_RETRIES_COUNT     - Contains the times that the process have been retried
```

In this example we can see a procces that in the notification use some of the process values to send useful information:

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
        "message": "THE PROCESS :PROCESS_ID HAS STARTED AT :PROCESS_STARTED_AT"
      }
      ],
    "on_fail": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS :PROCESS_ID HAS FAILED AT :PROCESS_STARTED_AT - THE EXECUTED COMMAND WAS :PROCESS_COMMAND_EXECUTED  - THE ERROR WAS :PROCESS_EXEC_ERR_RETURN"
      }
      ],
    "on_end": [
      {
        "id": "telegram_default",
        "message": "THE PROCESS :PROCESS_ID HAS FINISHED AT :PROCESS_ENDED_AT"
      }
      ]
  }
  ...
}
```

### output_share

The output_share is a property of the process. This feature allows to share information returned by the process so it is available in the rest of the chain.

```json
{
  "processes":[
    {
      "id": "GET-USER-EMAIL",
      "name": "it get an user email",
      "exec":
        { 
          "id": "mysql_default",
          "command": "SELECT email FROM USERS WHERE ID = 1"
        },
      "output_share": [{"key":"USER","name":"EMAIL","value":":PROCESS_EXEC_DB_FIRSTROW_EMAIL"}]
    }
  ]
}
```
In this example we are getting the email of an user from the database using the ```@runnerty/executor_mysql``` and assigning it to a value. This way we can use the ```:USER_EMAIL``` value anywhere of the chain.

Notice that in this example we are are using the value ```:PROCESS_EXEC_DB_FIRSTROW_EMAIL``` This is an extra value returned by this executor that contains the field selected by the query.


### chain values 

Just like the process values, there are also some values formed with the chain information: 

```
CHAIN_ID    - Contains the ID of the chain
CNAIN_NAME  - Contains the name of the chain
```


### custom values

This values can be defined in our chains and can be used in the whole plan of the chain. This is also very useful when you want to overwrite a value defined in the ```config.json``` file:

```json
{
  "id":"CHAIN_ONE",
  "name":"Example chain",
  "custom_values":{"MY_VALUE":"MY_VALUE"}
  ...
}
```

Notice that this values can be also past from the API. 


### input values

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
          ":email"
        ],
        "message": "Hello :name",
        "title": "Message set by Runnerty"
      },
      "end_chain_on_fail": true
    }
  ]
}
```
In this example we can see how the chain is receiving two input fields and the process is using their values to send an email.


### executors extra values

As the executors are plugins for Runnerty, it is possible that some of them need to return additional information to Runnerty. For this task Runnerty provides the ```EXTRA_OUTPUT``` values that can be used by the executors. Know more about this in the executors development documentation.
