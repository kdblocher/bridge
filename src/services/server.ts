import { either, option, ord, readonlyArray, readonlyRecord, readonlySet, readonlyTuple, semigroup, task, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Encoder } from 'io-ts/lib/Encoder';
import { Uuid } from 'uuid-tool';

import { TrickCountsByDirectionThenStrain, TrickCountsByStrain } from '../model/analyze';
import { Deal, Direction, directions } from '../model/bridge';
import { Card, ordCardDescending } from '../model/deck';
import { getHandSpecificShape, getHcp, SpecificShape } from '../model/evaluation';

// const Uuid = t.brand(t.string, (s: string): s is t.Branded<string, { readonly Uuid: unique symbol }> => validate(s), 'Uuid')
// type Uuid = t.TypeOf<typeof Uuid>

type CardDirectionPair = readonly [Card, number]
const encode: Encoder<Uuid, Deal> = {
  encode: flow(
      readonlyRecord.foldMapWithIndex(ord.trivial)(readonlyArray.getMonoid<CardDirectionPair>())((direction, cards) =>
        pipe(cards,
          readonlySet.toReadonlyArray<Card>(ord.trivial),
          readonlyArray.map(c => [c, directions.indexOf(direction)]))),
      readonlyArray.sort(ord.contramap((p: CardDirectionPair) => p[0])(ordCardDescending)),
      readonlyArray.map(readonlyTuple.snd),
      readonlyArray.chunksOf(4),
      readonlyArray.map(readonlyArray.reduce(0, (byte, directionIndex) => (byte << 2) + directionIndex)),
      readonlyArray.concat(readonlyArray.replicate(3, 0)),
      readonlyArray.toArray,
      x => new Uuid(x))
}

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
    [encode.encode(deal).toString()]: pipe(deal,
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