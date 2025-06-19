import { Fragment } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";
import clsx from "clsx";
import { chunk } from "lodash-es";

import PHSvg from "./components/PHSvg";
import { REGION_MAP } from "./constants";

const BADGE_CLASS = {
  MMS: "bg-pink-50 text-pink-700 ring-pink-700/10",
  Deworming: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  VAS: "bg-green-50 text-green-700 ring-green-600/20",
  "VAS+D": "bg-purple-50 text-purple-700 ring-purple-700/10",
};

function TooltipContent({ content: id }) {
  const region = REGION_MAP.get(id);

  if (!region) return null;

  const { name, subdivisions } = region;

  const n = subdivisions.length;
  const chunkedSubdivisions = chunk(
    subdivisions,
    n > 20 ? (n > 35 ? Math.ceil(n / 3) : Math.ceil(n / 2)) : 25
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="font-semibold">{name}</div>
      <div className="flex gap-4 text-xs">
        {chunkedSubdivisions.map((subd, index) => (
          <div
            key={index}
            className="grid auto-cols-auto grid-cols-2 gap-x-2 gap-y-0.5 items-center justify-start"
          >
            {subd.map((subdivision) => (
              <Fragment key={subdivision.name}>
                <div>{subdivision.name}</div>
                <div className="flex gap-0.5">
                  {subdivision.programs.map((program) => (
                    <div
                      key={program}
                      className={clsx(
                        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-inset",
                        BADGE_CLASS[program]
                      )}
                    >
                      {program}
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex-1 w-full h-full">
        <PHSvg className="select-none outline-none" />
        <ReactTooltip
          id="region-tooltip"
          render={TooltipContent}
          float
          delayShow={100}
          variant="light"
        />
      </div>
    </div>
  );
}

export default App;
