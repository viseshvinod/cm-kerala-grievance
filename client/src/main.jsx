import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DEMO } from './lib/api';
import App from './App';
import { AuthProvider } from './lib/auth';
import { MetaProvider } from './lib/meta';
import { ToastProvider } from './components/ui';
import './styles.css';

// Demo preview may run inside sandboxed frames with no usable URL (about:srcdoc), so it keeps routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <MetaProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </MetaProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
