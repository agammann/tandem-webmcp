import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TandemApp } from './components/tandem-app';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><TandemApp /></StrictMode>,
);
