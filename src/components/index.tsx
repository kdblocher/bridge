import Editor from './Editor';
import Errors from './Errors';
import SelectionDetails from './SelectionDetails';
import Stats from './Stats';
import TestHands from './TestHands';
import styled from 'styled-components';

const DivBorder = styled.div `
  border: 1px grey solid;
  margin: 5px;
  padding: 15px;  
  min-height: 500px
`

const LeftSide = () => 
  <div style={{display: "inline-block", width: '50%', verticalAlign: "top"}}>
    <DivBorder>
      <Editor />
      <Errors />
      <Stats />
    </DivBorder>      
  </div>

const Navigation = () => 
  <div style={{width:"100%", textAlign: "right", marginBottom: "15px"}}>
      <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge#documentation">Documentation</a>
        &nbsp;|&nbsp;
      <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/discussions">Share ideas</a>
        &nbsp;|&nbsp;
      <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/issues/new">Report issue</a>
  </div>

const Title = () => 
  <div style={{width:"100%", textAlign: "center"}}>
    <h1 style={{margin: "0px"}}>Bridge Analysis Tool</h1>
  </div>

const RightSide = () => 
  <div style={{display: "inline-block", width: '50%', verticalAlign: "top"}}>
    <DivBorder>
      <TestHands />
      <SelectionDetails />
    </DivBorder>
</div>

const App = () => {
  return (
    <div className="App">
      <Title />
      <Navigation />
      <LeftSide></LeftSide>
      <RightSide></RightSide>
    </div>
  )
}

export default App
