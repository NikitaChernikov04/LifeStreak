import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
// Cyrillic first — the interface is Russian, and every face below was chosen
// for having a real Cyrillic cut rather than a fallback.
import '@fontsource/pt-sans-narrow/cyrillic-400.css';
import '@fontsource/pt-sans-narrow/cyrillic-700.css';
import '@fontsource/pt-sans-narrow/latin-400.css';
import '@fontsource/pt-sans-narrow/latin-700.css';
import '@fontsource/ibm-plex-mono/cyrillic-400.css';
import '@fontsource/ibm-plex-mono/cyrillic-500.css';
import '@fontsource/ibm-plex-mono/cyrillic-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import './index.css';
import App from './App';
import { initTelegramApp } from './lib/telegram';

initTelegramApp();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
