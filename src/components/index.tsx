import Editor from './Editor';
import SelectionDetails from './SelectionDetails';
import Settings from './Settings';
import Stats from './Stats';
import TestHands from './TestHands';

const App = () => {
  return (
    <div className="App">
      <div style={{display: "inline-block", width: '50%'}}>
        <div style={{float: "left"}}>
          <Editor />
        </div>
        <div style={{float: "right", width: "300px"}}>
          <Settings />
        </div>
        <div style={{clear: "both"}}>
          <Stats />
        </div>
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
