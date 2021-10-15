module Handlers
open Control
open Model
open Microsoft.AspNetCore.Http
open FSharpPlus
open FSharpPlus.Data
open Giraffe

let getQueryContext (context: HttpContext) = context.GetService<SqlHydra.Query.QueryContext> ()

let getHands : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectAsync queryContext Query.selectAllHands
      |>> (Seq.map (fun hand -> hand.Hand) >> Seq.toArray >> Successful.OK >> Some)
  }

let tryGetHand id : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    return Query.selectSingleHand id
      |> queryContext.ReadAsync Database.HydraReader.Read
      |>> (Seq.tryHead
        >> Option.map ((fun hand -> hand.Hand) >> Successful.OK))
  }

let tryAddHand id : ContextHandlerReader =
  monad {
    let! queryContext = Reader getQueryContext
    return
      Hand.tryCreate id
      |>> Query.insertHand
      |> traverse queryContext.InsertAsync
      |>> map (ignore >> (fun _ -> Successful.CREATED ""))
  }

let tryAddHands : ContextHandlerReader = 
  monad {
    let! queryContext = Reader getQueryContext
    let! getBody = Reader (fun ctx -> ctx.BindJsonAsync<seq<System.Guid>>())
    return
      getBody
      |>> traverse Hand.tryCreate
      >>= traverse (Query.insertHands >> queryContext.InsertAsync)
      |>> map (ignore >> (fun _ -> Successful.CREATED ""))
  }

let (<|>) h1 h2 = choose [ h1; h2 ]

let hGetHand id = (runWithContext <| tryGetHand id) <|> RequestErrors.NOT_FOUND ""
let hAddHand id = (runWithContext <| tryAddHand id) <|> RequestErrors.UNPROCESSABLE_ENTITY ""
let hGetHands = runWithContext getHands
let hAddHands : HttpHandler = runWithContext tryAddHands <|> RequestErrors.UNPROCESSABLE_ENTITY ""

let public webApp : HttpHandler =
  choose [
    route "/ping" >=> GET >=> text "pong"
    routef "/hands/%O" (fun id -> choose [
      GET >=> hGetHand id
      POST >=> hAddHand id
    ])
    route "/hands" >=> choose [
      GET >=> hGetHands
      POST >=> hAddHands
    ]
  ]