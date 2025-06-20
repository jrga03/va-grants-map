import { Tooltip as ReactTooltip } from "react-tooltip";

import PHSvg from "./components/PHSvg";
import TooltipContent from "./components/TooltipContent";
import Legend from "./components/Legend";

function App() {
  return (
    <div className="h-full w-full flex items-center justify-center relative">
      <Legend />

      <PHSvg className="select-none outline-none" />
      <ReactTooltip
        id="region-tooltip"
        render={TooltipContent}
        float
        delayShow={100}
        variant="light"
      />
    </div>
  );
}

export default App;
