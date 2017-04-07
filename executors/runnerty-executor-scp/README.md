# SCP executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "scp_default",
  "type": "runnerty-executor-scp"
}
```

### Plan sample:
```json
{
  "id": "scp_default",
  "identityFile": "mykey.pem",
  "localFile": "originfile.txt",
  "remoteFilePath": "/var/remote.txt",
  "remoteUser": "user",
  "remoteHost": "my.host.com"
}
```


[Runnerty]: http://www.runnerty.io