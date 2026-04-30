import React, { useEffect, useState } from 'react';

const STUDENTS = [
  {
    name: 'Dev Shah',
    major: 'Computer Science and Economics',
    bio: 'Driven by curiosity and discipline, focused on building meaningful solutions at the intersection of technology and real-world impact.',
  },
  {
    name: 'Devesh Kayal',
    major: 'Mathematics and Econometrics',
    bio: 'Aiming to prove that business evolution and planetary health can, and should, thrive together.',
  },
  {
    name: 'Xinhang(Carol) Li',
    major: 'Economics',
    bio: 'Focusing on leveraging economic insights and technology to build solutions that address real-world challenges.',
  },
];

function TeamContent() {
  return (
    <div style={{ padding: '30px', flex: 1, color: '#3D3830', fontSize: '15px', lineHeight: 1.7 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
        {STUDENTS.map((s) => (
          <div key={s.name} style={{ padding: '18px 20px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #D4CFC6' }}>
            <div style={{ fontSize: '13px', color: '#6B6358', marginBottom: '1px' }}>
              <strong style={{ color: '#1A1714' }}>Name:</strong> {s.name}
            </div>
            <div style={{ fontSize: '13px', color: '#6B6358', marginBottom: '8px' }}>
              <strong style={{ color: '#1A1714' }}>Major:</strong> {s.major}
            </div>
            <div style={{ fontSize: '13px', color: '#6B6358' }}>
              <strong style={{ color: '#1A1714' }}>Bio:</strong> {s.bio}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '14px', color: '#3D3830', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1A1714', marginBottom: '10px' }}>Professor Adam Osman</div>
        <p style={{ margin: '0 0 12px' }}>
          Associate Professor of Economics at the University of Illinois Urbana-Champaign, specializing in development economics. Research leverages randomized experiments, machine learning, and economic theory to evaluate policies aimed at improving welfare.
        </p>
        <p style={{ margin: 0 }}>
          Co-Scientific Director of J-PAL Middle East North Africa, with extensive fieldwork across the Middle East and other regions.
        </p>
      </div>
    </div>
  );
}

export function AboutUsContent() {
  return (
    <div style={{ padding: '30px', flex: 1, color: '#3D3830', fontSize: '15px', lineHeight: 1.7, textAlign: 'left' }}>
      <p>
        Welcome to ATLAS Transit Tycoon, an experiment in managing the chaotic transition to autonomous vehicles and ride-hailing services.
      </p>
      <p>
        The cities you play through simulate the very real, structural challenges urban planners face: from unchecked congestion to structural inequality and access barriers that simple technological fixes cannot solve alone.
      </p>

      <div style={{ marginTop: '24px', padding: '18px 20px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #86EFAC' }}>
        <h3 style={{ margin: '0 0 8px', color: '#166534', fontSize: '15px' }}>📄 Research Papers</h3>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#3D3830' }}>
          This game is based on the following academic research on urban mobility and transport equity.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="/Demand_for_Mobility_Christensen_Osman-Sep2025.pdf"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #86EFAC', borderRadius: '8px', textDecoration: 'none', color: '#1A1714', fontSize: '13px', fontWeight: 600 }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#DCFCE7'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
          >
            Demand for Mobility — Christensen &amp; Osman (2025) ↗
          </a>
          <a
            href="/COS-Weathering-the-Ride.pdf"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #86EFAC', borderRadius: '8px', textDecoration: 'none', color: '#1A1714', fontSize: '13px', fontWeight: 600 }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#DCFCE7'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
          >
            Weathering the Ride — Christensen, Osman &amp; Svane (2023) ↗
          </a>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '18px 20px', background: '#F5F3FF', borderRadius: '12px', border: '1px solid #C4B5FD' }}>
        <h3 style={{ margin: '0 0 10px', color: '#6D28D9', fontSize: '16px' }}>Help Us Improve!</h3>
        <p style={{ margin: '0 0 15px', fontSize: '14px', color: '#3D3830' }}>
          We're constantly refining our simulation models and gameplay mechanics. We would love to hear your thoughts.
        </p>
        <a
          href="https://forms.gle/gXmrN1UNKQLN1uaQ6"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            background: '#6D28D9',
            color: 'white',
            textDecoration: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#5B21B6'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#6D28D9'}
        >
          📝 Give Feedback
        </a>
      </div>
    </div>
  );
}

export default function AboutUsModal({ onClose }) {
  const [tab, setTab] = useState('about');

  useEffect(() => {
    window.isGamePaused = true;
    return () => { window.isGamePaused = false; };
  }, []);

  const tabBtn = (name, label) => ({
    padding: '8px 20px',
    border: 'none',
    borderBottom: tab === name ? '2px solid #1A1714' : '2px solid transparent',
    background: 'none',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: tab === name ? 700 : 400,
    color: tab === name ? '#1A1714' : '#6B6358',
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(26, 23, 20, 0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', padding: '20px'
    }}>
      <div style={{
        background: '#FAF8F5', borderRadius: '16px', width: '100%',
        maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 30px 0', borderBottom: '1px solid #D4CFC6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '28px', color: '#1A1714', fontWeight: 800 }}>About Transit Tycoon</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#6B6358', cursor: 'pointer', padding: '0 8px', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button style={tabBtn('about')} onClick={() => setTab('about')}>About</button>
            <button style={tabBtn('team')} onClick={() => setTab('team')}>Meet the Team</button>
          </div>
        </div>

        {/* Content */}
        {tab === 'about' ? <AboutUsContent /> : <TeamContent />}

        {/* Footer */}
        <div style={{ padding: '20px 30px', borderTop: '1px solid #D4CFC6', textAlign: 'right' }}>
          <button onClick={onClose} style={{ background: '#EAE6DE', color: '#3D3830', border: '1px solid #D4CFC6', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            Resume Game
          </button>
        </div>
      </div>
    </div>
  );
}
