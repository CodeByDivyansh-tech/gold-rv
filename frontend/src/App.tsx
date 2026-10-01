import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import MarketAnalysis from './pages/MarketAnalysis';
import Signals from './pages/Signals';
import Backtesting from './pages/Backtesting';
import Methodology from './pages/Methodology';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="market-analysis" element={<MarketAnalysis />} />
          <Route path="signals" element={<Signals />} />
          <Route path="backtesting" element={<Backtesting />} />
          <Route path="methodology" element={<Methodology />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
