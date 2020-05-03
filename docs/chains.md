# Chains

A chain is a set of processes with its own properties like scheduling, notifications, dependencies, outputs, etc.

This is an example of a basic chain with one process:

```json
{
  "chains": [
    {
      "id": "EXAMPLE-CHAIN",
      "name": "Sample chain name",
      "triggers": [],
      "depends_chains": [],
      "processes": [
        {
          "id": "PROCESS-ONE",
          "name": "First chain process",
          "exec": {
            "id": "shell_default",
            "command": "echo 'Hello world'"
          }
        }
      ]
    }
  ]
}
```

Runnerty has a default unattended point of view for chains and processes managment. This means that unless you specify a modification propetie for a process or chain it will try to run the next process or the chain until the end. More details below in the action on failed chain section [here](chains.md#Actions-for-a-chain-when-a-process-fails).

### Identification

A chain has two identification fields:

`id` -> Which identifies the chain. With this identifier Runnerty will provide a global value _CHAIN_ID_ that can be used in the whole chain. To learn more about global values have a look [here](values.md).

```json
{
  "id": "EXAMPLE-CHAIN"
}
```

`name` -> It is a description of the chain. Runnerty will also provide the global value _CHAIN_NAME_

```json
{
  "id": "EXAMPLE-CHAIN",
  "name": "Sample chain name"
}
```

### Execution (Triggers)

A chain can be fired by using **_triggers_**. There is a bunch of different triggers, have a look at them and how to use them [here](triggers.md)

### Custom values

It is possible to define and overwrite global values at chain level, setting a **custom_values** attribute:

```json
{
  "id": "EXAMPLE-CHAIN",
  "name": "Sample chain name",
  "custom_values": {
    "YYYY": "1986",
    "MY_LOCAL_CHAIN_VALUE": "ABC"
  }
}
```

### Dependencies

It is possible to define dependencies with other chains or other chains processes. This means than a chain with dependencies will never execute before their dependencies are resolved.

You can define these dependency restrictions through the **depends_chains** property, like in the sample below:

```json
{
  "depends_chains": ["CHAIN-ONE"]
}
```

The chain of the example will not be executed until the chain with _id_ _CHAIN_ONE_ is finished. It is also possible to configure a set of dependencies to one chain's process or more:

```json
{
  "depends_chains": {
    "chain_id": "CHAIN-ONE",
    "process_id": "PROCESS-ONE"
  }
}
```

### Notifications

With the **notifications** property, Runnerty can be set up to emit notifications during the chain status flow, fired up by the following callbacks:

- _on_start_
- _on_fail_
- _on_end_
- _on_retry_
- _on_queue_

In these notifications we could notify anything using **notifiers** plugins.

The following example shows how to set up notifications for the different states of the chain through [_Telegram Notifier_](plugins.md#Notifiers), publishing messages to a previously defined Telegram's chatroom:

```json
{
  "notifications": {
    "on_start": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN @GV(CHAIN_ID) HAS STARTED"
      }
    ],
    "on_fail": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN @GV(CHAIN_ID) HAS FAILED"
      }
    ],
    "on_end": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN @GV(CHAIN_ID) HAS FINISHED"
      }
    ],
    "on_retry": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN @GV(CHAIN_ID) HAS RETRY"
      }
    ],
    "on_queue": [
      {
        "id": "telegram_default",
        "message": "THE CHAIN @GV(CHAIN_ID) HAS QUEUE"
      }
    ]
  }
}
```

> Note the usage of the _global value and function @GV(CHAIN_ID)_ on the previous example. This value will be replaced with the chain's _id_. Learn more about global values [here](config.md) and more about functions [here](functions.md)

Learn more about notifiers and how to configure them [here](notifiers.md).

### Processes

In the **processes** array property we can defined all the processes that are going to be part of the chain.

Learn more about _processes_ and how to configure them [here](process.md).

```json
{
  "processes": [
    {
      "id": "PROCESS-ONE",
      "name": "First chain process",
      "exec": {
        "id": "shell_default",
        "command": "echo 'Hello world'"
      }
    }
  ]
}
```

### Actions for a chain when a process fails

It is possible to define what action (abort or retry) to perform at the chain level in case a process fails. The number of `retries` and delay (`retry_delay`) settings will be set at the chain level.

```json
{
  "id": "CHAIN_SAMPLE",
  "name": "Chain with retries",
  "retries": 1,
  "retry_delay": "1 min",
  "processes": [
    {
      "id": "SAMPLE-PROCESS",
      "...": "...",
      "chain_action_on_fail": "retry"
    }
  ]
}
```



Abort the chain if the process fails (this action ends the chain's flow so no other processes will be executed). It is not necessary to indicate, is the default value:

```json
{
  "...": "...",
  "processes": [
    {
      "id": "SAMPLE-PROCESS",
      "...": "...",
      "chain_action_on_fail": "abort"
    }
  ]
}
```

Also you can skip this option (`chain_action_on_fail`) so though any process failed, the chain will continue while the dependencies between processes are met (by using `depends_process` propertie).


Also, it is possible to indicate in the process that the execution continues even though an error occurs:
```json
{
  "...": "...",
  "processes": [
    {
      "id": "SAMPLE-PROCESS",
      "...": "...",
      "chain_action_on_fail": "continue"
    }
  ]
}
```

This will cause the process error to be reported but the string continue and end without error.
Additionally, it could force the chain to end with an error indicating that the process error is taken into account for the final state of the chain:
```json
{
  "...": "...",
  "processes": [
    {
      "id": "SAMPLE-PROCESS",
      "...": "...",
      "chain_action_on_fail": "continue",
      "ignore_in_final_chain_status": false
    }
  ]
}
```


Delay property understands the following strings:

- `x milliseconds`
- `x millisecond`
- `x msecs`
- `x msec`
- `x ms`
- `x seconds`
- `x second`
- `x secs`
- `x sec`
- `x s`
- `x minutes`
- `x minute`
- `x mins`
- `x min`
- `x m`
- `x hours`
- `x hour`
- `x hrs`
- `x hr`
- `x h`
- `x days`
- `x day`
- `x d`
- `x weeks`
- `x week`
- `x wks`
- `x wk`
- `x w`
- `x years`
- `x year`
- `x yrs`
- `x yr`
- `x y`

The space after the number is optional so you can also write `1ms` instead of `1 ms`. In addition, it also accepts numbers and strings which only includes numbers and we assume that these are always in milliseconds.

_From: [Millisecond module]_(https://github.com/unshiftio/millisecond)

### Iterable chains

An **iterale chain** is a chain that is going to be executed for each object in the array previously returned by another process.

For example, if we have a process which returns _one objects array_ we can execute an iterable chain for each object in the array.

In the following example we are going to send an email to every user of the USERS table.

First, we have the chain get-users-email.json with a process which selects all the users's email:

```json
{
  "id": "GET-USERS-EMAIL",
  "name": "It gets all the user's names to send an email",
  "triggers": [
    {
      "id": "schedule_default",
      "schedule_interval": "1 */1 * * *"
    }
  ],
  "processes": [
    {
      "id": "GET-USER-EMAIL",
      "name": "it gets all the users email from the database",
      "exec": {
        "id": "mysql_default",
        "command": "SELECT email, name FROM USERS"
      },
      "output_iterable": "PROCESS_EXEC_DATA_OUTPUT"
    }
  ]
}
```

Then, we assign the returned resultset by the MySQL SELECT query as an object array with the **PROCESS_EXEC_DATA_OUTPUT** value, as part of the property **output_iterable**. This way we are announcing this process will return an iterable output.

Now we are going to define the iterable chain _"send-mail-to-user"_

```json
{
  "id": "SEND-MAIL-TO-USERS",
  "name": "it sends an email to the users returned",
  "retries": 1,
  "retry_delay": "1 min",
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
        "to": [":email"],
        "message": "Hello :name",
        "title": "Message set by Runnerty"
      },
      "chain_action_on_fail": "retry"
    }
  ]
}
```

Here we can see some properties that the chain needs to iterate. First of all we have the dependencies on the **depends_chains** property. An iterable chain **must depends** on the process from the _"mother chain"_ whom it iterates:

```json
{
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  }
}
```

With the **iterable** property we can choose if we want to iterate over in series or parallel:

```json
{
  "depends_chains": {
    "chain_id": "GET-USERS-EMAIL",
    "process_id": "GET-USER-EMAIL"
  },
  "iterable": "parallel"
}
```

With the **input** property we can assign the properties of each object returned by de mother's process array.

```json
{
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
  "...": "..."
}
```

Now, we can use these values anywhere in our iterable chain:

```json
{
  "processes": [
    {
      "id": "SEND-MAIL",
      "name": "sends the email to the user",
      "exec": {
        "id": "mail_default",
        "to": ["@GV(email)"],
        "message": "Hello :name",
        "title": "Message send by Runnerty"
      }
    }
  ]
}
```

In the example :email will be replaced with the user's email and :name will be replaced with the user's name.

### Default properties for processes

It is possible to define a default value for all the processes in a chain of `notifications`,`output` and `chain_action_on_fail`, depending on the `defaults_processes` property of a chain.

For example:

```json
{
      "id": "CHAIN_SAMPLE",
      "name": "CHAIN_SAMPLE",
      "defaults_processes": {
        "notifications": {
          "on_start": [
            {
              "id": "console_default",
              "message": "PROCESS @GV(PROCESS_ID) START"
            }
          ],
          "on_fail": [
            {
              "id": "console_default",
              "message": "ERR! PROCESS @GV(PROCESS_ID) FAIL: @GV(PROCESS_EXEC_ERR_OUTPUT)"
            }
          ],
          "on_end": [
            {
              "id": "console_default",
              "message": "PROCESS @GV(PROCESS_ID) END"
            }
          ]
        },
        "output": [
          {
            "file_name": "./test.log",
            "write": [
              "@GETDATE('YYYY-MM-DD HH:mm:sS') - @GV(CHAIN_ID)/@GV(PROCESS_ID)/@GV(PROCESS_EXEC_COMMAND_EXECUTED)\n"
            ],
            "concat": true,
            "maxsize": "10mb"
          }
        ],
        "chain_action_on_fail": "abort"
      },
      "processes": [...]
```

It is also possible to overwrite the default values (`defaults_processes`) in each of the processes.
For example, in this case the default value of the `on_start` event of `notifications` is overwritten in the `PROCESS_SAMPLE` process, the rest of the `notifications` values will be those defined by default:

```json
{
      "id": "CHAIN_SAMPLE",
      "name": "CHAIN SAMPLE",
      "defaults_processes": {
        "notifications": {
          "on_start": [
            {
              "id": "console_default",
              "message": "PROCESS @GV(PROCESS_ID) START"
            }
          ],
          "on_fail": [
            {
              "id": "console_default",
              "message": "ERR! PROCESS @GV(PROCESS_ID) FAIL: @GV(PROCESS_EXEC_ERR_OUTPUT)"
            }
          ]
        }
      },
      "processes": [
        {
          "id": "PROCESS_SAMPLE",
          "name": "PROCESS SAMPLE",
          "exec": {
            "id": "shell_default",
            "command": "echo hello world"
          },
          "notifications": {
            "on_start": [
              {
                "id": "console_default",
                "message": "OVERRIDE: PROCESS @GV(PROCESS_ID) START"
              }
            ]
          }
        }]
```
