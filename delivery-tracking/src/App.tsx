import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Tracking from './pages/Tracking';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track/:claimNumber" element={<Tracking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
