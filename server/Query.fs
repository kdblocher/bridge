module Query
open Database
open Database.dbo
open Model
open SqlHydra.Query
open Microsoft.Data.SqlClient

let dealTable = table<deals>
let shapeTable = table<shape_table>
type Id = System.Guid

let openContext () = 
  let conn = new SqlConnection "server=localhost;database=Bridge;TrustServerCertificate=True;User ID=bridge;Password=refinance-unweave-unglazed-dizzy-shuffling;MultipleActiveResultSets=true"
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
    tricks_north_clubs    = None
    tricks_north_diamonds = None
    tricks_north_hearts   = None
    tricks_north_spades   = None
    tricks_north_notrump  = None
    tricks_east_clubs     = None
    tricks_east_diamonds  = None
    tricks_east_hearts    = None
    tricks_east_spades    = None
    tricks_east_notrump   = None
    tricks_south_clubs    = None
    tricks_south_diamonds = None
    tricks_south_hearts   = None
    tricks_south_spades   = None
    tricks_south_notrump  = None
    tricks_west_clubs     = None
    tricks_west_diamonds  = None
    tricks_west_hearts    = None
    tricks_west_spades    = None
    tricks_west_notrump   = None
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

let insertAsync (context: QueryContext) = context.InsertAsync
