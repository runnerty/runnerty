# Notifiers

The notifiers are plugins for Runnerty used for notifying occurred in the processes or chains. 

There are a bunch of notifiers for different channels. You can have a look at the official list [here](executors.md).

### Configuration

In the [config.json](config.md) file of the project we are going to write the configuration of the different notifiers that are going to be used in the processes.

```json
{
  "notifiers": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notifier-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    },
    {
      "id": "mail_default",
      "type": "@runnerty/notifier-mail",
      "disable": false,
      "from": "Runnerty Notifier <my@sender.com>",
      "transport": "smtp://my%mailsender.com:pass@smtp.host.com/?pool=true",
      "bcc":["mycc@mail.com"],
      "templateDir": "/etc/runnerty/templates",
      "template": "alerts",
      "ejsRender": true
    }
  ]
}
```

This is an example of the configuration of two notifier: `@runnerty/notifier-telegram` and `@runnerty/notifier-mail`. Each notifier has it's owns properties, some of them are mandatory, you can have a look at each notifier documentation to know how to use them.

### Usage

The destination of a notifier is to use it in our plan's processes to communicate notifications. We could say that using an executor has two parts: `configuration` and `params`.

 The configuration properties are set in the [config.json](config.md). They are the identifiers fields of the notifier. For example, this is the configuration properties for the @runnerty/executor-telegram:

```json
{
  "notifiers": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notifier-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    }
  ]
}
```

The `id` is the name given for the executor configuration. Note that we could have all the differents configurations that we want for the same executor. The `type` is the name of the executor. The `token` and `chat_id` and configuration properties needed for the executor to work properly. 

In the processes are set the variable properties (params) of the notifier. This is an example of the usage of the @runnerty/executor-telegram in a process

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
    "on_end":[
      {
        "id": "telegram_default",
        "message": "THE PROCESS HAS FINISHED"
      }
    ]
  }
}
```

Runnerty matchs the `id` property from the plan with the [config.json](config.md) one to identify the notifier to run. the `message` field is the variable property that may change in every process.

It is important to know that it is possible to overwrite some configuration properties IN THE processes. For example: if we want to change the token and chat_id of the notification depending of the event:

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
    "on_fail":[
      {
        "id": "telegram_default",
        "token": "MyDangerTokenId",
        "chat_id": "MyDangerChatId",
        "message": "THE PROCESS HAS ABORTED"
      }
    ],
    "on_end":[
      {
        "id": "telegram_default",
        "message": "THE PROCESS HAS FINISHED"
      }
    ]
  }
}
```

Note that when the process ends with fail it will overwrite the `token` and `chat_id` properties of the [config.json](config.md) and it will send the message to a different chat.
