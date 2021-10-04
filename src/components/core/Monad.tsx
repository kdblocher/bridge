import { either, option } from "fp-ts"

import { DecodeError } from "io-ts/Decoder"
import { draw } from "io-ts/lib/Decoder"
import { pipe } from "fp-ts/lib/function"

interface OptionProps<T> {
  value: option.Option<T>
  children: (value: T) => JSX.Element
  onNone?: () => JSX.Element
}
export const Option = <T extends {}>({value, children: onSuccess, onNone }: OptionProps<T>) => 
  pipe(value, option.fold(
    () => onNone ? onNone() : <></>,
    onSuccess))

interface DecodeProps<T> {
  value: either.Either<DecodeError, T>
  children: (value: T) => JSX.Element
  onError?: (error: DecodeError) => JSX.Element
}
export const Decode = <T extends {}>({value, children: onSuccess, onError }: DecodeProps<T>) => 
  pipe(value, either.fold(
    e => onError ? onError(e) : <span>{draw(e)}</span>,
    onSuccess))