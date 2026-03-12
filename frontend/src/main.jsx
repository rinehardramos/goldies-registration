import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Sanitization for corrupted localStorage
try {
  const user = localStorage.getItem('user');
  if (user === 'undefined' || user === 'null') {
    localStorage.removeItem('user');
  }
} catch (e) {}

// Global error fallback to prevent blank pages
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `
      <div style="background: var(--maroon, #4a0404); color: white; padding: 2rem; border: 1px solid var(--gold, #d4af37); text-align: center; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1 style="color: var(--gold, #d4af37)">Something went wrong</h1>
        <p>The application encountered an error. This may be due to a connection issue with the server.</p>
        <button onclick="window.location.reload()" style="background: var(--gold, #d4af37); color: black; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-top: 1rem; font-weight: bold;">Reload Page</button>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
