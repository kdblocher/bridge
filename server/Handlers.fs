module Handlers
open Control
open Model
open Microsoft.AspNetCore.Http
open FSharpPlus
open FSharpPlus.Data
open Giraffe
open System.Collections.Generic
open System.Threading.Tasks

let getQueryContext (context: HttpContext) = context.GetService<SqlHydra.Query.QueryContext> ()

let mutable shapes: Map<Shape, int16> option = None
let getShapes (context: HttpContext) =
  match shapes with
  | Some s -> s
  | None -> 
    Query.selectAllShapes
    |> (getQueryContext context).Read Database.HydraReader.Read
    |>> fun (s: Database.dbo.shape_table) ->
        { S = s.spade_length
          H = s.heart_length
          D = s.diamond_length
          C = s.club_length },
        s.id
    |> Map
    |> (fun v -> shapes <- Some v; v)

let getDeals : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectAsync queryContext Query.selectAllDeals
      |>> (Seq.map (fun deal -> deal.deal) >> Seq.toArray >> Successful.OK >> Some)
  }

let tryGetDeal id : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectSingleDeal id
      |> queryContext.ReadAsync Database.HydraReader.Read
      |>> (Seq.tryHead
        >> Option.map ((fun deal -> deal.deal) >> Successful.OK))
  }

let tryAddDeal id : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    let! shapes = Reader getShapes
    let! getBody = Reader (fun ctx -> ctx.BindJsonAsync<DealDetails>())
    let x =
      getBody
      |>> (fun details -> makeDeal details id)
      |>> map (Query.insertDeal shapes)
      >>= traverse queryContext.InsertAsync
      |>> map (ignore >> (fun () -> Successful.CREATED ""))
    return x
  }

let tryAddDeals : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    let! shapes = Reader getShapes
    let! getBody = Reader (fun ctx -> ctx.BindJsonAsync<Dictionary<System.Guid, DealDetails>>())
    let x =
      getBody
      |>> Seq.map (|KeyValue|)
      |>> traverse (fun (id, details) -> makeDeal details id)
      >>= (traverse (Query.insertDeals shapes >> traverse queryContext.InsertAsync))
      |>> map (ignore >> (fun () -> Successful.CREATED ""))
    return x
  }

let tryUpsertDeals : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    let! shapes = Reader getShapes
    let! getBody = Reader (fun ctx -> ctx.BindJsonAsync<Dictionary<System.Guid, DealDetails>>())
    let x =
      getBody
      |>> Seq.map (|KeyValue|)
      |>> traverse (fun (id, details) -> makeDeal details id)
      >>= (traverse (Query.updateDeals shapes >> Seq.iter (queryContext.Update >> ignore) >> Task.FromResult))
      |>> map (ignore >> (fun () -> Successful.OK ""))
    return x
  }

let (<|>) h1 h2 = choose [ h1; h2 ]

let hGetDeal id = (runWithContext <| tryGetDeal id) <|> RequestErrors.NOT_FOUND ""
let hAddDeal id = (runWithContext <| tryAddDeal id) <|> RequestErrors.UNPROCESSABLE_ENTITY ""
let hGetDeals = runWithContext getDeals
let hAddDeals : HttpHandler = runWithContext tryAddDeals <|> RequestErrors.UNPROCESSABLE_ENTITY ""
let hUpsertDeals = runWithContext tryUpsertDeals <|> RequestErrors.UNPROCESSABLE_ENTITY ""

let public webApp : HttpHandler =
  choose [
    route "/ping" >=> GET >=> publicResponseCaching 60 None >=> text "pong"
    routef "/deals/%O" (fun id -> choose [
      GET >=> hGetDeal id
      POST >=> hAddDeal id
    ])
    route "/deals" >=> choose [
      GET >=> hGetDeals
      POST >=> hAddDeals
      PUT >=> hUpsertDeals
    ]
  ]