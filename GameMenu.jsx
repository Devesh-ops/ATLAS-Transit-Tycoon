import React, { useState, useEffect } from 'react';

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  muted: '#94A3B8',
  accent: '#3B82F6',
  locked: '#1E293B',
  gold: '#F59E0B',
  red: '#EF4444',
};

const CITIES = [
  { id: 'city1', name: 'Smallville', desc: 'Autonomous Arrival', icon: '🏙️', theme: '#10B981' },
  { id: 'city2', name: 'Riverdale', desc: 'Seasonal Storms', icon: '🌊', theme: '#3B82F6' },
  { id: 'city3', name: 'Gilded Hollow', desc: 'The Wealth Divide', icon: '⚖️', theme: '#F59E0B' },
  { id: 'city4', name: 'Crestwood', desc: 'The Final Frontier', icon: '🏔️', theme: '#8B5CF6' },
];

function GameMenu({ onSelectCity, onStartOnboarding, progress = [] }) {
  const [hovered, setHovered] = useState(null);
  const [activeSaves, setActiveSaves] = useState({});
  const [confirmRestart, setConfirmRestart] = useState(null);

  useEffect(() => {
    const saves = {};
    CITIES.forEach(city => {
      const saved = localStorage.getItem(`atlas_save_${city.id}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // If the city was completed (screen === 'yearEnd' or 'gameComplete'), we don't count it as active run
          if (data.screen !== 'yearEnd' && data.screen !== 'gameComplete') {
            saves[city.id] = data.roundIndex;
          }
        } catch(e) {}
      }
    });
    setActiveSaves(saves);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '60px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient Background Elements */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        pointerEvents: 'none',
      }} />

      {/* Floating Glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '5%',
        width: '400px',
        height: '400px',
        background: `${C.accent}11`,
        filter: 'blur(100px)',
        borderRadius: '50%',
        animation: 'float 20s infinite alternate',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: '500px',
        height: '500px',
        background: '#10B98111',
        filter: 'blur(120px)',
        borderRadius: '50%',
        animation: 'float 25s infinite alternate-reverse',
        pointerEvents: 'none',
      }} />

      <style>
        {`
          @keyframes float {
            0% { transform: translate(0, 0) rotate(0deg); }
            100% { transform: translate(100px, 50px) rotate(10deg); }
          }
        `}
      </style>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '80px' }}>
        <h1 style={{ 
          fontSize: '4.5rem', 
          fontWeight: 900, 
          margin: 0, 
          letterSpacing: '-2px',
          background: 'linear-gradient(to bottom, #FFFFFF 0%, #94A3B8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          THE MOBILITY LAB
        </h1>
        <div style={{ 
          fontSize: '1.2rem', 
          fontWeight: 600, 
          color: C.accent, 
          letterSpacing: '8px', 
          textTransform: 'uppercase',
          marginTop: '-10px'
        }}>
          Simulation Environment
        </div>
      </div>

      {/* Career Progress Card */}
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '60px'
      }}>
        {CITIES.map((city, idx) => {
          const hasTutorial = progress.includes('tutorial');
          const isUnlocked = idx === 0 ? hasTutorial : progress.includes(CITIES[idx - 1].id);
          const isCompleted = progress.includes(city.id);
          const activeMonthIdx = activeSaves[city.id];
          const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          
          return (
            <div
              key={city.id}
              onClick={() => {
                if (!isUnlocked && idx === 0) {
                  alert("Please complete the Tutorial first to unlock City 1.");
                  onStartOnboarding();
                } else if (isUnlocked) {
                  onSelectCity(city.id);
                }
              }}
              onMouseEnter={() => isUnlocked && setHovered(city.id)}
              onMouseLeave={() => {
                setHovered(null);
                setConfirmRestart(null);
              }}
              style={{
                background: isUnlocked ? C.card : 'rgba(30, 41, 59, 0.4)',
                border: `1px solid ${hovered === city.id ? city.theme : C.border}`,
                borderRadius: '24px',
                padding: '32px 24px',
                cursor: isUnlocked ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hovered === city.id ? 'translateY(-8px) scale(1.02)' : 'scale(1)',
                boxShadow: hovered === city.id 
                  ? `0 20px 40px -12px ${city.theme}44` 
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Status Badge */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                fontSize: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px'
              }}>
                {!isUnlocked ? '🔒' : isCompleted ? '✅' : ''}
                {activeMonthIdx !== undefined && (
                  <div style={{ 
                    fontSize: '0.65rem', 
                    background: C.accent, 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    In Progress
                  </div>
                )}
              </div>

              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{city.icon}</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 700 }}>{city.name}</h3>
              <p style={{ margin: 0, color: C.muted, fontSize: '0.9rem', lineHeight: 1.5 }}>{city.desc}</p>
              
              {isUnlocked && (
                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCity(city.id);
                    }}
                    style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      color: city.theme,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      flex: 1,
                      opacity: hovered === city.id ? 1 : 0.8,
                      textDecoration: hovered === city.id ? 'underline' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    {activeMonthIdx !== undefined ? `Resume: ${MONTHS[activeMonthIdx]}` : isCompleted ? 'Revisit City' : 'Begin Mission'}
                  </div>
                  
                  {activeMonthIdx !== undefined && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmRestart === city.id) {
                          localStorage.removeItem(`atlas_save_${city.id}`);
                          const newSaves = { ...activeSaves };
                          delete newSaves[city.id];
                          setActiveSaves(newSaves);
                          setConfirmRestart(null);
                        } else {
                          setConfirmRestart(city.id);
                        }
                      }}
                      onMouseLeave={() => setConfirmRestart(null)}
                      style={{
                        background: confirmRestart === city.id ? C.red : 'transparent',
                        border: `1px solid ${confirmRestart === city.id ? C.red : C.border}`,
                        color: confirmRestart === city.id ? 'white' : C.muted,
                        borderRadius: '8px',
                        padding: confirmRestart === city.id ? '6px 12px' : '4px 10px',
                        fontSize: confirmRestart === city.id ? '0.75rem' : '0.65rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: confirmRestart === city.id ? `0 4px 12px ${C.red}44` : 'none'
                      }}
                    >
                      {confirmRestart === city.id ? 'CONFIRM?' : 'RESTART'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global Actions */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={onStartOnboarding}
          style={{
            padding: '16px 32px',
            background: 'transparent',
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          {progress.includes('tutorial') ? 'Review Tutorial' : 'Start Tutorial'}
        </button>
        <button 
          onClick={() => {
            const hasTutorial = progress.includes('tutorial');
            if (!hasTutorial) {
              onStartOnboarding();
              return;
            }
            
            // Check for active saves first
            const activeCityId = Object.keys(activeSaves)[0];
            if (activeCityId) {
              onSelectCity(activeCityId);
              return;
            }

            // Otherwise go to latest unlocked
            let latest = 'city1';
            if (progress.includes('city1')) latest = 'city2';
            if (progress.includes('city2')) latest = 'city3';
            if (progress.includes('city3')) latest = 'city4';
            onSelectCity(latest);
          }}
          style={{
            padding: '16px 48px',
            background: C.accent,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 10px 15px -3px ${C.accent}44`,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        >
          {Object.keys(activeSaves).length > 0 ? 'Resume Career' : 'Continue Career'}
        </button>
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: 'auto', paddingTop: '60px', textAlign: 'center', opacity: 0.5 }}>
        <div style={{ fontSize: '0.8rem', color: C.muted }}>
          Powered by research from Christensen & Osman (2025)
        </div>
      </div>
    </div>
  );
}

export default GameMenu;
