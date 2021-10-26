module Query
open Database
open Database.dbo
open Model
open SqlHydra.Query
open Microsoft.Data.SqlClient

let dealTable = table<deals>
let shapeTable = table<shape_table>
type Id = System.Guid

let openContext (connectionString: string) = 
  let conn = new SqlConnection(connectionString)
  conn.Open ()
  new QueryContext(conn, SqlKata.Compilers.SqlServerCompiler ())

let selectAllShapes =
  select {
    for a in shapeTable do
    select a
  }

let selectAllDeals =
  select {
    for a in dealTable do
    select a
  }

let getByteArray (id: Id) = id.ToByteArray() |> Array.take 13

let selectSingleDeal (id: Id) =
  let bytes = getByteArray id
  select {
    for a in dealTable do
    where (a.deal = bytes)
    select a
    take 1
  }

let selectAsync (context: QueryContext) = context.ReadAsync HydraReader.Read

// Notes about upsert patterns https://sqlperformance.com/2020/09/locking/upsert-anti-pattern
// For now, try/catch around collisions is fine since it is so unlikely

open FSharpPlus
let getDealEntity (shapes: Map<Shape, int16>) (deal: Deal) =
  { deal                  = DealId.value deal.Id |> getByteArray
    when_dealt            = Some System.DateTime.UtcNow
    shape_north           = shapes |> Map.find deal.Details.N.Shape
    shape_east            = shapes |> Map.find deal.Details.E.Shape
    shape_south           = shapes |> Map.find deal.Details.S.Shape
    shape_west            = shapes |> Map.find deal.Details.W.Shape
    hcp_north             = deal.Details.N.HCP
    hcp_east              = deal.Details.E.HCP
    hcp_south             = deal.Details.S.HCP
    hcp_west              = deal.Details.W.HCP
    tricks_north_clubs    = C <!> deal.Details.N.Tricks
    tricks_north_diamonds = D <!> deal.Details.N.Tricks
    tricks_north_hearts   = H <!> deal.Details.N.Tricks
    tricks_north_spades   = S <!> deal.Details.N.Tricks
    tricks_north_notrump  = N <!> deal.Details.N.Tricks
    tricks_east_clubs     = C <!> deal.Details.E.Tricks
    tricks_east_diamonds  = D <!> deal.Details.E.Tricks
    tricks_east_hearts    = H <!> deal.Details.E.Tricks
    tricks_east_spades    = S <!> deal.Details.E.Tricks
    tricks_east_notrump   = N <!> deal.Details.E.Tricks
    tricks_south_clubs    = C <!> deal.Details.S.Tricks
    tricks_south_diamonds = D <!> deal.Details.S.Tricks
    tricks_south_hearts   = H <!> deal.Details.S.Tricks
    tricks_south_spades   = S <!> deal.Details.S.Tricks
    tricks_south_notrump  = N <!> deal.Details.S.Tricks
    tricks_west_clubs     = C <!> deal.Details.W.Tricks
    tricks_west_diamonds  = D <!> deal.Details.W.Tricks
    tricks_west_hearts    = H <!> deal.Details.W.Tricks
    tricks_west_spades    = S <!> deal.Details.W.Tricks
    tricks_west_notrump   = N <!> deal.Details.W.Tricks
    par_north_nonevul     = None
    par_east_nonevul      = None
    par_south_nonevul     = None
    par_west_nonevul      = None
    par_north_nsvul       = None
    par_east_nsvul        = None
    par_south_nsvul       = None
    par_west_nsvul        = None
    par_north_ewvul       = None
    par_east_ewvul        = None
    par_south_ewvul       = None
    par_west_ewvul        = None
    par_north_allvul      = None
    par_east_allvul       = None
    par_south_allvul      = None
    par_west_allvul       = None
  }

let insertDeal shapes : Deal -> InsertQuery<deals, int> =
  getDealEntity shapes >> (fun deal ->
    insert {
      into dealTable
      entity deal
    })

let insertDeals shapes : seq<Deal> -> seq<InsertQuery<deals, int>> =
  Seq.toArray
  >> Array.chunkBySize 40  // SQL Server only allows 2100 parameters per INSERT statement
  >> Seq.map (Seq.map (getDealEntity shapes) >> (fun deals ->
    insert {
      into dealTable
      entities deals
    }))

let updateDeals shapes : seq<Deal> -> _ =
  Seq.toArray
  >> Seq.map (getDealEntity shapes >> fun deal ->
    update {
      for a in dealTable do
      entity deal
      where (a.deal = deal.deal)
    })

let insertAsync (context: QueryContext) = context.InsertAsync
