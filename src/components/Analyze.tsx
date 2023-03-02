import Analyses from "./Analyses"
import Editor from "./Editor"
import Jobs from "./Jobs"

const Analyze = () => {
  return (
    <>
      <div style={{ clear: 'both', display: "inline-block", width: '50%' }}>
        <div style={{ float: "left" }}>
          <Editor />
        </div>
        <div style={{ clear: "both" }}>
          <Jobs />
          {/* <Stats /> */}
        </div>
      </div>
      <div style={{ display: "inline-block", width: '50%', float: "right" }}>
        <Analyses />
      </div>
    </>
  )
}

export default Analyze