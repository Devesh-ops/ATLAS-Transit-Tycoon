import { useState } from 'react'
import City1Game from './City1Game'
import City2Game from './City2Game'
import './App.css'

function App() {
  const [selectedGame, setSelectedGame] = useState(null)

  if (selectedGame === 'city1') {
    return (
      <div>
        <button
          onClick={() => setSelectedGame(null)}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 1000
          }}
        >
          ← Back to Menu
        </button>
        <City1Game />
      </div>
    )
  }

  if (selectedGame === 'city2') {
    return (
      <div>
        <button
          onClick={() => setSelectedGame(null)}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 1000
          }}
        >
          ← Back to Menu
        </button>
        <City2Game />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <h1 style={{
        color: 'white',
        fontSize: '48px',
        marginBottom: '20px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        🚇 ATLAS Transit Tycoon
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: '18px',
        marginBottom: '50px',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        Manage city transportation systems. Balance budgets, mobility, and citizen happiness.
      </p>

      <div style={{
        display: 'flex',
        gap: '30px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '30px',
          width: '300px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onClick={() => setSelectedGame('city1')}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h2 style={{ color: '#333', marginBottom: '15px', fontSize: '24px' }}>
            🏘️ City 1: Smallville
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px', lineHeight: '1.6' }}>
            A quiet city learning to move
          </p>
          <div style={{
            background: '#f0f0f0',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.6'
          }}>
            <div><strong>Population:</strong> 50,000</div>
            <div><strong>Budget:</strong> $12M/year</div>
            <div><strong>Focus:</strong> Tax vs Subsidy</div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
              Balance Uber taxes and bus subsidies. Learn the basics of transport policy.
            </div>
          </div>
          <button style={{
            width: '100%',
            marginTop: '20px',
            padding: '12px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            Play City 1
          </button>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '30px',
          width: '300px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onClick={() => setSelectedGame('city2')}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h2 style={{ color: '#333', marginBottom: '15px', fontSize: '24px' }}>
            🏙️ City 2: Riverdale
          </h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px', lineHeight: '1.6' }}>
            A growing city where not everyone is equal
          </p>
          <div style={{
            background: '#f0f0f0',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.6'
          }}>
            <div><strong>Population:</strong> 200,000</div>
            <div><strong>Budget:</strong> $30M/year</div>
            <div><strong>Focus:</strong> Equity & Seasons</div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
              Manage rich/poor divide. Adapt to seasonal weather. Keep everyone moving.
            </div>
          </div>
          <button style={{
            width: '100%',
            marginTop: '20px',
            padding: '12px',
            background: '#764ba2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            Play City 2
          </button>
        </div>
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.7)',
        fontSize: '14px',
        marginTop: '50px',
        textAlign: 'center'
      }}>
        Built with React + Vite
      </p>
    </div>
  )
}

export default App
