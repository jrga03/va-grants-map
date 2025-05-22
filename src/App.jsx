import { Tooltip as ReactTooltip } from "react-tooltip";

import PHSvg from "./components/PHSvg";
import { REGION_MAP } from "./constants";

function App() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex-1 w-full h-full">
        <PHSvg className="select-none outline-none" />
        <ReactTooltip
          id="region-tooltip"
          render={({ content }) => (
            <span>
              {REGION_MAP.get(content) ?? "Unknown region"}
              {/* <br />
              Relevant attribute:{" "}
              {activeAnchor?.getAttribute("data-some-relevant-attr") || "not set"} */}
            </span>
          )}
          float
        />
      </div>
    </div>
  );
}

export default App;
