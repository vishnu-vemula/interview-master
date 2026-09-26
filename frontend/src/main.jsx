/**
 * main.jsx — Application entry point
 *
 * Auth state is managed by Zustand (authStore) with localStorage persistence.
 * Admin auth state is managed by AdminAuthContext (separate context).
 * AppProvider handles UI-level global state (sidebar).
 * ConfirmProvider renders the design-system confirm dialog (useConfirm()).
 *
 * Provider order: QueryClientProvider → BrowserRouter → AdminAuthProvider → AppProvider → ConfirmProvider → App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppProvider, AdminAuthProvider } from '@/context';
import { ConfirmProvider } from '@/components/ui';
import App from './app';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AdminAuthProvider>
          <AppProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
            <Toaster
              position="top-right"
              gutter={10}
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#FFFFFF',
                  color: '#0E1116',
                  border: '1px solid #E6E9E4',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontFamily: 'Geist, system-ui, sans-serif',
                  padding: '12px 14px',
                  boxShadow: '0 24px 48px -20px rgba(14,17,22,0.28)',
                  maxWidth: '420px',
                },
                success: { iconTheme: { primary: '#0E1116', secondary: '#D7F94B' } },
                error: { iconTheme: { primary: '#B8431A', secondary: '#FFFFFF' } },
                loading: { iconTheme: { primary: '#1B82EC', secondary: '#DCEBFF' } },
              }}
            />
          </AppProvider>
        </AdminAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
