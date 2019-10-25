# Queues

The usage of queues is recommended to avoid parallel executions of chains or processes that can run at the same time for any reason. In addition, it allows us to establish the execution order unsing priorities

For example: If we have several processes or chains that works with the same file (file_one.txt) it is possible to assign the queue "file_one" to all of them, this way, parallel executions will be avoided.

### Configutarion

In the config.json file can be configured the refresh interval of the queues. It is indicated in milliseconds.

```json
{
  "queues": {
    "refreshInterval": 5000
  }
}
```

### Usage

Both in chais and processes we have to indicate the identifier of the chain (alphanumeric) and the priority (optional - integer)

In the chain:

```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain",
  "queue": "queue_sample",
  "priority": 10,
  "...": "..."
}
```

In a process:

```json
{
  "processes": [
    {
      "id": "EXAMPLE_PROCESS",
      "name": "Example process",
      "queue": "queue_sample",
      "priority": 5,
      "...": "..."
    }
  ]
}
```
