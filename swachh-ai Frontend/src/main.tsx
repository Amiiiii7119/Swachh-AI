import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0a1628',
              color: '#c8d6e5',
              border: '1px solid rgba(0,212,212,0.3)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '13px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#0a1628' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#0a1628' },
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
