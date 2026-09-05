import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './state/store.js';
import { Layout } from './components/Layout.js';
import { Home } from './screens/Home.js';
import { FormatSelection } from './screens/FormatSelection.js';
import { Roll } from './screens/Roll.js';
import { Draft } from './screens/Draft.js';
import { PlayingXI } from './screens/PlayingXI.js';
import { Campaign } from './screens/Campaign.js';
import { Match } from './screens/Match.js';
import { ScorecardScreen } from './screens/ScorecardScreen.js';
import { Result } from './screens/Result.js';

/** Maiden application root. One store, route-level screens (§42). */
export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/format" element={<FormatSelection />} />
            <Route path="/roll" element={<Roll />} />
            <Route path="/draft" element={<Draft />} />
            <Route path="/xi" element={<PlayingXI />} />
            <Route path="/campaign" element={<Campaign />} />
            <Route path="/match" element={<Match />} />
            <Route path="/scorecard" element={<ScorecardScreen />} />
            <Route path="/result" element={<Result />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </StoreProvider>
  );
}
