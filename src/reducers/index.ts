import { option, readonlyArray } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { ReadonlyNonEmptyArray } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import memoize from 'proxy-memoize';
import { combineEpics } from 'redux-observable';

import { AnyAction } from '@reduxjs/toolkit';

import { RootState } from '../app/store';
import { ConstrainedBid } from '../model/system/core';
import { satisfiesPath } from '../model/system/satisfaction';
import generator, { epics as generatorEpics } from './generator';
import profile, { epics as profileEpics } from './profile';
import selection, { selectHand } from './selection';
import settings from './settings';
import system, { selectValidConstrainedBidPaths } from './system';

const reducers = {
  system,
  selection,
  generator,
  settings,
  profile
}
export default reducers

export const rootEpic = combineEpics<AnyAction, AnyAction, RootState>(
  ...generatorEpics,
  ...profileEpics
)

interface BidResult {
  path: ReadonlyNonEmptyArray<ConstrainedBid>
  result: boolean
}

export const selectPathsSatisfyHands = memoize((state: RootState) : ReadonlyArray<BidResult> | null =>
  pipe(option.Do,
    option.apS('opener', selectHand({ state: state.selection, type: 'opener' })),
    option.apS('responder', selectHand({ state: state.selection, type: 'responder' })),
    option.apS('paths', pipe(selectValidConstrainedBidPaths({ state: state.system, options: state.settings }))),
    option.map(o => pipe(o.paths,
      readonlyArray.map(path => ({
        path,
        result: satisfiesPath(o.opener, o.responder)(path)
      })))),
    option.toNullable))