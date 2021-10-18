import { array, either, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet, readonlyTuple, refinement } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';
import { flow, pipe } from 'fp-ts/lib/function';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import * as t from 'io-ts';
import * as D from 'io-ts/Decoder';
import * as E from 'io-ts/Encoder';
import * as iso from 'monocle-ts/Iso';
import { O } from 'ts-toolbelt';
import { Uuid, UuidLike, UuidTool } from 'uuid-tool';

import { decodeHand } from '../parse';
import { Board, Deal, directions } from './bridge';
import { Card, cards, eqCard, Hand, ordCardDescending } from './deck';

export type DecodedHand = ReturnType<typeof decodeHand>
export type SerializedHand = ReadonlyArray<Card>
export type DecodedSerializedHand = DecodedHand extends Either<infer L, unknown> ? either.Either<L, SerializedHand> : never

export const serializedHandL : iso.Iso<Hand, SerializedHand> = iso.iso(
  readonlySet.toReadonlyArray(ordCardDescending),
  readonlySet.fromReadonlyArray(eqCard)
)

const liftEither = <E>() => <A, B>(i: iso.Iso<A, B>) => iso.iso<Either<E, A>, Either<E, B>>(either.map(i.get), either.map(i.reverseGet))
export const decodedSerializedHandL = liftEither<D.DecodeError>()(serializedHandL)

export const decodeUuid : D.Decoder<string, Uuid> = {
  decode: flow(
    either.fromPredicate(UuidTool.isUuid, s => D.error(s, "Invalid uuid string")),
    either.map(s => new Uuid(s)))
}

const getUuidQuads = (uuid: UuidLike) => {
  // debugger;
  return pipe(new Uuid(uuid.id).toBytes(),
    readonlyArray.chain(byte =>
      readonlyArray.unfold([byte, 4 as number] as const, ([byte, i]) =>
        i === 0
        ? option.none
        : option.some([byte & 4, [byte >> 2, i - 1]] as const)))) as ReadonlyNonEmptyArray<number>
    }

export type SerializedDeal = t.Branded<UuidLike, { readonly Deal: unique symbol }>
const isDealUuid: refinement.Refinement<UuidLike, SerializedDeal> =
  (uuid): uuid is SerializedDeal =>
    pipe(uuid,
      getUuidQuads,
      readonlyArray.reduce(
        array.replicate(4, 0 as number),
        (counts, directionIndex) =>
          { counts[directionIndex] += 1; return counts }),
      readonlyArray.every(count => count === 13))

const DealUuidB = t.brand(t.type({ id: t.string }), isDealUuid, 'Deal')

const dealUuidToDeal: E.Encoder<Deal, SerializedDeal> = {
  encode: flow(
    getUuidQuads,
    readonlyNonEmptyArray.zip(pipe(cards, readonlyNonEmptyArray.sort(ordCardDescending))),
    readonlyNonEmptyArray.map(([idx, card]) => [directions[idx], card] as const),
    readonlyNonEmptyArray.groupBy(readonlyTuple.fst),
    readonlyRecord.map(flow(
      readonlyNonEmptyArray.map(readonlyTuple.snd),
      readonlySet.fromReadonlyArray(eqCard))))
  }

type CardDirectionPair = readonly [Card, number]
const encodeDealAsUuid: E.Encoder<SerializedDeal, Deal> = {
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
    x => (DealUuidB.decode(new Uuid(x)) as either.Right<SerializedDeal>).right)
  }

export const serializedDealL = iso.iso<Deal, SerializedDeal>(
  encodeDealAsUuid.encode,
  dealUuidToDeal.encode
)

export type SerializedBoard = O.Update<Board, "deal", SerializedDeal>
export const serializedBoardL = iso.iso<Board, SerializedBoard>(
  b => ({ ...b,
    deal: serializedDealL.get(b.deal),
  }),
  b => ({ ...b,
    deal: serializedDealL.reverseGet(b.deal),
  })
)