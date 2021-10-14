open Giraffe
open Microsoft.AspNetCore.Http

let getHands = Successful.ok <| text "Hand Placeholder"
let addHand = Successful.CREATED ()

let webApp =
  choose [
    route "/ping" >=> GET >=> text "pong"
    route "/hands" >=> choose [
      GET >=> getHands
      POST >=> addHand
    ]
  ]
  
open System.Text.Json
open System.Text.Json.Serialization

let serializer =
  let options = SystemTextJson.Serializer.DefaultOptions
  JsonFSharpOptions(
    unionEncoding = (JsonUnionEncoding.UnwrapOption ||| JsonUnionEncoding.InternalTag ||| JsonUnionEncoding.NamedFields ||| JsonUnionEncoding.UnwrapFieldlessTags),
    unionTagName = "case",
    unionTagNamingPolicy = JsonNamingPolicy.CamelCase)
    |> JsonFSharpConverter
    |> options.Converters.Add
  options |> SystemTextJson.Serializer

open Microsoft.Extensions.Configuration
open Microsoft.Extensions.DependencyInjection

let configureServices (config: IConfiguration) (services : IServiceCollection) =
  ignore <| services
    .AddGiraffe()
    .AddSingleton<Json.ISerializer>(serializer)

open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Hosting
open Microsoft.Extensions.Hosting
open Microsoft.FSharp.Control

let configureApp (app : IApplicationBuilder) =
  app.UseGiraffe webApp

[<EntryPoint>]
let main args =
  let hostTask =
    Host
      .CreateDefaultBuilder(args)
      .ConfigureWebHostDefaults(fun webHostBuilder ->
        webHostBuilder
          .Configure(configureApp)
          .ConfigureServices(fun context services -> configureServices context.Configuration services)
          .UseSetting("detailedErrors", "true")
          |> ignore)
      .RunConsoleAsync Async.DefaultCancellationToken
  hostTask.GetAwaiter().GetResult()
  0