module Model
open System
open System.Collections

type Hand = private Hand of Guid
module Hand =
  [<Literal>]
  let private MASK = 0b11L

  let public value (Hand id) = id

  let inline private sum (checksum: byref<int64>) (bits: int64) length =
    let mutable bits = bits
    for i = 0 to length - 1 do
      checksum <- checksum + (bits &&& MASK)
      bits <- bits >>> 2

  let public tryCreate (id: Guid) =
    let bits = id.ToByteArray ()
    let mutable checksum = 0L
    let lower = BitConverter.ToInt64 (ReadOnlySpan (bits, 0, 8))
    let upper = BitConverter.ToInt64 (ReadOnlySpan (bits, 8, 8))
    sum &checksum lower 32
    sum &checksum upper 20
    if checksum = 52L then Some (Hand id) else None