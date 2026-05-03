import React from 'react';

function TestbedSelector({ setActiveComponent }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '20px',
      background: '#0F172A',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>🏙️ Testbed</h1>
      <p style={{ color: '#94A3B8', marginBottom: '40px' }}>Select a component to test</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <TestCard
          title="Onboarding"
          desc="Intro & Narrative Flow"
          onClick={() => setActiveComponent('onboarding')}
        />
        <TestCard
          title="City 1: Smallville"
          desc="Basic Simulation Levers"
          onClick={() => setActiveComponent('city1')}
        />
        <TestCard
          title="City 2: Riverdale"
          desc="Seasonal & Congestion Dynamics"
          onClick={() => setActiveComponent('city2')}
        />
        <TestCard
          title="City 3: Gilded Hollow"
          desc="Income Inequality Dynamics"
          onClick={() => setActiveComponent('city3')}
        />
        <TestCard
          title="City 4: Crestwood"
          desc="Gender Safety & Equity Dynamics"
          onClick={() => setActiveComponent('city4')}
        />
      </div>
    </div>
  );
}

function TestCard({ title, desc, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '30px',
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: '16px',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'transform 0.2s, border-color 0.2s',
        width: '200px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.borderColor = '#3B82F6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#334155';
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', color: '#FFF' }}>{title}</h3>
      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>{desc}</p>
    </div>
  );
}

export default TestbedSelector;
