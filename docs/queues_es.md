# Queues (Colas)

El uso de colas tiene como fin evitar la ejecución en paralelo de cadenas y/o procesos que se decida que no puedan ejecutarse al mismo tiempo por cualquier motivo, además nos permite decidir en que orden se ejecutarán mediante el uso de prioridades.


Por ejemplo: Si tenemos varios procesos o cadenas que operan sobre en un mismo fichero (fichero_uno.txt) podemos asignar la cola "fichero_uno" a todos ellos para evitar que se produzcan ejecuciones en paralelo.


### Configuración

En el fichero config.json del proyecto vamos a escribir la configuración de colas en el que podemos indicar el tiempo de refresco de colas en milisegundos.

```json
{
  "queues":{
    "refreshInterval":5000
  }
}
```

### Uso
Tanto en cadenas como en procesos se debe indicar el identificador de la cadena (Cadena alfanumerica) y la prioridad (opcional - entero)

En una cadena:
```json
{
  "id": "EXAMPLE_CHAIN",
  "name": "Name of the sample chain",
  "queue": "queue_sample",
  "priority": 10,
  "...":"..."
}
```

En un proceso:
```json
{
  "processes":[
      {
        "id": "EXAMPLE_PROCESS",
        "name": "Example process",
        "queue": "queue_sample",
        "priority": 5,
        "...":"..."
      }
    ]
}
```
```