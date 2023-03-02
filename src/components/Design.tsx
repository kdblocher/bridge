import Editor from "./Editor"
import Errors from "./Errors"
import SelectionDetails from "./SelectionDetails"
import TestHands from "./TestHands"

const Design = () => {
  return (
    <>
      <div style={{ clear: 'both', display: "inline-block", width: '50%' }}>
        <div style={{ float: "left" }}>
          <Editor />
        </div>
        <div style={{ clear: "both" }}>
          <Errors />
        </div>
      </div>
      <div style={{ display: "inline-block", width: '50%', float: "right" }}>
        <TestHands />
        {/* <SystemDetails /> */}
        <SelectionDetails />
      </div>
    </>
  )
}

export default Design