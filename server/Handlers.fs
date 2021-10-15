module Handlers
open Giraffe
open Control
open Microsoft.AspNetCore.Http
open FSharpPlus
open FSharpPlus.Data

let getQueryContext (context: HttpContext) = context.GetService<SqlHydra.Query.QueryContext> ()

let getHands : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectAsync queryContext Query.selectAllHands
      |>> (Seq.map (fun hand -> hand.Hand) >> Seq.toArray >> Successful.OK >> Some)
  }

let getHand id : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectSingleHand id
      |> queryContext.ReadAsync Database.HydraReader.Read
      |>> (
        Seq.tryHead
        >> Option.map ((fun hand -> hand.Hand) >> Successful.OK)
        >> Option.orElseWith (Some << RequestErrors.NOT_FOUND))
  }

let addHand id : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    return Query.insertHand id
      |> queryContext.InsertAsync 
      |>> (Some << Successful.CREATED << ignore)
  }

let addHands : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    let! getBody = Reader (fun ctx -> ctx.BindJsonAsync<seq<System.Guid>>())
    return 
      getBody
      >>= (Query.insertHands >> queryContext.InsertAsync) 
      |>> (Some << Successful.CREATED << ignore)
  }

open Giraffe
let public webApp : HttpHandler =
  choose [
    route "/ping" >=> GET >=> text "pong"
    routef "/hands/%O" (fun id -> choose [
      GET >=> (runWithContext <| getHand id)
      POST >=> (runWithContext <| addHand id)
    ])
    route "/hands" >=> choose [
      GET >=> runWithContext getHands
      POST >=> runWithContext addHands
    ]
  ]