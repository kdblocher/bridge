import { number, option, ord, readonlyArray, readonlyNonEmptyArray, readonlyRecord, readonlyTuple } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import memoize from 'proxy-memoize';
import { combineEpics } from 'redux-observable';

import { AnyAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { serializedBidPathL, SerializedDeal, serializedDealL } from '../model/serialization';
import { Path } from '../model/system';
import { ConstrainedBid } from '../model/system/core';
import { expandPath } from '../model/system/expander';
import { satisfiesPath } from '../model/system/satisfaction';
import generator, { analyzeDealsEpic, analyzeResultsEpic, saveDealsToApiEpic, saveSolutionsToApiEpic, selectAllDeals } from './generator';
import selection, { selectHand } from './selection';
import settings from './settings';
import system, { selectAllCompleteBidPaths, selectBidPathUpToKey } from './system';

const reducers = {
  system,
  selection,
  generator,
  settings
}
export default reducers

export const rootEpic = combineEpics<AnyAction, AnyAction, RootState>(
  analyzeDealsEpic,
  analyzeResultsEpic,
  saveDealsToApiEpic,
  saveSolutionsToApiEpic)

export const selectHandsSatisfySelectedPath = (state: RootState) =>
  pipe(option.Do,
    option.apS('key', state.selection.selectedBlockKey),
    option.apS('opener', selectHand({ state: state.selection, type: 'opener' })),
    option.apS('responder', selectHand({ state: state.selection, type: 'responder' })),
    option.chain(o => pipe(
      selectBidPathUpToKey({ state: state.system, key: o.key }),
      option.fromEither,
      option.chain(readonlyNonEmptyArray.fromReadonlyArray),
      option.chain(option.fromEitherK(expandPath)),
      option.map(satisfiesPath(o.opener, o.responder)))),
    option.toNullable)

interface BidResult {
  path: ReadonlyNonEmptyArray<ConstrainedBid>
  result: boolean
}
export const selectPathsSatisfyHands = memoize((state: RootState) : ReadonlyArray<BidResult> | null =>
  pipe(option.Do,
    option.apS('opener', selectHand({ state: state.selection, type: 'opener' })),
    option.apS('responder', selectHand({ state: state.selection, type: 'responder' })),
    option.apS('paths', option.fromEitherK(selectAllCompleteBidPaths)({ state: state.system, options: state.settings })),
    option.map(o => pipe(o.paths,
      readonlyArray.map(path => ({
        path,
        result: satisfiesPath(o.opener, o.responder)(path)
      })))),
    option.toNullable))

export interface BidPathResult {
  path: Path<ConstrainedBid>
  count: number
  deals: ReadonlyNonEmptyArray<SerializedDeal>
}
const ordStats = pipe(
  number.Ord,
  ord.reverse,
  ord.contramap<number, BidPathResult>(r => r.count))

export const selectSatisfyStats = memoize((state: RootState) : ReadonlyArray<BidPathResult> | null =>
  pipe(readonlyArray.Do,
    readonlyArray.apS('deal', selectAllDeals(state.generator)),
    readonlyArray.apS('path', pipe(
      option.fromEitherK(selectAllCompleteBidPaths)({ state: state.system, options: state.settings }),
      option.getOrElseW(() => readonlyArray.empty))),
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
            readonlyNonEmptyArray.map(p => p.bid),
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
    option.toNullable))