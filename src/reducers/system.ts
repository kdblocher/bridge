import { either, eq, option as O, predicate, readonlyArray as RA, readonlyNonEmptyArray as RNEA, separated, state, tree } from 'fp-ts';
import { modify } from 'fp-ts/lib/FromState';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { castDraft } from 'immer';

import { createEntityAdapter, createSlice, EntityState, PayloadAction } from '@reduxjs/toolkit';

import { Bid, eqBid } from '../model/bridge';
import { BidContext, ConstrainedBid, validateTree } from '../model/constraints';
import { Hand } from '../model/deck';
import { BidTree, extendWithSiblings, filterIncomplete, getAllLeafPaths, pathsWithoutRoot } from '../model/system';
import { decodeBid } from '../parse';

export type DecodedBid = ReturnType<typeof decodeBid>
interface Node {
  blockKey: string
  text: string
  bid: O.Option<DecodedBid>
}

interface CompiledConstraint {
  id: string
  f: state.State<BidContext, predicate.Predicate<Hand>>
}
const constraintAdapter = createEntityAdapter<CompiledConstraint>()

interface State {
  system: tree.Tree<Node>
  constraints: EntityState<CompiledConstraint>
}

const getRoot = () => tree.make<Node>({ blockKey: "root", text: "root", bid: O.none })
const initialState: State = {
  system: getRoot(),
  constraints: constraintAdapter.getInitialState()
}

const getPath = (blockKey: string) =>
  pathsWithoutRoot(O.Functor)((node: Node, paths: ReadonlyArray<O.Option<RNEA.ReadonlyNonEmptyArray<Node>>>) => {
    if (node.blockKey === blockKey) {
      return O.some([node])
    } else {
      return pipe(paths, RA.findFirstMap(O.map(RA.prepend(node))))
    }
  })

const flatten =
  tree.reduce<Node, ReadonlyArray<Node>>([], (items, a) =>
    pipe(items, RA.append(a)))

export interface BlockItem {
  key: string
  text: string
  depth: number
}

const buildTree = (items: ReadonlyArray<BlockItem>) => {
  const root = getRoot()
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = {
      forest: [],
      value: {
        blockKey: item.key,
        text: item.text,
        bid: O.some(decodeBid(item.text))
      }
    }
    parents[item.depth].forest.push(curr)
  })
  return root
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<ReadonlyArray<BlockItem>>) => {
      state.system = pipe(buildTree(action.payload), castDraft)
    },
    removeConstraintsByBlockKey: (state, action: PayloadAction<ReadonlyArray<string>>) => {
      constraintAdapter.removeMany(state.constraints, action.payload)
    },
    cacheSystemConstraints: (state, action: PayloadAction<ReadonlyArray<BlockItem>>) => {
      // constraintAdapter.setMany(state.constraints, action.payload)
    }
  }
})

export const { setSystem, removeConstraintsByBlockKey, cacheSystemConstraints } = slice.actions

export const selectNodeByKey = (state: State, blockKey: string) =>
  pipe(
    state.system,
    getPath(blockKey),
    O.chain(RA.last),
    O.toNullable)

export const selectPathByKey = (state: State, blockKey: string) =>
  pipe(
    state.system,
    getPath(blockKey),
    O.toNullable)

export const selectBidsByKey = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    O.getOrElse(() => [] as ReadonlyArray<Node>),
    RA.map(n => n.bid),
    RA.compact,
    RA.sequence(either.Applicative))

export const selectRules = (state: State) =>
  pipe(
    state.system,
    flatten,
    RA.map(n => n.bid),
    RA.compact,
  )

export const selectErrors =
  flow(
    selectRules,
    RA.separate,
    separated.left)

const getCompleteByTree =
  flow(
    tree.map((n: Node) => n.bid),
    filterIncomplete)

const getCompleteTree = (state: State) =>
  getCompleteByTree(state.system)

export const selectCompleteByKey = (state: State, blockKey: string) =>
  pipe(selectPathByKey(state, blockKey),
    O.fromNullable,
    O.chain(nodes => pipe(
      tree.unfoldTree([getRoot().value, ...nodes], ([n0, ...ns]) => {
        // debugger
        return [n0, ns.length === 0 ? [] : [ns]]
      }),
      getCompleteByTree,
      extendWithSiblings(eq.contramap<Bid, ConstrainedBid>(c => c.bid)(eqBid)),
      getAllLeafPaths,
      RA.head)),
    O.toNullable)

const withImplicitPasses =
  tree.fold((a: ConstrainedBid, bs: tree.Forest<ConstrainedBid>) =>
    bs.length === 0 || pipe(bs, RA.exists(t => t.value.bid === "Pass"))
    ? tree.make(a, bs)
    : tree.make(a, pipe(bs,
      RA.append(tree.make<ConstrainedBid>({ bid: "Pass", constraint: { type: "Otherwise" }})),
      RA.toArray)))

export const selectCompleteBidSubtree = (state: State, options?: { implicitPass: boolean }) : BidTree =>
  pipe(state,
    getCompleteTree,
    options?.implicitPass ? withImplicitPasses : identity,
    extendWithSiblings(eq.contramap<Bid, ConstrainedBid>(c => c.bid)(eqBid)))

export const selectAllCompleteBidPaths =
  flow(selectCompleteBidSubtree,
    getAllLeafPaths)

export const selectSystemValid =
  flow(selectCompleteBidSubtree,
    validateTree)
    

export default slice.reducer