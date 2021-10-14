import { either, readonlyRecord, readonlySet } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';
import * as D from 'io-ts/Decoder';
import * as iso from 'monocle-ts/Iso';
import { O } from 'ts-toolbelt';

import { decodeHand } from '../parse';
import { Deal } from './bridge';
import { Card, eqCard, Hand, ordCardDescending } from './deck';

export type DecodedHand = ReturnType<typeof decodeHand>
export type SerializedHand = ReadonlyArray<Card>
export type DecodedSerializedHand = DecodedHand extends Either<infer L, unknown> ? either.Either<L, SerializedHand> : never

export const serializedHandL : iso.Iso<Hand, SerializedHand> = iso.iso(
  readonlySet.toReadonlyArray(ordCardDescending),
  readonlySet.fromReadonlyArray(eqCard)
)
export type SerializedDeal = O.Update<Deal, keyof Deal, SerializedHand>
export const serializedDealL = iso.iso<Deal, SerializedDeal>(
  readonlyRecord.map(serializedHandL.get),
  readonlyRecord.map(serializedHandL.reverseGet),
)

const liftEither = <E>() => <A, B>(i: iso.Iso<A, B>) => iso.iso<Either<E, A>, Either<E, B>>(either.map(i.get), either.map(i.reverseGet))
export const decodedSerializedHandL = liftEither<D.DecodeError>()(serializedHandL)

export type SerializedBoard = O.Update<Board, "deal", SerializedDeal>
export const serializedBoardL = iso.iso<Board, SerializedBoard>(
  b => ({ ...b,
    deal: serializedDealL.get(b.deal),
  }),
  b => ({ ...b,
    deal: serializedDealL.reverseGet(b.deal),
  })
)