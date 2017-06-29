# processes

In Runnerty, processes are calls to the executors. The executors are plugins which encapsulate functionalities. Know more about [executors]

There is a bunch of executors with different functionalities, have a look at the official [list].

One of the most important executors could be the shell executor ([@runnerty/executor-shell]). As it is the Command-Line Interface, with this plugin is possible to execute existing processes that you may already have.

### Identification

Each process has two identification fields: ```id``` and ```name```

```íd``` is the unique identification string of the process.
```name``` is a drescription of ther process

```
"processes": [
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain"
    }
],
```

### dependencies

Like in the chains it is possible to idicate that one processes depends from another or various processes.

```
"processes": [
    {
      "id": "PROCESS_ONE",
      "name": "First process of the chain",
      "depends_process": [],
    }
],
```

### operators 

It is also possible to indicate dependencies using conditional operations:

ejemplo

### exec

### events

### output
    mensaje, maxsize, contact
### output share

### output iterable

[list]: https://github.com/Coderty/runnerty/blob/master/docs/plugins.md
[executors]: https://github.com/Coderty/runnerty/blob/master/docs/executors.md
[@runnerty/executor-shell]: https://github.com/Coderty/runnerty-executor-shell