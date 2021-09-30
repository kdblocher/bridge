import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { option, readonlyArray, tree } from 'fp-ts'
import { identity, pipe } from "fp-ts/lib/function"
import { parse, ParseResult } from '../model/bid'

interface Node {
  blockKey?: string
  text: string
  rule?: ParseResult
}
export interface BlockItem {
  key: string
  text: string
  depth: number
}

type State = {
  system: tree.Tree<Node>
}
const getRoot = () => tree.make<Node>({ text: "root" })
const initialState: State = {
  system: getRoot()
}

const getPath = (blockKey: string) =>
  tree.fold<Node, option.Option<ReadonlyArray<Node>>>((node, path) => {
    if (node.blockKey === blockKey) {
      return option.some([node])
    } else {
      return pipe(path,
        readonlyArray.findFirstMap(identity),
        option.map(readonlyArray.prepend(node)))
    }
  })

const flatten =
  tree.reduce<Node, readonly Node[]>([], (items, a) =>
    pipe(items, readonlyArray.append(a)))

const buildTree = (items: BlockItem[]) => {
  const root = getRoot()
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = { value: { blockKey: item.key, text: item.text, rule: parse(item.text) }, forest: [] }
    parents[item.depth].forest.push(curr)
  })
  return root
}

const name = 'system'
const slice = createSlice({
  name,
  initialState,
  reducers: {
    setSystem: (state, action: PayloadAction<BlockItem[]>) => {
      state.system = buildTree(action.payload)
    }
  }
})

export const { setSystem } = slice.actions

export const selectNode = (state: State, blockKey: string) =>
  pipe(getPath(blockKey)(state.system),
    option.chain(readonlyArray.last),
    option.toNullable)

export const selectPath = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    option.chain(readonlyArray.tail),
    option.toNullable)

export const selectRules = (state: State) =>
  pipe(
    state.system,
    flatten,
    readonlyArray.map(n => option.fromNullable(n.rule)),
    readonlyArray.compact,
  )

export default slice.reducer