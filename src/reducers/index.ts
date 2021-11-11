import { option, readonlyArray, these } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import memoize from 'proxy-memoize';
import { combineEpics } from 'redux-observable';

import { AnyAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { ConstrainedBid } from '../model/system/core';
import { satisfiesPath } from '../model/system/satisfaction';
import generator, { analyzeDealsEpic, analyzeResultsEpic, analyzeSatisfiesEpic, saveDealsToApiEpic, saveSolutionsToApiEpic } from './generator';
import selection, { selectHand } from './selection';
import settings from './settings';
import system, { selectAllCompleteBidPaths } from './system';

const reducers = {
  system,
  selection,
  generator,
  settings
}
export default reducers

export const rootEpic = combineEpics<AnyAction, AnyAction, RootState>(
  analyzeDealsEpic,
  analyzeSatisfiesEpic,
  analyzeResultsEpic,
  saveDealsToApiEpic,
  saveSolutionsToApiEpic)

interface BidResult {
  path: ReadonlyNonEmptyArray<ConstrainedBid>
  result: boolean
}

export const selectPathsSatisfyHands = memoize((state: RootState) : ReadonlyArray<BidResult> | null =>
  pipe(option.Do,
    option.apS('opener', selectHand({ state: state.selection, type: 'opener' })),
    option.apS('responder', selectHand({ state: state.selection, type: 'responder' })),
    option.apS('paths', pipe(selectAllCompleteBidPaths({ state: state.system, options: state.settings }), these.getRight)),
    option.map(o => pipe(o.paths,
      readonlyArray.map(path => ({
        path,
        result: satisfiesPath(o.opener, o.responder)(path)
      })))),
    option.toNullable))