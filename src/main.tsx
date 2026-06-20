// React ルート。#app に App をマウントする。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

const container = document.getElementById('app');
if (container) {
  container.removeAttribute('aria-busy');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
