import { flow, pipe } from "fp-ts/lib/function"
import { number, ord, readonlyNonEmptyArray } from "fp-ts"

export const assertUnreachable = (x: never) => {
  throw new Error (`shouldn't get here with ${JSON.stringify(x)}`)
}

export const ordAscending = <T>(array: readonlyNonEmptyArray.ReadonlyNonEmptyArray<T>) =>
  pipe(number.Ord, ord.contramap<number, T>(x => array.indexOf(x)))

export const ordDescending = flow(ordAscending, ord.reverse)
