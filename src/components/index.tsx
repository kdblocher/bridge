import Editor from './Editor';
import SelectionDetails from './SelectionDetails';
import Stats from './Stats';

const App = () => {
  return (
    <div className="App">
      <div style={{display: "inline-block", width: '50%'}}> 
        <Editor />
        ---
        <SelectionDetails />
        ---
        <Stats />
      </div>
      {/* <div style={{display: "inline-block", width: '50%'}}>
        <TestHand
      </div> */}
    </div>
  )
}

export default App
