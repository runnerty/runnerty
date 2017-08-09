# dependencies

Runnerty provides a powerful feature to establish dependencies between processes. Not only it is possible to set up dependencies to other processes end states. You can also use operators to evaluate values, add complex conditions using operators and multiple expressions.


## process dependencies

It is very easy to establish dependencies between processes using the property ```"depends_process"``` in our processes. If you want to know how to configure and use processes in your chains, please click [here](process.md).

We can set up a dependencie to other process end state using ```"$end"```  and ```"$fail"``` operators:

In the example below ```PROCESS_B``` will start when ```PROCESS_A``` ends:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {"$end": "PROCESS_A"},
  "...": "..."
}
```
Note than we can simplify this action just by adding ```"depends_process": ["PROCESS_A"]```

In this example ```PROCESS_B``` will start if ```PROCESS_A``` fails:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {"$fail": "PROCESS_A"},
  "...": "..."
}
```

### operators

It is possible to add operators to the dependencies if we need to evaluate more than one process:

Dependencies of two processes:

```json
{
  "id": "PROCESS_C",
  "name": "Second process of the chain",
  "depends_process": {"$and": [{"$end": "PROCESS_A"},{"$end": "PROCESS_B"}]},
  "...": "..."
}
```
Note than we can simplify this action just by adding ```"depends_process": ["PROCESS_A","PROCESS_B"]```

### complex dependencies:

Using operatios Runnerty offers the possibility to add complex dependencies between our processes. 

In this example process E will start only if process A or B fails and process C and D end:

```json
{
  "id": "PROCESS_E",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
      {
        "$or": [
          {"$fail": "PROCESS_A"},
          {"$fail": "PROCESS_B"}
        ]
      }
    ],
    "$and": [
      {"$end": "PROCESS_C"},
      {"$end": "PROCESS_D"}
    ]
  }
}
```

## evaluations

With Runnerty we can also establish dependencies of an evaluation using values from our processes or chains. If you want to know more about the usage of values in Runnerty, please click [here](values.md).

### conditions

```
$eq    - equal
$gt    - greater than 
$gte   - greater than equal. Exmaple: {2:{"$gte":1}
$lt    - less than
$lte   - less than equal
$ne    - not equal
$in    - in the list. Example: {"A":{"$in":["Z","X","A","O"]}}
$nin   - not in the list. Example: {"A":{"$nin":["Z","X","Y","O"]}}
$match - supports regular expressions. Example: "depends_process":{"$and":[{"aBc":{"$match":"/ABC/i"}}]}
```

This is an example of how to use conditions in the dependencies of a proecess:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
        {"VAL_1": {"$eq": "VAL_2"}},
        {"VAL_2": {"$gte": "VAL_3"}}
      ]
    }
}
```

Moreover, we can use the conditions however we want in the ```"depends_process"``` property and create complex evaluations:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
      "$and": [
        {"$or": [
            {"VAL_1": {"$eq": "VAL_2"}},
            {"VAL_1": {"$eq": "VAL_3"}}
          ]
        },
        {"$or": [
            {"VAL_2": {"$gte": "VAL_4"}},
            {"VAL_2": {"$gte": "VAL_5"}}
          ]
        },
        {"$and": [
            {"VAL_3": {"$eq": "VAL_6"}},
            {"VAL_4": {"$eq": "VAL_7"}}
          ]
        }
      ]
    }
}
```

## multiple expressions

At this point, you probably imagine that it is also posible to mix dependencies with other processes states and values evaluations. This is a simple example of how to do that:

```json
{
  "id": "PROCESS_B",
  "name": "Second process of the chain",
  "depends_process": {
    "$and": [
      {"$end": "PROCESS_A"}, 
      {"$and": [
          {"$or":[
              {"VAL1":{"$eq":"VAL1"}},
              {"VAL1":{"$eq":"VAL3"}}
            ]
          },
          {"$or":[
              {"VAL4":{"$ne":"VAL4"}},
              {"VAL4":{"$ne":"VAL5"}}
            ]
          }
        ]
      }
    ]
  }
}
```

