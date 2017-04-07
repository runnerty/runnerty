# Mail executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "mail_default",
  "type": "runnerty-executor-mail",
  "disable": false,
  "from": "Runnerty Notificator <my@sender.com>",
  "transport": "smtp://my%mailsender.com:pass@smtp.host.com/?pool=true",
  "bcc":["mycc@mail.com"],
  "templateDir": "/etc/runnerty/templates",
  "template": "alerts",
  "ejsRender": true
}
```

### Plan sample:
```json
{ "id":"mail_default",  
  "to": ["my@mail.com"],
  "title": "Runnerty Mailer",
  "message": "My message from Runnerty!",
  "attachments": [{
    "filename": "sample.png",
    "path": "/etc/runnerty/templates/alerts/images/sample.png",
    "cid": "img_name@sample.png"
   }]
}
```


[Runnerty]: http://www.runnerty.io