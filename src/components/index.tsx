import Editor from './Editor';
import SelectionDetails from './SelectionDetails';
import Stats from './Stats';
import TestHands from './TestHands';

const App = () => {
  return (
    <div className="App">
      <div style={{display: "inline-block", width: '50%'}}>
        <Editor />
        ---
        <Stats />
      </div>
      <div style={{display: "inline-block", width: '50%', float: "right"}}>
        <div style={{display: "inline-block", float: 'right'}}>
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge#documentation">Documentation</a>
          &nbsp;|&nbsp;
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/discussions">Share ideas</a>
          &nbsp;|&nbsp;
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/issues/new">Report issue</a>
        </div>
        <TestHands />
        <SelectionDetails />
      </div>
    </div>
  )
}

export default App
