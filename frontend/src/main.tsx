/// <reference types="vite/client" />

import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
