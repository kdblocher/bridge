import { ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlySet, readonlyTuple, string } from 'fp-ts';
import { Right } from 'fp-ts/lib/Either';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import * as e from 'io-ts/Encoder';
import { Board, directions, ordDirection } from '../model/bridge';
import { Card, eqCard, getOrdGroupedHand, groupHandBySuits, Hand, ordRankDescending, Rank, RankC, Suit, suits } from '../model/deck';
import * as AST from '../parse/hand.peg.g';


const suitFromAST = (hand: AST.Hand) => (suit: Suit) : ReadonlyArray<Card> =>
  pipe(hand[suit].cards,
    readonlyArray.map(card => ({ suit, rank: (RankC.decode(card.rank) as Right<Rank>).right })))

export const handFromAST = (hand: AST.Hand) : Hand =>
  pipe(suits,
    readonlyArray.map(suitFromAST(hand)),
    readonlyArray.flatten,
    readonlySet.fromReadonlyArray(eqCard))

export const parseHand = AST.parse

// PBN hand notation
export const handE : e.Encoder<string, Hand> = {
  encode: flow(
    groupHandBySuits,
    readonlyRecord.toReadonlyArray,
    readonlyArray.sort(getOrdGroupedHand<ReadonlyArray<Rank>>()),
    readonlyArray.map(flow(
      readonlyTuple.snd,
      readonlyArray.sort(ordRankDescending),
      readonlyArray.reduce("", (cur, rank) => cur + RankC.encode(rank)))),
    readonlyArray.intersperse("."),
    readonlyArray.foldMap(string.Monoid)(identity))
}

// PBN board notation
export const boardE : e.Encoder<string, Board> = {
  encode: ({ dealer, deal }) => pipe(deal,
    readonlyRecord.map(handE.encode),
    readonlyRecord.toReadonlyArray,
    readonlyArray.sort(ord.contramap(readonlyTuple.fst)(ordDirection)),
    readonlyArray.rotate(directions.indexOf(dealer)),
    readonlyArray.map(readonlyTuple.snd),
    readonlyArray.intersperse(" "),
    readonlyArray.prepend(dealer + ":"),
    readonlyNonEmptyArray.concatAll(string.Semigroup))
}