import { either } from "fp-ts"
import { pipe } from "fp-ts/lib/function"
import { DecodeError } from "io-ts/Decoder"
import { draw } from "io-ts/lib/Decoder"

interface DecodeProps<T> {
  value: either.Either<DecodeError, T>
  children: (value: T) => JSX.Element
  onError?: (error: DecodeError) => JSX.Element
}
const Decode = <T extends {}>({value, children: onSuccess, onError }: DecodeProps<T>) => 
  pipe(value, either.fold(
    e => onError ? onError(e) : <span>{draw(e)}</span>,
    onSuccess))

export default Decode