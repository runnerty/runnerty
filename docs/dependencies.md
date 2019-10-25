# Dependencies

Runnerty provides a powerful feature to establish dependencies between processes. Not only it is possible to set up dependencies to other processes end states. You can also use operators to evaluate values, add complex conditions using operators and multiple expressions.

## Process dependencies

It is very easy to establish dependencies between processes using the property `"depends_process"` in our processes. If you want to know how to configure and use processes in your chains, please click [here](process.md).

We can set up a dependencie to other process end state using `"$end"` and `"$fail"` operators:

In the example below `PROCESS_B` will start when `PROCESS_A` ends:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": { "$end": "PROCESS_A" },
  "...": "..."
}
```

Note than we can simplify this action just by adding `"depends_process": ["PROCESS_A"]`

In this example `PROCESS_B` will start if `PROCESS_A` fails:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": { "$fail": "PROCESS_A" },
  "...": "..."
}
```

### Operators

It is possible to add operators to the dependencies if we need to evaluate more than one process:

Dependencies of two processes:

```json
{
  "id": "PROCESS_C",
  "name": "Second process of the chain",
  "depends_process": { "$and": [{ "$end": "PROCESS_A" }, { "$end": "PROCESS_B" }] },
  "...": "..."
}
```

Note than we can simplify this action just by adding `"depends_process": ["PROCESS_A","PROCESS_B"]`

### Complex dependencies:

Using operatios Runnerty offers the possibility to add complex dependencies between our processes.

In this example process E will start only if process A or B fails and process C and D end:

```json
{
  "id": "PROCESS_E",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
      {
        "$or": [{ "$fail": "PROCESS_A" }, { "$fail": "PROCESS_B" }]
      }
    ],
    "$and": [{ "$end": "PROCESS_C" }, { "$end": "PROCESS_D" }]
  }
}
```

## Evaluations

With Runnerty we can also establish dependencies of an evaluation using values of our processes or chains. If you want to know more about the use of values in Runnerty, click on [here](values.md).

### Evaluators

The structure of the evaluator is {"value 1"; "\$condition": "value 2"}.
Of course in these values you can make use of all the [functions](functions.md).
These are the evaluators you can use:

```
$eq    - equal. Examples: {"VAL_1": {"$eq": "VAL_2"}}, {"@GV(VAR1)": {"$eq": "@GV(VAR2)"}}
$ne    - not equal. Example: {"@UPPER(str_sample)": {"$ne": "@GV(VAR2)"}}
$match - supports regular expressions. Example: {"aBc":{"$match":"/ABC/i"}}
$gt    - greater than. Example: {"@LENGTH(str_sample)": {"$gt": "@GV(VAR_INT_1)"}}
$gte   - greater than equal. Example: {2:{"$gte":1}
$lt    - less than
$lte   - less than equal
$true  - its a boolean evaluator. This evaluator has a special structure: {"$true":"value"}. Examples: {"$true":"@INCLUDES(sample,a)"}, {"$true":"@GT(42, @GV(VAL1))"}
$false - its a boolean evaluator. It works like $true (opposite).
```

These are some examples of how to use evaluators in the dependencies of a process:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {"@GV(V1)": {"$eq": "GO!"}},
  [...]
}
```

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
        {"VAL_1": {"$eq": "VAL_2"}},
        {"42": {"$gte": "1"}}
      ]
    }
  [...]
}
```

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
        {"$end": "PROCESS_A"},
        {"$true": "@INCLUDES(@GV(PROC_A_OUTPUT_DATE), @GETDATE('YYYY-MM-DD'))"}
      ]
    }
  [...]
}
```

Moreover, we can use the conditions however we want in the `"depends_process"` property and create complex evaluations:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
      { "$or": [{ "VAL_1": { "$eq": "VAL_2" } }, { "VAL_1": { "$eq": "VAL_3" } }] },
      { "$or": [{ "VAL_2": { "$gte": "VAL_4" } }, { "VAL_2": { "$gte": "VAL_5" } }] },
      { "$and": [{ "VAL_3": { "$eq": "VAL_6" } }, { "VAL_4": { "$eq": "VAL_7" } }] }
    ]
  }
}
```

## Multiple expressions

At this point, you probably imagine that it is also possible to mix dependencies with other processes states and values evaluations. This is a simple example of how to do that:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
      { "$end": "PROCESS_A" },
      {
        "$and": [
          { "$or": [{ "VAL1": { "$eq": "VAL1" } }, { "VAL1": { "$eq": "VAL3" } }] },
          { "$or": [{ "VAL4": { "$ne": "VAL4" } }, { "VAL4": { "$ne": "VAL5" } }] }
        ]
      }
    ]
  }
}
```
