import { either, ord, readonlyArray, readonlyRecord, readonlySet, readonlyTuple, task, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { Encoder } from 'io-ts/lib/Encoder';
import { Uuid } from 'uuid-tool';

import { Deal, directions } from '../model/bridge';
import { Card, ordCardDescending } from '../model/deck';

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

const safeFetch = (t: task.Task<Response>) =>
  taskEither.tryCatchK(t, either.toError)()

export const ping =
  pipe(() => fetch("http://localhost:5000/ping"),
    safeFetch,
    taskEither.chainTaskK(response => () => response.text()),
    taskEither.filterOrElse(response => response === "pong", () => new Error("'pong' was not received")))

export const postDeals = (deals: ReadonlyArray<Deal>) =>
  pipe(deals,
    readonlyArray.map(flow(
      encode.encode,
      x => x.toString())),
    JSON.stringify,
    task.of,
    task.chain(body => () =>
      fetch("http://localhost:5000/hands", {
        method: "POST",
        body
      })),
    safeFetch)

export const postDeal = (deal: Deal) => postDeals([deal])