import { either, option, readonlyArray, readonlyRecord, semigroup, task, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';

import { TrickCountsByDirectionThenStrain, TrickCountsByStrain } from '../model/analyze';
import { Deal, Direction } from '../model/bridge';
import { getHandSpecificShape, getHcp, SpecificShape } from '../model/evaluation';
import { serializedDealL } from '../model/serialization';

const baseUrl = process.env.REACT_APP_API_URL

const safeFetch = (t: task.Task<Response>) =>
  taskEither.tryCatchK(t, either.toError)()

export const ping =
  pipe(() => fetch(`${baseUrl}/ping`),
    safeFetch,
    taskEither.chainTaskK(response => () => response.text()),
    taskEither.filterOrElse(response => response === "pong", () => new Error("'pong' was not received")))

interface DirectionMetadata {
  hcp: number
  shape: SpecificShape
  tricks?: TrickCountsByStrain
}

type DealWithSolution = readonly [Deal, option.Option<TrickCountsByDirectionThenStrain>]

const getRequestBody =
  readonlyArray.foldMap(readonlyRecord.getUnionMonoid(semigroup.first<Detail>()))(([deal, table]: DealWithSolution) => ({
    [serializedDealL.get(deal).id]: pipe(deal,
      readonlyRecord.mapWithIndex((d, h): DirectionMetadata => ({
        hcp: getHcp(h),
        shape: getHandSpecificShape(h),
        tricks: pipe(table, option.map(t => t[d]), option.toUndefined)
      })))
    }))

const getRequestBodyWithoutSolution =
  flow(
    readonlyArray.map((deal: Deal) => ([deal, option.none] as const)),
    getRequestBody)

type Detail = readonlyRecord.ReadonlyRecord<Direction, DirectionMetadata>
export const postDeals = (deals: ReadonlyArray<Deal>) =>
  pipe(deals,
    getRequestBodyWithoutSolution,
    JSON.stringify,
    task.of,
    task.chain(body => () =>
      fetch(`${baseUrl}/deals`, {
        method: "POST",
        body
      })),
    safeFetch)

export const putDeals = (deals: ReadonlyArray<DealWithSolution>) =>
  pipe(deals,
    getRequestBody,
    JSON.stringify,
    task.of,
    task.chain(body => () =>
      fetch(`${baseUrl}/deals`, {
        method: "PUT",
        body
      })),
    safeFetch)

export const postDeal = (deal: Deal) => postDeals([deal])