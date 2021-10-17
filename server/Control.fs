module Control

open Giraffe
open Microsoft.AspNetCore.Http
open FsToolkit.ErrorHandling
open FSharpPlus.Data
open System.Threading.Tasks

type HandlerReader<'t> = Reader<'t, HttpHandler option Task>
type ContextHandlerReader = HttpContext HandlerReader
type HttpHandlerReader = (HttpFunc * HttpContext) HandlerReader

let runWithContext (r: ContextHandlerReader) : HttpHandler =
  fun next ctx -> taskOption {
    let! result = Reader.run r ctx
    return! result next ctx
  }

let runWithHandler (r: HttpHandlerReader) : HttpHandler =
  fun next ctx -> taskOption {
    let! result = Reader.run r (next, ctx)
    return! result next ctx
  }