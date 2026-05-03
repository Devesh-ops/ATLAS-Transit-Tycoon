import React, { useState, useEffect } from 'react';
import OnboardingFlow from './onboarding.jsx';
import TransportTycoon from './city1_game.jsx';
import RiverdaleTycoon from './city2_game.jsx';
import GildedHollowTycoon from './city3_game.jsx';
import CrestwoodTycoon from './city4_game.jsx';
import AboutUsModal from './AboutUs.jsx';
import GameMenu from './GameMenu.jsx';
import TestbedSelector from './TestbedSelector.jsx';

/**
 * App Component
 * 
 * The root controller for the application. Manages:
 * 1. Mode Switching: Detects `?testbed` query param to toggle between Production and Sandbox modes.
 * 2. Career Progress: Persists unlocked cities and tutorial completion in `atlas_progress`.
 * 3. Navigation: Routes between the Game Menu, Onboarding, and various City simulations.
 * 4. UI State: Manages global visibility for controls (like the 'Back' button).
 */
function App() {
    const [activeComponent, setActiveComponent] = useState('menu');
    const [isAboutOpen, setIsAboutOpen] = React.useState(false);
    const [hideGlobalControls, setHideGlobalControls] = React.useState(false);
    const [progress, setProgress] = useState(() => {
        const saved = localStorage.getItem('atlas_progress');
        return saved ? JSON.parse(saved) : [];
    });

    // Toggle for developer mode
    const isTestbedMode = window.location.search.includes('testbed');

    useEffect(() => {
        localStorage.setItem('atlas_progress', JSON.stringify(progress));
    }, [progress]);

    const unlockCity = (cityId) => {
        if (!progress.includes(cityId)) {
            setProgress(prev => [...prev, cityId]);
        }
    };

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
                return <OnboardingFlow onComplete={() => { unlockCity('tutorial'); setActiveComponent(isTestbedMode ? 'menu' : 'city1'); }} />;
            case 'city1':
                return <TransportTycoon onAdvance={() => { unlockCity('city1'); setActiveComponent('city2'); }} onReturnToMenu={() => setActiveComponent('menu')} />;
            case 'city2':
                return <RiverdaleTycoon onAdvance={() => { unlockCity('city2'); setActiveComponent('city3'); }} onReturnToMenu={() => setActiveComponent('menu')} />;
            case 'city3':
                return <GildedHollowTycoon onAdvance={() => { unlockCity('city3'); setActiveComponent('city4'); }} onReturnToMenu={() => setActiveComponent('menu')} />;
            case 'city4':
                return <CrestwoodTycoon onAdvance={() => { unlockCity('city4'); setActiveComponent('menu'); setHideGlobalControls(false); }} onSetFinalScreen={(val = true) => setHideGlobalControls(val)} onReturnToMenu={() => setActiveComponent('menu')} />;
            case 'menu':
                if (isTestbedMode) {
                    return <TestbedSelector setActiveComponent={setActiveComponent} />;
                }
                return (
                    <GameMenu 
                        onSelectCity={setActiveComponent} 
                        onStartOnboarding={() => setActiveComponent('onboarding')}
                        progress={progress}
                    />
                );
            default:
                return <GameMenu onSelectCity={setActiveComponent} progress={progress} />;
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
