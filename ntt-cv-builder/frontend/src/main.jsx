import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[App crash]', error.message, '\n', error.stack, '\n', info.componentStack)
  }
  render() {
    if (this.state.error) {
      const { fallback } = this.props
      if (fallback) return fallback(this.state.error)
      return (
        <div style={{
          fontFamily: 'monospace', padding: 32, color: '#f43f5e',
          background: '#07111f', minHeight: '100%',
        }}>
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>⚠ Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#fca5a5', marginBottom: 16 }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 16px', borderRadius: 7,
              background: '#f43f5e', border: 'none', color: 'white',
              fontSize: 13, cursor: 'pointer', marginRight: 10,
            }}
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px', borderRadius: 7,
              background: 'transparent', border: '1px solid #f43f5e',
              color: '#f43f5e', fontSize: 13, cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
