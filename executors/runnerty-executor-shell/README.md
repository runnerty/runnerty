# Shell executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "shell_default",
  "type": "runnerty-executor-shell"
}
```

### Plan sample:
```json
{
  "id":"shell_default",
  "command":"tar cvfz /var/backups/stf.tar /var/stranger_things/"
}
```

```json
{
  "id":"shell_default",
  "command":"python",
  "args":["myscript.py","hello"]
}
```

```json
{
  "id":"shell_default",
  "command":"echo",
  "args":["hello world"]
}
```


[Runnerty]: http://www.runnerty.io