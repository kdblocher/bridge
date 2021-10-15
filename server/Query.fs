module Query
open Database
open Database.dbo
open SqlHydra.Query
open Microsoft.Data.SqlClient

let handTable = table<Hands>
type Id = System.Guid

let openContext () = 
  let conn = new SqlConnection "server=localhost;database=Bridge;TrustServerCertificate=True;User ID=bridge;Password=refinance-unweave-unglazed-dizzy-shuffling"
  conn.Open ()
  new QueryContext(conn, SqlKata.Compilers.SqlServerCompiler ())

let selectAllHands =
  select {
    for a in handTable do
    select a
  }

let selectSingleHand id =
  select {
    for a in handTable do
    where (a.Hand = id)
    select a
    take 1
  }

let selectAsync (context: QueryContext) = context.ReadAsync HydraReader.Read

// Notes about upsert patterns https://sqlperformance.com/2020/09/locking/upsert-anti-pattern
// For now, try/catch around collisions is fine since it is so unlikely

let getHandEntity id =
  { Hand = id
  }

let insertHand : Id -> InsertQuery<Hands, int> =
  getHandEntity >> (fun hand ->
    insert {
      into handTable
      entity hand
    })

let insertHands : seq<Id> -> InsertQuery<Hands, int> =
  Seq.map getHandEntity >> (fun hands ->
    insert {
      into handTable
      entities hands
    })

let insertAsync (context: QueryContext) = context.InsertAsync
