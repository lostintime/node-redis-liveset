/*
 * Copyright (c) 2017 by The LiveSet Project Developers.
 * Some rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { apply, isLiveSetOp, LiveSetOp, ReplaceAll } from "./operations"
import * as redis from "redis"
import {
  caseDefault, caseWhen, hasFields, isArrayOf, isString, isValue, match, matchWith,
  TypeMatcher
} from "typematcher"
import { Set } from "immutable"
import { AnyAction, createStore, Store } from "redux"

namespace FanDir {
  /**
   * Wraps Set operations to be applied locally
   */
  export type FanIn<T> = {
    _tag: "FanIn"
    value: T
  }

  /**
   * Wraps Set operations to be sent to redis
   */
  export type FanOut<T> = {
    _tag: "FanOut"
    value: T
  }

  /**
   * FanIn<T> type matcher
   */
  export function isFanIn<T>(tMatcher: TypeMatcher<T>): (value: any) => value is FanIn<T> {
    return hasFields({
      _tag: isValue<"FanIn">("FanIn"),
      value: tMatcher
    })
  }

  /**
   * FanOut<T> type matcher
   * @param {TypeMatcher<T>} tMatcher
   * @returns {(value: any) => value is FanDir.FanOut<T>}
   */
  export function isFanOut<T>(tMatcher: TypeMatcher<T>): (value: any) => value is FanOut<T> {
    return hasFields({
      _tag: isValue<"FanOut">("FanOut"),
      value: tMatcher
    })
  }
}

type FanDir<T> = FanDir.FanIn<T> | FanDir.FanOut<T>

function FanIn<T>(value: T): FanDir.FanIn<T> {
  return {
    _tag: "FanIn",
    value: value
  }
}

function FanOut<T>(value: T): FanDir.FanOut<T> {
  return {
    _tag: "FanOut",
    value: value
  }
}

/**
 * Create redux store connected to redis
 */
export function createLiveStore<T>(key: string,
                                   typeMatcher: TypeMatcher<T>,
                                   pub: redis.RedisClient,
                                   sub: redis.RedisClient,
                                   updatesChan: string = key): Store<Set<T>> {
  const isOp: (value: any) => value is LiveSetOp<T> = isLiveSetOp(typeMatcher)
  const isFanOut: (value: any) => value is FanDir.FanOut<LiveSetOp<T>> = FanDir.isFanOut(isOp)
  const isFanIn: (value: any) => value is FanDir.FanIn<LiveSetOp<T>> = FanDir.isFanIn(isOp)

  function storeAction<U>(action: FanDir.FanIn<U> | FanDir.FanOut<U>): AnyAction {
    return { type: action }
  }

  // connection states
  let pubIsUp: boolean = false
  let subIsUp: boolean = false

  const failEvents = ["reconnecting", "error", "end"]

  failEvents.forEach(event => {
    pub.on(event, () => {
      pubIsUp = false // pub disconnected, going to buffer ops
    })
    sub.on(event, () => {
      subIsUp = false
    })
  })

  let fanOutBuffer: LiveSetOp<T>[] = []

  function flushFanOutBuffer(): void {
    const buff = fanOutBuffer
    fanOutBuffer = []
    buff.forEach((op) => {
      store.dispatch(storeAction(FanOut(op)))
    })
  }

  pub.on("ready", () => {
    pubIsUp = true
    flushFanOutBuffer()
  })

  function fanOut(op: LiveSetOp<T>): void {
    if (pubIsUp) {
      if (fanOutBuffer.length > 0) {
        flushFanOutBuffer()
      }
      switch (op._tag) {
        case "Add":
          pub.sadd(key, [JSON.stringify(op.value)])
          break
        case "Remove":
          pub.srem(key, [JSON.stringify(op.value)])
          break
        case "Clear":
          pub.del(key)
          break
        case "AddAll":
          pub.sadd(key, op.values.map(v => JSON.stringify(v)))
          break
        case "ReplaceAll":
          pub.multi()
            .del(key)
            .sadd(key, op.values.map(v => JSON.stringify(v)))
            .exec()
          break
      }
      pub.publish(updatesChan, JSON.stringify(op))
    } else {
      fanOutBuffer.push(op)
    }
  }

  const store = createStore((s: Set<T>, action): Set<T> =>
    match(action.type)(
      caseWhen(isOp)(op => {
        const newS = apply(s, op) // apply updates locally
        fanOut(op) // send updates to server
        return newS
      }),
      caseWhen(isFanIn)(op =>
        apply(s, op.value) // FanIn - apply remote operations locally
      ),
      caseWhen(isFanOut)(op => {
        fanOut(op.value) // FanOut - send local operations to remotes
        return s
      }),
      caseDefault(() => s) // unknown action, ignore
    ), Set())

  let isLoadingSeed = false
  let fanInBuffer: LiveSetOp<T>[] = []

  function fanIn(op: LiveSetOp<T>): void {
    if (isLoadingSeed) {
      fanInBuffer.push(op)
    } else {
      if (fanInBuffer.length > 0) {
        flushFanInBuffer()
      }
      store.dispatch(storeAction(FanIn(op)))
    }
  }

  function flushFanInBuffer(): void {
    const buff = fanInBuffer
    fanInBuffer = []
    buff.forEach((op) => {
      store.dispatch(storeAction(FanIn(op)))
    })
  }

  sub.on("subscribe", (ch, count) => {
    if (ch === updatesChan) {
      subIsUp = true
      // pub is ready, can load seed value
      // loading seed value, need to preserve all changes until seed value loaded
      isLoadingSeed = true
      pub.smembers(key, (err, value) => {
        if (err) {
          // TODO handle this
        } else {
          const newSet = isArrayOf(isString)(value) ? value.map(item => JSON.parse(item)) : [] // this must be loaded from value
          store.dispatch(storeAction(FanIn(ReplaceAll(newSet))))
        }
        flushFanInBuffer()
        isLoadingSeed = false
      })
    }
  })

  sub.on("message", (ch, message) => {
    if (ch === updatesChan) {
      const op = JSON.parse(message)
      if (isOp(op)) {
        store.dispatch(storeAction(FanIn(op)))
      }
    }
  })

  sub.subscribe(updatesChan)

  return store
}
