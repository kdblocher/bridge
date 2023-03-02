import { Link, Outlet } from 'react-router-dom';

const App = () => {
  return (
    <div className="App">
      <div>
        <div style={{ display: "inline-block", float: 'left' }}>
          <Link to="/design">Design</Link>
          &nbsp;|&nbsp;
          <Link to="/analyze">Analyze</Link>
        </div>
        <div style={{ display: "inline-block", float: 'right' }}>
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge#documentation">Documentation</a>
          &nbsp;|&nbsp;
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/discussions">Share ideas</a>
          &nbsp;|&nbsp;
          <a target="_blank" rel="noreferrer" href="https://github.com/kdblocher/bridge/issues/new">Report issue</a>
        </div>
      </div>
      <br />
      <Outlet />
    </div>
  )
}

export default App
