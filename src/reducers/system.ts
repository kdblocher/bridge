import { either, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, string, tree } from 'fp-ts';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';
import memoize from 'proxy-memoize';

import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { validateTree } from '../model/constraints';
import { BidTree, flatten, getAllLeafPaths, getBidInfo, getPathUpTo, withImplicitPasses } from '../model/system';
import { decodeBid } from '../parse';

type BlockKey = string
const eqBlockKey : eq.Eq<BlockKey> = string.Eq

export type DecodedBid = ReturnType<typeof decodeBid>
interface ConstrainedBidItem {
  id: BlockKey
  value: DecodedBid
}
const constrainedBidAdapter = createEntityAdapter<ConstrainedBidItem>()

type BlockTree = tree.Forest<BlockKey>
interface State {
  system: BlockTree
  constrainedBids: ReturnType<typeof constrainedBidAdapter.getInitialState>
}

const initialState: State = {
  system: [],
  constrainedBids: constrainedBidAdapter.getInitialState()
}

export interface BlockKeyDescriptor {
  key: BlockKey
  depth: number
}
const buildForest = (items: ReadonlyArray<BlockKeyDescriptor>): BlockTree => {
  const root = tree.make<BlockKey>("ROOT")
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = {
      forest: [],
      value: item.key
    }
    parents[item.depth].forest.push(curr)
  })
  return root.forest
}

export interface BlockItem {
  key: string
  text: string
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<ReadonlyArray<BlockKeyDescriptor>>) => {
      state.system = pipe(buildForest(action.payload), castDraft)
    },
    removeConstraintsByBlockKey: (state, action: PayloadAction<RNEA.ReadonlyNonEmptyArray<BlockKey>>) => {
      constrainedBidAdapter.removeMany(state.constrainedBids, action.payload)
    },
    cacheSystemConstraints: (state, action: PayloadAction<RNEA.ReadonlyNonEmptyArray<BlockItem>>) => {
      constrainedBidAdapter.setMany(state.constrainedBids, pipe(
        action.payload,
        RNEA.map(i => ({ id: i.key, value: decodeBid(i.text) }))))
    }
  }
})

export const { setSystem, removeConstraintsByBlockKey, cacheSystemConstraints } = slice.actions

const constrainedBidSelectors = constrainedBidAdapter.getSelectors()

interface KeyedState {
  state: State
  key: BlockKey
}

export const selectPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(state.system,
    getPathUpTo(eqBlockKey)(key)))

const getCachedBidByKey = (constrainedBids: State['constrainedBids']) => (key: BlockKey) =>
  pipe(
    O.fromNullableK(constrainedBidSelectors.selectById)(constrainedBids, key),
    O.map(i => i.value))

export const selectBidByKey = memoize(({ state, key }: KeyedState) =>
  pipe(key,
    getCachedBidByKey(state.constrainedBids),
    O.chain(O.fromEither)))

export const selectBidPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(
    state.system,
    getPathUpTo(eqBlockKey)(key),
    O.getOrElse(() => RA.zero()),
    RA.filterMap(getCachedBidByKey(state.constrainedBids)),
    RA.sequence(either.Applicative)))

export const selectRules = memoize((state: State) =>
  pipe(state.system,
    flatten,
    RA.filterMap(getCachedBidByKey(state.constrainedBids))))

export const selectErrors = memoize(
  flow(
    selectRules,
    RA.lefts))

const getCompleteForest = (constrainedBids: State['constrainedBids']) =>
  RA.filterMap(flow(
    tree.traverse(O.Applicative)(flow(
      getCachedBidByKey(constrainedBids),
      O.chain(O.fromEither)))))

export const selectCompleteBidPathUpToKey = memoize(({ state, key }: KeyedState) =>
  pipe(state.system,
    getPathUpTo(eqBlockKey)(key),
    O.chain(keys => pipe(
      tree.unfoldTree<BlockKey, ReadonlyArray<BlockKey>>(keys, ([n0, ...ns]) =>
        [n0, ns.length === 0 ? [] : [ns]]),
      RA.of,
      getCompleteForest(state.constrainedBids),
      getBidInfo,
      getAllLeafPaths,
      RA.head))))

export const selectCompleteBidSubtree = memoize(({ state, options }: { state: State, options?: { implicitPass: boolean }} ): BidTree =>
  pipe(state.system,
    getCompleteForest(state.constrainedBids),
    options?.implicitPass ? withImplicitPasses : identity,
    getBidInfo))

export const selectAllCompleteBidPaths = memoize(
  flow(selectCompleteBidSubtree,
    getAllLeafPaths))

export const selectSystemValid = memoize(
  flow(selectCompleteBidSubtree,
    validateTree))
    
export default slice.reducer