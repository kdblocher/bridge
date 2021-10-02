export module Tuple {
  type MapTuple<T, U> = {
    [K in keyof T]: U
  }
  export const map = <A, B, Arr extends A[]>(f: (a: A, i: number) => B, ...a: Arr) : MapTuple<Arr, B> =>
    [...a.map(f)] as MapTuple<Arr, B>
}