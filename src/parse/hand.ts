import * as AST from '../parse/hand.peg.g'
import * as e from 'io-ts/Encoder'

import { Board, directions, ordDirection } from "../model/bridge"
import { Card, Hand, Rank, RankC, Suit, eqCard, getOrdGroupedHand, groupHandBySuits, ordRankDescending, ranks, suits } from "../model/deck"
import { flow, identity, pipe } from "fp-ts/lib/function"
import { ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet, readonlyTuple, string } from "fp-ts"

import { Right } from "fp-ts/lib/Either"



const suitFromAST = (hand: AST.Hand) => (suit: Suit) : ReadonlyArray<Card> =>
  pipe(hand[suit].cards,
    readonlyArray.map(card => ({ suit, rank: (RankC.decode(card.rank) as Right<Rank>).right })))

export const handFromAST = (hand: AST.Hand) : Hand =>
  pipe(suits,
    readonlyArray.map(suitFromAST(hand)),
    readonlyArray.flatten,
    readonlySet.fromReadonlyArray(eqCard))

export const HandE : e.Encoder<string, Hand> = {
  encode: flow(
    groupHandBySuits,
    readonlyRecord.toReadonlyArray,
    readonlyArray.sort(getOrdGroupedHand<ReadonlyArray<Rank>>()),
    readonlyArray.map(flow(
      readonlyTuple.snd,
      readonlyArray.sort(ordRankDescending),
      readonlyArray.reduce("", (cur, rank) => cur + ranks[rank - 2]))),
    readonlyArray.intersperse("."),
    readonlyArray.foldMap(string.Monoid)(identity))
}

export const parseHand = AST.parse