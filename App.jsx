import React, { useState } from 'react';
import OnboardingFlow from './onboarding.jsx';
import TransportTycoon from './city1_game.jsx';
import RiverdaleTycoon from './city2_game.jsx';
import GildedHollowTycoon from './city3_game.jsx';
import CrestwoodTycoon from './city4_game.jsx';
import AboutUsModal from './AboutUs.jsx';

function App() {
    const [activeComponent, setActiveComponent] = useState('menu');
    const [isAboutOpen, setIsAboutOpen] = React.useState(false);
    const [hideGlobalControls, setHideGlobalControls] = React.useState(false);

    // Global Mobile Responsive CSS
    React.useEffect(() => {
        const styleId = 'mobile-responsive-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                /* Absolute baseline resets for mobile */
                * { box-sizing: border-box !important; }
                
                @media (max-width: 800px) {
                    /* Main Layout Stacking */
                    .mobile-stack {
                        flex-direction: column !important;
                        overflow-y: auto !important;
                        overflow-x: hidden !important; /* Clip escaping cars */
                        height: 100vh !important;
                        display: block !important; /* Stack naturally */
                    }
                    .mobile-scroll-pad {
                        padding-bottom: 100px !important; /* Clearance for floating buttons */
                    }
                    
                    /* Sidebar columns become full width */
                    .mobile-full-width {
                        width: 100% !important;
                        min-width: 0 !important;
                        border-left: none !important;
                        border-right: none !important;
                        border-bottom: 1px solid rgba(0,0,0,0.1) !important;
                        flex-shrink: 0 !important; /* Don't shrink to 0 */
                        height: auto !important;
                        overflow-y: visible !important;
                    }
                    
                    /* Road scene gets a fixed height so it doesn't disappear */
                    .mobile-road-height {
                        height: 500px !important; /* Increased from 380px to accommodate taller cities like City 4 */
                        min-height: 500px !important;
                        flex: none !important;
                        position: relative !important;
                        overflow: hidden !important; /* MUST CLIP CARS */
                        z-index: 5 !important;
                    }

                    /* Performance Header / Grade Bar mobile fixes */
                    .mobile-grade-bar {
                        flex-wrap: wrap !important;
                        padding: 10px 14px !important;
                        gap: 6px !important;
                    }
                    .mobile-grade-bar-row2 {
                        flex-wrap: wrap !important;
                        gap: 8px !important;
                    }
                    .mobile-grade-bar-row2 > div:first-child {
                        width: 100% !important; /* Full width progress bar on mobile */
                        margin-bottom: 4px !important;
                    }

                    /* Compact Header for mobile */
                    .mobile-header {
                        padding: 10px !important;
                        gap: 12px 6px !important;
                        flex-wrap: wrap !important;
                        height: auto !important; /* Grow with chips */
                        justify-content: space-between !important;
                    }
                    
                    /* Make the city name and badge occupy the top row if needed */
                    .mobile-header > div:first-child {
                        min-width: 120px !important;
                        flex: 1 1 auto !important;
                    }

                    /* Ensure the season badge doesn't overlap */
                    .mobile-season-badge {
                        margin: 0 !important;
                        flex-shrink: 0 !important;
                    }
                    
                    /* Floating Global Controls */
                    .global-controls-container {
                        bottom: 12px !important;
                        right: 12px !important;
                        left: auto !important;
                        flex-direction: column !important;
                        align-items: flex-end !important;
                        gap: 8px !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

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
                        left: '20px',
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

            {/* Global floating bottom-right controls */}
            {!hideGlobalControls && (
                <div className="global-controls-container" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => setIsAboutOpen(true)}
                        style={{
                            padding: '10px 20px',
                            background: '#E5E5E5',
                            color: '#555',
                            border: '1px solid #CCC',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                        }}
                    >
                        About
                    </button>
                    <a
                        href="https://forms.gle/gXmrN1UNKQLN1uaQ6"
                        target="_blank"
                        rel="noreferrer"
                        title="Opens a Google Form in a new tab to give feedback."
                        style={{
                            padding: '10px 20px',
                            background: '#E5E5E5',
                            color: '#555',
                            border: '1px solid #CCC',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                        }}
                    >
                        Feedback
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
