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
import { Set } from "immutable"
import { hasFields, isArrayOf, isEither, isObject, isValue, TypeMatcher } from "typematcher"

export namespace LiveSetOp {
  export type Add<T> = {
    _tag: "Add"
    value: T
  }

  export type Remove<T> = {
    _tag: "Remove"
    value: T
  }

  export type Clear = {
    _tag: "Clear"
  }

  export type AddAll<T> = {
    _tag: "AddAll"
    values: T[]
  }

  export type ReplaceAll<T> = {
    _tag: "ReplaceAll"
    values: T[]
  }

  /**
   * Check input value matches Add<T> type
   */
  export function isAdd<T>(valueMatch: TypeMatcher<T>): (value: any) => value is Add<T> {
    return hasFields<Add<T>>({
      _tag: isValue<"Add">("Add"),
      value: valueMatch
    })
  }

  /**
   * Check input value matches Remove<T> type
   */
  export function isRemove<T>(valueMatch: TypeMatcher<T>): (value: any) => value is Remove<T> {
    return hasFields<Remove<T>>({
      _tag: isValue<"Remove">("Remove"),
      value: valueMatch
    })
  }

  /**
   * Check input value is Clear type
   */
  export function isClear(value: any): value is Clear {
    return hasFields({
      _tag: isValue<"Clear">("Clear")
    })(value)
  }

  /**
   * Check input value matches AddAll<T> type
   */
  export function isAddAll<T>(valueMatch: TypeMatcher<T>): (value: any) => value is AddAll<T> {
    return hasFields({
      _tag: isValue<"AddAll">("AddAll"),
      values: isArrayOf(valueMatch)
    })
  }

  export function isReplaceAll<T>(valueMatch: TypeMatcher<T>): (value: any) => value is ReplaceAll<T> {
    return hasFields({
      _tag: isValue<"ReplaceAll">("ReplaceAll"),
      values: isArrayOf(valueMatch)
    })
  }
}

/**
 * Define set operations
 */
export type LiveSetOp<T> =
  LiveSetOp.Add<T>
  | LiveSetOp.Remove<T>
  | LiveSetOp.Clear
  | LiveSetOp.AddAll<T>
  | LiveSetOp.ReplaceAll<T>

/**
 * Check input value is LiveSetOp<T> type
 */
export function isLiveSetOp<T>(valueMatch: TypeMatcher<T>): (value: any) => value is LiveSetOp<T> {
  return isEither(
    LiveSetOp.isAdd(valueMatch),
    isEither(
      LiveSetOp.isRemove(valueMatch),
      isEither(
        LiveSetOp.isClear,
        isEither(
          LiveSetOp.isAddAll(valueMatch),
          LiveSetOp.isReplaceAll(valueMatch)
        )
      )
    )
  )
}

/**
 * Builds new Add LiveSet operation - adds given value to set
 */
export function Add<T>(value: T): LiveSetOp.Add<T> {
  return {
    _tag: "Add",
    value: value
  }
}

/**
 * Builds new Remove LiveSet operation - removes given value from set
 */
export function Remove<T>(value: T): LiveSetOp.Remove<T> {
  return {
    _tag: "Remove",
    value: value
  }
}

/**
 * Build new Clear LiveSet operation - clears set
 */
export const Clear: LiveSetOp.Clear = {
  _tag: "Clear"
}

/**
 * Build new AddAll LiveSet operation - updates set with union of current set and given values
 */
export function AddAll<T>(values: T[]): LiveSetOp.AddAll<T> {
  return {
    _tag: "AddAll",
    values: values
  }
}

/**
 * Build new ReplaceAll LiveSet operation - replace all set values with given
 */
export function ReplaceAll<T>(values: T[]): LiveSetOp.ReplaceAll<T> {
  return {
    _tag: "ReplaceAll",
    values: values
  }
}

/**
 * Apply event to given Set, return updated Set
 */
export function apply<T>(set: Set<T>, event: LiveSetOp<T>): Set<T> {
  switch (event._tag) {
    case "Add":
      return set.add(event.value)
    case "Remove":
      return set.remove(event.value)
    case "Clear":
      return set.clear()
    case "AddAll":
      return set.union(event.values)
    case "ReplaceAll":
      return Set(event.values)
  }
}
