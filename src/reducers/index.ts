import { AnyAction } from '@reduxjs/toolkit';
import { either, number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import { combineEpics } from 'redux-observable';
import { RootState } from '../app/store';
import { ContractBid } from '../model/bridge';
import { satisfiesPath, satisfiesPathWithoutSiblingCheck } from '../model/constraints';
import { serializedBidPathL, SerializedDeal, serializedDealL } from '../model/serialization';
import { BidInfo } from '../model/system';
import generator, { analyzeDealsEpic, analyzeResultsEpic, saveDealsToApiEpic, saveSolutionsToApiEpic, selectAllDeals } from './generator';
import selection, { selectHand } from './selection';
import system, { selectAllCompleteBidPaths, selectBidsByKey } from './system';



const reducers = {
  system,
  selection,
  generator
}
export default reducers

export const rootEpic = combineEpics<AnyAction, AnyAction, RootState>(
  analyzeDealsEpic,
  analyzeResultsEpic,
  saveDealsToApiEpic,
  saveSolutionsToApiEpic)

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

export interface BidPathResult {
  path: ReadonlyNonEmptyArray<BidInfo>
  count: number
  deals: ReadonlyNonEmptyArray<SerializedDeal>
}
const ordStats = pipe(
  number.Ord,
  ord.reverse,
  ord.contramap<number, BidPathResult>(r => r.count))

export const selectSatisfyStats = (state: RootState) : ReadonlyArray<BidPathResult> | null =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('deal', selectAllDeals(state.generator)),
    readonlyArray.apS('path', selectAllCompleteBidPaths(state.system)),
    readonlyArray.map(ra => ({
      deal: ra.deal,
      path: ra.path,
      result: pipe(ra.deal, serializedDealL.reverseGet, d => satisfiesPath(d["N"], d["S"]))(ra.path)
    })),
    readonlyNonEmptyArray.fromReadonlyArray,
    option.map(
      flow(
        readonlyNonEmptyArray.groupBy(x =>
          pipe(x.path,
            readonlyNonEmptyArray.map(p => p.bid as ContractBid),
            serializedBidPathL.get)),
        readonlyRecord.filterMap(flow(
          readonlyNonEmptyArray.filter(a => a.result),
          option.map(r => ({
            path: r[0].path,
            count: r.length,
            deals: pipe(r, readonlyNonEmptyArray.map(x => x.deal)),
          })))),
        readonlyRecord.toReadonlyArray,
        readonlyArray.map(readonlyTuple.snd),
        readonlyArray.sort(ordStats))),
    option.toNullable)