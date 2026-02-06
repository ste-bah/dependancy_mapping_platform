/**
 * Application Entry Point
 * Initializes React application with root component
 * @module main
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// ============================================================================
// Root Element
// ============================================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure there is a <div id="root"></div> in your HTML.'
  );
}

// ============================================================================
// Render Application
// ============================================================================

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
