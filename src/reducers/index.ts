import { either, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function'
import generator, { analyzeDealsEpic, selectAllDeals } from './generator'
import { satisfiesPath, satisfiesPathWithoutSiblingCheck } from '../model/constraints'
import selection, { selectHand } from './selection'
import system, { selectAllCompleteBidPaths, selectBidsByKey } from './system'

import { AnyAction } from '@reduxjs/toolkit'
import { BidInfo } from '../model/system'
import { ContractBid } from '../model/bridge'
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray'
import { RootState } from '../app/store'
import { combineEpics } from 'redux-observable'

const reducers = {
  system,
  selection,
  generator
}
export default reducers

export const rootEpic = combineEpics<AnyAction, AnyAction, RootState>(analyzeDealsEpic)

export const selectHandsSatisfySelectedPath = (state: RootState) =>
  pipe(option.Do,
    option.apS('blockKey', state.selection.selectedBlockKey),
    option.apS('opener', selectHand(state.selection, 'opener')),
    option.apS('responder', selectHand(state.selection, 'responder')),
    option.chain(o => pipe(
      selectBidsByKey(state.system, o.blockKey),
      either.map(satisfiesPathWithoutSiblingCheck(o.opener, o.responder)),
      option.fromEither)),
    option.toNullable)

interface BidResult {
  path: ReadonlyNonEmptyArray<BidInfo>
  result: boolean
}
export const selectPathsSatisfyHands = (state: RootState) : ReadonlyArray<BidResult> | null =>
  pipe(option.Do,
    option.apS('opener', selectHand(state.selection, 'opener')),
    option.apS('responder', selectHand(state.selection, 'responder')),
    option.map(o => pipe(
      selectAllCompleteBidPaths(state.system),
      readonlyArray.map(path => ({
        path,
        result: satisfiesPath(o.opener, o.responder)(path)
      })))),
    option.toNullable)

interface BidCountResult {
  path: ReadonlyNonEmptyArray<BidInfo>
  count: number
}
const ordStats = pipe(
  number.Ord,
  ord.reverse,
  ord.contramap<number, BidCountResult>(r => r.count))

export const selectSatisfyStats = (state: RootState) : ReadonlyArray<BidCountResult> | null =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('deal', selectAllDeals(state.generator)),
    readonlyArray.apS('path', selectAllCompleteBidPaths(state.system)),
    readonlyArray.map(ra => ({
      path: ra.path,
      result: satisfiesPath(ra.deal[0], ra.deal[1])(ra.path)
    })),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.map(
      flow(
        readonlyNonEmptyArray.groupBy(x =>
          pipe(x.path,
            readonlyArray.map(p => p.bid as ContractBid),
            readonlyArray.foldMap(string.Monoid)(b => `${b.level}${b.strain}`))),
        readonlyRecord.map(r => ({
          path: r[0].path,
          count: pipe(r, readonlyArray.filter(a => a.result)).length
        })),
        readonlyRecord.toReadonlyArray,
        readonlyArray.map(readonlyTuple.snd),
        readonlyArray.sort(ordStats))),
    option.toNullable)