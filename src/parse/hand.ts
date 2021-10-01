import * as AST from '../parse/hand.peg.g'

import { Card, Hand, Rank, RankC, Suit, eqCard, suits } from "../model/deck"
import { readonlyArray, readonlySet } from "fp-ts"

import { Right } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/function"

const suitFromAST = (hand: AST.Hand) => (suit: Suit) : ReadonlyArray<Card> =>
  pipe(hand[suit].cards,
    readonlyArray.map(card => ({ suit, rank: (RankC.decode(card.rank) as Right<Rank>).right })))

export const handFromAST = (hand: AST.Hand) : Hand =>
  pipe(suits,
    readonlyArray.map(suitFromAST(hand)),
    readonlyArray.flatten,
    readonlySet.fromReadonlyArray(eqCard))

export const parseHand = AST.parse