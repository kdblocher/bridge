import { Editor, EditorState, getDefaultKeyBinding, RichUtils } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import React, { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { BlockItem, selectNode, selectPath, selectRules, setSystem } from '../reducers/system';

// import { useAppDispatch } from '../app/hooks';

const getItemsFromBlocks = (editorState: EditorState) =>
  editorState.getCurrentContent().getBlockMap().toArray().map<BlockItem>(x => ({
    key: x.getKey(),
    text: x.getText(),
    depth: x.getDepth()
  }))

const App = () => {
  const [editorState, setEditorState] = React.useState(() => EditorState.createEmpty());
  const dispatch = useAppDispatch()
  const [selected, setSelected] = React.useState<string | null>(() => null)

  const onChange = useCallback((editorState: EditorState) => {
    setEditorState(editorState)
    dispatch(setSystem(getItemsFromBlocks(editorState)))
    setSelected(editorState.getSelection().getFocusKey())
  }, [dispatch])

  const path = useAppSelector(state => {
    return selected ? selectPath(state.system, selected) : null
  })

  const node = useAppSelector(state => selected ? selectNode(state.system, selected) : null)

  const rules = useAppSelector(state => selectRules(state.system))
  
  useEffect(() => {
    setEditorState(() => RichUtils.toggleBlockType(editorState, 'unordered-list-item'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  return (
    <div className="App"> 
      <Editor
        editorState={editorState}
        onChange={onChange}
        // https://github.com/facebook/draft-js/blob/master/examples/draft-0-10-0/rich/rich.html#L61
        keyBindingFn={e => {
          if (e.keyCode === 9 /* TAB */) {
            const newEditorState = RichUtils.onTab(e, editorState, 10, /* maxDepth */);
            if (newEditorState !== editorState) {
              onChange(newEditorState)
            }
            return null;
          }
          return getDefaultKeyBinding(e);
        }}
      />
      ---
      <div>
        <h3>Selected Path</h3>
        {path?.map(x => x.text).join(" > ")}
        <h3>Selected Rule</h3>
        {pipe(node?.rule?.ast, option.fromNullable, option.map(JSON.stringify), option.toNullable)}
        <h3>Errors</h3>
        <ul>
          {rules.flatMap(r => r.errs).map(e => <li>Char {e.pos.offset}: One of {e.expmatches.map(x => x.kind === "EOF" ? " EOF" : ` ${x.negated ? 'not ': ''}'${x.literal}'`)}</li>)}
        </ul>
      </div>
      {/* <JSONTree data={editorState} /> */}
    </div>
  )
}

export default App
