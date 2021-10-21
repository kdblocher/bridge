module Model
open System
open System.Collections

type DealId = private DealId of Guid
module DealId =
  let public value (DealId id) = id

  [<Literal>]
  let private MASK = 0b11uy

  let public tryCreate (id: Guid) =
    let bits = id.ToByteArray ()
    let counts = Array.zeroCreate 4
    for b = 0 to 12 do // 13 bytes
      let mutable byte = bits.[b]
      for i = 0 to 3 do // 4 cards per byte
        let direction = byte &&& MASK |> int
        counts.[direction] <- counts.[direction] + 1
        byte <- byte >>> 2
    // card counts should all be equal
    if counts |> Array.forall ((=) 13) then Some (DealId id) else None

[<CLIMutable>]
type Shape = {
  C: byte
  D: byte
  H: byte
  S: byte
}

type Tricks = {
  C: byte
  D: byte
  H: byte
  S: byte
  N: byte
}

let inline C (x: ^a) = (^a: (member C: byte) x)
let inline D (x: ^a) = (^a: (member D: byte) x)
let inline H (x: ^a) = (^a: (member H: byte) x)
let inline S (x: ^a) = (^a: (member S: byte) x)
let inline N (x: ^a) = (^a: (member N: byte) x)


[<CLIMutable>]
type DealDirectionMetadata = {
  HCP: byte
  Shape: Shape
  Tricks: Tricks option
}

[<CLIMutable>]
type DealDetails = {
  N: DealDirectionMetadata
  E: DealDirectionMetadata
  S: DealDirectionMetadata
  W: DealDirectionMetadata
}

[<CLIMutable>]
type Deal = {
  Id: DealId
  Details: DealDetails
}
let makeDeal details =
  DealId.tryCreate
  >> Option.map (fun id -> { Id = id; Details = details })