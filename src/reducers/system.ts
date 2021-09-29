import { PayloadAction, createSlice } from "@reduxjs/toolkit"
import { array, option, readonlyArray, tree } from 'fp-ts'
import { identity, pipe } from "fp-ts/lib/function"

import { castDraft } from 'immer'

interface Node {
  blockKey?: string
  text: string
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
  tree.fold<Node, option.Option<Node[]>>((node, path) => {
    if (node.blockKey === blockKey) {
      return option.some([node])
    } else {
      return pipe(path,
        array.findFirstMap(identity),
        option.map(array.prepend(node)))
    }
  })

const buildTree = (items: BlockItem[]) => {
  const root = getRoot()
  var parents = [root]
  items.forEach(item => {
    const curr = parents[item.depth + 1] = { value: { blockKey: item.key, text: item.text }, forest: [] }
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

export const selectPath = (state: State, blockKey: string) =>
  pipe(
    getPath(blockKey)(state.system),
    option.chain(array.tail),
    option.toNullable)


export default slice.reducer