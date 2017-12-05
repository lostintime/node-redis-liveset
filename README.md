Redis LiveSet
=============

A type-safe [Redis Set](https://redis.io/topics/data-types#sets) wrapper 
to keep a Set _eventually_ synchronized across multiple nodes.


## Installation

```$bash
npm install --save redis-liveset
```

## Usage examples

Listening for updates

```$typescript
import { createNumbersLiveSet } from "redis-liveset"
import * as redis from "redis"
import { Set } from "immutable"

const sub = redis.createClient()
const pub = redis.createClient()

const liveSet = createNumbersLiveSet("my-super-channel", pub, sub)

liveSet.subscribe((s: Set<number>) => {
  console.log("Set changed: ", s)
})
```

Changing Set

```$typescript
import { createNumbersLiveSet } from "./index"
import * as redis from "redis"

const sub = redis.createClient()
const pub = redis.createClient()

const liveSet = createNumbersLiveSet("my-super-channel", pub, sub)
liveSet.clear()
liveSet.replaceAll([5,6,7])
liveSet.add(1)
liveSet.addAll([10,11])
liveSet.remove(5)
```

## Contribute

> Perfection is Achieved Not When There Is Nothing More to Add, 
> But When There Is Nothing Left to Take Away

Fork, Contribute, Push, Create pull request, Thanks. 
