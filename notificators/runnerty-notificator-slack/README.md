Slack notificator for [Runnerty]:
Runnerty module: Slack notificator

Configuration sample:
```json
  {
    "id": "slack_default",
    "type": "runnerty-notificator-slack",
    "webhookurl":"https://hooks.slack.com/services/ABC123/ABC123/ABC123",
    "bot_name": "Runnerty-Sentinel",
    "channel": "my_runnerty_channel",
    "maxConcurrents": 1,
    "minInterval": 600
  }
```

Plan sample:
```json
  {
    "id":"slack_default",
    "bot_emoji": ":metal:",
    "channel": "my_runnerty_channel",
    "message":"PROCESS *:PROCESS_ID* OF CHAIN :CHAIN_ID RUNNING!"
  }
```


[Runnerty]: http://www.runnerty.io