import { GlobeView } from "./components/GlobeView";
import { HUD } from "./components/HUD";
import { mockConjunctions } from "./data/mock/conjunctions";
import { mockSatellites } from "./data/mock/satellites";
import { mockSpaceWeather } from "./data/mock/spaceWeather";

export const App = (): JSX.Element => (
  <div className="relative h-screen w-screen overflow-hidden bg-[var(--aurora-bg)]">
    <GlobeView
      satellites={mockSatellites}
      conjunctions={mockConjunctions}
      spaceWeather={mockSpaceWeather}
    />
    <HUD
      satellites={mockSatellites}
      conjunctions={mockConjunctions}
      spaceWeather={mockSpaceWeather}
    />
  </div>
);
