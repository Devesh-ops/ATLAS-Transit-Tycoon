import React, { useState } from 'react';
import OnboardingFlow from './onboarding.jsx';
import TransportTycoon from './city1_game.jsx';
import RiverdaleTycoon from './city2_game.jsx';
import GildedHollowTycoon from './city3_game.jsx';
import CrestwoodTycoon from './city4_game.jsx';
import AboutUsModal from './AboutUs.jsx';

function App() {
    const [activeComponent, setActiveComponent] = useState('menu');
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [hideGlobalControls, setHideGlobalControls] = useState(false);

    // Reset visibility if we navigate away
    React.useEffect(() => {
        if (activeComponent !== 'city4') setHideGlobalControls(false);
    }, [activeComponent]);

    const renderComponent = () => {
        switch (activeComponent) {
            case 'onboarding':
                return <OnboardingFlow onComplete={() => setActiveComponent('menu')} />;
            case 'city1':
                return <TransportTycoon onAdvance={() => setActiveComponent('city2')} />;
            case 'city2':
                return <RiverdaleTycoon onAdvance={() => setActiveComponent('city3')} />;
            case 'city3':
                return <GildedHollowTycoon onAdvance={() => setActiveComponent('city4')} />;
            case 'city4':
                return <CrestwoodTycoon onAdvance={() => { setActiveComponent('menu'); setHideGlobalControls(false); }} onSetFinalScreen={(val = true) => setHideGlobalControls(val)} />;
            default:
                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        gap: '20px'
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
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            {activeComponent !== 'menu' && (
                <button
                    onClick={() => setActiveComponent('menu')}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        zIndex: 1000,
                        padding: '10px 20px',
                        background: '#1E293B',
                        color: 'white',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    ← Back to Menu
                </button>
            )}

            {/* Global floating bottom-left controls */}
            {!hideGlobalControls && (
                <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => setIsAboutOpen(true)}
                        style={{
                            padding: '10px 20px',
                            background: '#F5F5F5',
                            color: '#333',
                            border: '1px solid #CCC',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        About
                    </button>
                    <a
                        href="https://forms.gle/gXmrN1UNKQLN1uaQ6"
                        target="_blank"
                        rel="noreferrer"
                        title="Opens a Google Form in a new tab to give feedback. The game will be paused in the meantime."
                        onClick={() => setIsAboutOpen(true)}
                        style={{
                            padding: '10px 20px',
                            background: '#6D28D9',
                            color: 'white',
                            border: 'none',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        Give Feedback
                    </a>
                </div>
            )}

            {isAboutOpen && <AboutUsModal onClose={() => setIsAboutOpen(false)} />}

            {renderComponent()}
        </div>
    );
}

function TestCard({ title, desc, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: '30px',
                background: '#0F172A',
                border: '1px solid #1E293B',
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
                e.currentTarget.style.borderColor = '#1E293B';
            }}
        >
            <h3 style={{ margin: '0 0 10px 0', color: '#FFF' }}>{title}</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>{desc}</p>
        </div>
    );
}

export default App;
