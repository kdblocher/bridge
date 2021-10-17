module Model
open System
open System.Collections

type Hand = private Hand of Guid
module Hand =
  let public value (Hand id) = id

  [<Literal>]
  let private MASK = 0b11uy

  let public tryCreate (id: Guid) =
    let bits = id.ToByteArray ()
    let counts = Array.zeroCreate 4
    for b = 0 to 12 do // 13 bytes
      let mutable byte = bits.[b]
      for i = 0 to 3 do // 4 cards per byte
        let bucket = byte &&& MASK |> int
        counts.[bucket] <- counts.[bucket] + 1
        byte <- byte >>> 2
    // card counts should all be equal
    if counts |> Array.forall ((=) 13) then Some (Hand id) else None