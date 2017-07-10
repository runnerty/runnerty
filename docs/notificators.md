# notificators

The notificators are plugins for Runnerty used for notifying events occurred in the processes or chains. 

There are a bunch of notificators for different channels. You can have a look at the list of the official [executors].

### configuration

In the conf.json file of the project we are going to write the configuration of the different notificators that are going to be used in the processes.

```json
{
  "notificators": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notificator-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    },
    {
      "id": "mail_default",
      "type": "@runnerty/notificator-mail",
      "disable": false,
      "from": "Runnerty Notificator <my@sender.com>",
      "transport": "smtp://my%mailsender.com:pass@smtp.host.com/?pool=true",
      "bcc":["mycc@mail.com"],
      "templateDir": "/etc/runnerty/templates",
      "template": "alerts",
      "ejsRender": true
    }
  ]
}
```

This is an example of the configuration of two notificator: ```@runnerty/notificator-telegram``` and ```@runnerty/notificator-mail```. Each notificator has it's owns properties, some of them are mandatory, you can have a look at each notificator documentation to know how to use them.

### usage

The destination of a notificator is to use it in our plan's processes to comunicate events. We could say that using an executor has two parts: ```configuration``` and ```params```.

 The configuration properties are set in the conf.json. They are the identifiers fields of the notificator. For example, this is the configuration properties for the @runnerty/executor-telegram:

```json
{
  "notificators": [
    {
      "id": "telegram_default",
      "type": "@runnerty/notificator-telegram",
      "token": "MyTokenId",
      "chat_id": "MyChatId"
    },
  ]
}
```

The ```id``` is the name given for the executor configuration. Note that we could have all the differents configuratios that we want for the same executor. The ```type``` is the name of the executor. The ```token``` and ```chat_id``` and configuration properties needed for the executor to work properly. 

In the processes are set the variable properties (params) of the notificator. This is an example of the usage of the @runnerty/executor-telegram in a process

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
    "on_end": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE PROCESS HAS FINISHED"
        }
      ]
    }
  }
}
```

Runnerty matchs the ```id``` property from the plan with the conf.json one to identify the notificator to run. the ```message``` field is the variable property that may change in every process.

It is important to know that it is possible to overwrite some configuration properties IN THE processes. For example: if we want to change the token and chat_id of the notification depending of the event:

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
    "on_fail":{
        "notifications": [
        {
          "id": "telegram_default",
          "token": "MyDangerTokenId",
          "chat_id": "MyDangerChatId",
          "message": "THE PROCESS HAS ABORTED"
        }
      ]
    },
    "on_end": {
      "notifications": [
        {
          "id": "telegram_default",
          "message": "THE PROCESS HAS FINISHED"
        }
      ]
    }
  }
}
```

Note that when the process ends with fail it will overwrite the ```token``` and ```chat_id``` properties of the conf.json and it will send the message to a different chat.


[executors]: https://github.com/Coderty/runnerty/blob/master/docs/executors.md