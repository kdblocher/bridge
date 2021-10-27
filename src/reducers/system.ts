import { either, eq, option as O, readonlyArray as RA, readonlyNonEmptyArray as RNEA, string, tree } from 'fp-ts';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';

import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ConstraintPredicate, validateTree } from '../model/constraints';
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

interface CompiledConstraintItem {
  id: BlockKey
  value: ConstraintPredicate
}
const compiledConstraintAdapter = createEntityAdapter<CompiledConstraintItem>()

type BlockTree = tree.Forest<BlockKey>
interface State {
  system: BlockTree
  constrainedBids: ReturnType<typeof constrainedBidAdapter.getInitialState>
  compiledConstraints: ReturnType<typeof compiledConstraintAdapter.getInitialState>
}

const initialState: State = {
  system: [],
  constrainedBids: constrainedBidAdapter.getInitialState(),
  compiledConstraints: compiledConstraintAdapter.getInitialState(),
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
      compiledConstraintAdapter.removeMany(state.compiledConstraints, action.payload)
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

export const selectPathUpToKey = (state: State, blockKey: BlockKey) =>
  pipe(state.system,
    getPathUpTo(eqBlockKey)(blockKey))

const getCachedBidByKey = (constrainedBids: State['constrainedBids']) => (key: BlockKey) =>
  pipe(
    O.fromNullableK(constrainedBidSelectors.selectById)(constrainedBids, key),
    O.map(i => i.value))

export const selectBidByKey = (state: State, blockKey: BlockKey) =>
  pipe(blockKey,
    getCachedBidByKey(state.constrainedBids),
    O.chain(O.fromEither))

export const selectBidPathUpToKey = (state: State, blockKey: BlockKey) =>
  pipe(
    state.system,
    getPathUpTo(eqBlockKey)(blockKey),
    O.getOrElse(() => RA.zero()),
    RA.filterMap(getCachedBidByKey(state.constrainedBids)),
    RA.sequence(either.Applicative))

export const selectRules = (state: State) =>
  pipe(
    state.system,
    flatten,
    RA.filterMap(getCachedBidByKey(state.constrainedBids)))

export const selectErrors =
  flow(
    selectRules,
    RA.lefts)

const getCompleteForest = (constrainedBids: State['constrainedBids']) =>
  RA.filterMap(flow(
    tree.traverse(O.Applicative)(flow(
      getCachedBidByKey(constrainedBids),
      O.chain(O.fromEither)))))

export const selectCompleteBidPathUpToKey = (state: State, blockKey: string) =>
  pipe(selectPathUpToKey(state, blockKey),
    O.chain(keys => pipe(
      tree.unfoldTree<BlockKey, ReadonlyArray<BlockKey>>(keys, ([n0, ...ns]) =>
        [n0, ns.length === 0 ? [] : [ns]]),
      RA.of,
      getCompleteForest(state.constrainedBids),
      getBidInfo,
      getAllLeafPaths,
      RA.head)))

export const selectCompleteBidSubtree = (state: State, options?: { implicitPass: boolean }) : BidTree =>
  pipe(state.system,
    getCompleteForest(state.constrainedBids),
    options?.implicitPass ? withImplicitPasses : identity,
    getBidInfo)

export const selectAllCompleteBidPaths =
  flow(selectCompleteBidSubtree,
    getAllLeafPaths)

export const selectSystemValid =
  flow(selectCompleteBidSubtree,
    validateTree)
    
export default slice.reducer