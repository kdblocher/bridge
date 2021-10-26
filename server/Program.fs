open Giraffe
open Microsoft.AspNetCore.Http
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
  options.PropertyNameCaseInsensitive <- true
  options |> SystemTextJson.Serializer

open Microsoft.Extensions.Configuration
open Microsoft.Extensions.DependencyInjection

let configureServices (config: IConfiguration) (services : IServiceCollection) =
  ignore <| services
    .AddCors()
    .AddResponseCaching()
    .AddGiraffe()
    .AddSingleton<Json.ISerializer>(serializer)
    .AddScoped<SqlHydra.Query.QueryContext>(fun _ -> config.GetConnectionString("Bridge") |> Query.openContext)

open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Hosting
open Microsoft.Extensions.Hosting
open Microsoft.FSharp.Control

let configureApp (app : IApplicationBuilder) =
  app
    .UseCors(fun builder -> 
      ignore <| builder
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowAnyOrigin())
    .UseResponseCaching()
    .UseGiraffe Handlers.webApp

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