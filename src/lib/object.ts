import ts from 'ts-toolbelt';

type Key = ts.Any.Key

export const map = <T, U>(obj: T, fn: (k: keyof T, v: T[keyof T], i: number) => any) =>
  Object.fromEntries<U>(
    (Object.entries(obj) as ([keyof T, T[keyof T]])[]).map(
      ([k, v], i) => [k, fn(k, v, i)]))

export const hasProperty = <X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> =>
  obj.hasOwnProperty(prop)

export const get =
  <P extends Key>(key: P) =>
  <T extends Record<P, T[P]>>(obj: T) =>
    obj[key]
export const getN =
  <P extends Key>(key: P) =>
  <T extends Partial<Record<P, T[P]>>>(obj: T) =>
    obj[key]

export const set =
  <P extends Key>(key: P) =>
  <T extends Record<P, T[P]>>(value: T[P]) =>
  (obj: T) => {
    obj[key] = value
  }
export const update =
  <P extends Key>(key: P) =>
  <T extends Record<P, T[P]>>(value: T[P]) =>
  (obj: T) => { 
    set(key)(value)(obj)
    return value
  }