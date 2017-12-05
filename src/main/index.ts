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

import * as redis from "redis"
import { hasFields, isNumber, isString, isValue, TypeMatcher, isArrayOf } from "typematcher"
import { AnyAction, createStore, Store } from "redux"
import { Set } from "immutable"
import { Add, AddAll, apply, Clear, isLiveSetOp, LiveSetOp, Remove, ReplaceAll } from "./operations"
import { createLiveStore } from "./store"

/**
 * Redis LiveSet wrapper
 */
export class RedisLiveSet<T> {
  private _store: Store<Set<T>>

  constructor(key: string,
              typeMatcher: TypeMatcher<T>,
              pub: redis.RedisClient,
              sub: redis.RedisClient,
              updatesChan: string = key) {
    this._store = createLiveStore(key, typeMatcher, pub, sub, updatesChan)
  }

  /**
   * Add new value to Set
   * @param {T} value
   */
  add(value: T): void {
    this._store.dispatch({ type: Add(value) })
  }

  /**
   * Remove value from Set
   * @param {T} value
   */
  remove(value: T): void {
    this._store.dispatch({ type: Remove(value) })
  }

  /**
   * Add all values to Set
   * @param {T[]} values
   */
  addAll(values: T[]): void {
    this._store.dispatch({ type: AddAll(values) })
  }

  /**
   * Clear Set
   */
  clear(): void {
    this._store.dispatch({ type: Clear })
  }

  /**
   * Replace all Set values with given
   * @param {T[]} values
   */
  replaceAll(values: T[]): void {
    this._store.dispatch({ type: ReplaceAll(values) })
  }

  /**
   * Subscribe for set changes
   * @param {(s: Set<T>) => void} cb
   */
  subscribe(cb: (s: Set<T>) => void): void {
    let lastSet: Set<T> | null = null
    this._store.subscribe(() => {
      const newSet = this._store.getState()

      if (lastSet === null || !lastSet.equals(newSet)) {
        cb(this._store.getState())
      }

      lastSet = newSet
    })
  }
}

/**
 * Create live set instance
 * Values serialized/deserialized with JSON.stringify/JSON.parse and matched with given typeMatcher on deserialize
 * @param {string} key - Redis key to store Set at
 * @param {TypeMatcher<T>} typeMatcher - matcher for set items
 * @param {RedisClient} pub - Redis connection for read/write operations
 * @param {RedisClient} sub - Redis connection for subscriptions
 * @param {string} updatesChan - custom name for updates channel, by default $key used
 * @returns {RedisLiveSet<T>}
 */
export function createLiveSet<T>(key: string,
                                 typeMatcher: TypeMatcher<T>,
                                 pub: redis.RedisClient,
                                 sub: redis.RedisClient,
                                 updatesChan: string = key): RedisLiveSet<T> {
  return new RedisLiveSet(key, typeMatcher, pub, sub, updatesChan)
}

export default createLiveSet
