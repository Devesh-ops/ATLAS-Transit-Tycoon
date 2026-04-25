import React, { useState } from "react";
import CityRoadScene from "./CityRoadScene.jsx";

export default function OnboardingFlow({ onComplete }) {
    const [step, setStep] = useState(0);

    if (step === 0) {
        return <StartScreen onStart={() => setStep(1)} />;
    }

    if (step === 1) {
        return <StoryFlow onComplete={() => setStep(2)} />;
    }

    if (step === 2) {
        return <TutorialFlow onComplete={onComplete} />;
    }

    return null;
}

function StoryFlow({ onComplete }) {
    const [storyStep, setStoryStep] = useState(0);

    const nextStep = () => {
        if (storyStep < STORY_SCREENS.length - 1) {
            setStoryStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const currentScreen = STORY_SCREENS[storyStep];

    return (
        <div style={{
            minHeight: "100vh",
            background: "#020817",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif",
            padding: 20,
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Progress Dots */}
            <div style={{ position: "absolute", top: 40, display: "flex", gap: 12 }}>
                {STORY_SCREENS.map((_, i) => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: i === storyStep ? "#3B82F6" : "#1E293B",
                        transition: "background 0.3s ease",
                        boxShadow: i === storyStep ? "0 0 10px rgba(59, 130, 246, 0.5)" : "none"
                    }} />
                ))}
            </div>

            <div key={storyStep} style={{
                maxWidth: 600,
                textAlign: "center",
                animation: "fadeInUp 0.6s ease-out forwards"
            }}>
                {currentScreen.type === "narrative" && (
                    <NarrativeScreen content={currentScreen} onNext={nextStep} />
                )}
                {currentScreen.type === "residents" && (
                    <ResidentsScreen content={currentScreen} onNext={nextStep} />
                )}
                {currentScreen.type === "goal" && (
                    <GoalScreen content={currentScreen} onNext={nextStep} />
                )}
            </div>

            <style>
                {`
                @keyframes fadeInUp {
                    from {opacity: 0; transform: translateY(15px); }
                    to {opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </div>
    );
}

function NarrativeScreen({ content, onNext }) {
    return (
        <div>
            <div style={{ fontSize: 50, marginBottom: 24, filter: "drop-shadow(0 0 15px rgba(255,255,255,0.1))" }}>
                {content.icon}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, color: "#F8FAFC", marginBottom: 20, lineHeight: 1.3 }}>
                {content.title}
            </h2>
            <p style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.6, marginBottom: 40 }}>
                {content.text}
            </p>
            <ActionButton onClick={onNext} text="Continue" />
        </div>
    );
}

function ResidentsScreen({ content, onNext }) {
    return (
        <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#F8FAFC", marginBottom: 24, lineHeight: 1.3 }}>
                The City's Voices
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
                {content.residents.map((resident, i) => (
                    <div key={i} style={{
                        position: "relative",
                        background: "#0F172A",
                        border: "1px solid #1E293B",
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        textAlign: "left",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "80px" }}>
                            <div style={{ fontSize: 32 }}>{resident.icon}</div>
                            <div style={{ fontSize: 10, letterSpacing: 1, color: "#3B82F6", textTransform: "uppercase", marginTop: 8, fontWeight: 600, textAlign: "center" }}>
                                {resident.role}
                            </div>
                        </div>
                        <div style={{ fontStyle: "italic", fontSize: 15, color: "#F1F5F9", lineHeight: 1.5 }}>
                            "{resident.quote}"
                        </div>
                    </div>
                ))}
            </div>
            <ActionButton onClick={onNext} text="Continue" />
        </div>
    );
}

function GoalScreen({ content, onNext }) {
    return (
        <div>
            <div style={{ fontSize: 50, marginBottom: 20 }}>{content.icon}</div>
            <div style={{ fontSize: 13, letterSpacing: 3, color: "#10B981", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                Your Mission
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#F8FAFC", marginBottom: 30 }}>
                {content.title}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40, textAlign: "left", maxWidth: 400, margin: "0 auto 40px" }}>
                {content.bullets.map((bullet, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F172A", padding: "16px", borderRadius: 8, border: "1px solid #1E293B" }}>
                        <div style={{ color: "#3B82F6", fontSize: 20 }}>{bullet.icon}</div>
                        <div style={{ fontSize: 16, color: "#CBD5E1" }}>{bullet.text}</div>
                    </div>
                ))}
            </div>

            <ActionButton onClick={onNext} text="Take Office" primary />
        </div>
    );
}

function ActionButton({ onClick, text, primary }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: primary ? "linear-gradient(135deg, #10B981 0%, #059669 100%)" : "#1E293B",
                color: "white",
                border: primary ? "none" : "1px solid #334155",
                borderRadius: 8,
                padding: "14px 36px",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: primary ? "0 4px 15px rgba(16, 185, 129, 0.3)" : "none"
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                if (!primary) e.currentTarget.style.background = "#334155";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                if (!primary) e.currentTarget.style.background = "#1E293B";
            }}
        >
            {text}
        </button>
    );
}

const STORY_SCREENS = [
    {
        type: "narrative",
        icon: "🤖🚗",
        title: "Autonomous vehicles are everywhere.",
        text: "What was once a futuristic dream is now a reality. Lower prices have led to a surge in individual use Ubers and AVs flood our streets."
    },
    {
        type: "narrative",
        icon: "🚦",
        title: "The city is grinding to a halt.",
        text: "Transport systems are already under pressure, and with more vehicles than ever, congestion is only getting worse."
    },
    {
        type: "narrative",
        icon: "🚶",
        title: "But people still need to move.",
        text: "People still need to get to work, to hospitals, to their families. The city cannot stop."
    },
    {
        type: "residents",
        residents: [
            {
                icon: "🧍",
                role: "The Commuter",
                quote: "I just need a reliable and affordable way to get to work on time."
            },
            {
                icon: "🚌",
                role: "The Rider",
                quote: "The buses are too crowded and hot in the afternoon. We need better cooling or more frequent service."
            },
            {
                icon: "🚗",
                role: "The Driver",
                quote: "I'd take the bus, but it's too slow. And driving? You either sit in gridlock or pay through the nose in taxes."
            }
        ]
    },
    {
        type: "narrative",
        icon: "🏢",
        title: "You are in charge.",
        text: "As the new Director of Transit, their problems are your problems. Your policies will determine how the city moves."
    },
    {
        type: "goal",
        icon: "⚖️",
        title: "Balance Competing Needs",
        bullets: [
            { icon: "💰", text: "Keep the budget out of the red" },
            { icon: "🚦", text: "Manage congestion and mobility" },
            { icon: "😊", text: "Maintain citizen happiness" },
            { icon: "🗳️", text: "Survive until the end of the year" }
        ]
    }
];

function StartScreen({ onStart }) {
    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom, #020817 0%, #0F172A 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif",
            padding: 20,
            position: "relative",
            overflow: "hidden"
        }}>

            {/* Background Graphic Elements (City Skyline Silhouette) */}
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-around",
                opacity: 0.08,
                pointerEvents: "none"
            }}>
                <div style={{ width: "12%", height: "85%", background: "white", borderRadius: "4px 4px 0 0" }} />
                <div style={{ width: "16%", height: "65%", background: "white", borderRadius: "4px 4px 0 0" }} />
                <div style={{ width: "10%", height: "95%", background: "white", borderRadius: "4px 4px 0 0" }} />
                <div style={{ width: "22%", height: "55%", background: "white", borderRadius: "4px 4px 0 0" }} />
                <div style={{ width: "14%", height: "75%", background: "white", borderRadius: "4px 4px 0 0" }} />
            </div>

            {/* Main Content */}
            <div style={{
                maxWidth: 600,
                textAlign: "center",
                zIndex: 10,
                animation: "fadeIn 1.5s ease-out"
            }}>
                <div style={{ fontSize: 60, marginBottom: 20, filter: "drop-shadow(0 0 20px rgba(59, 130, 246, 0.5))" }}>🏙️</div>

                <div style={{ fontSize: 13, letterSpacing: 5, color: "#3B82F6", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
                    Policy Simulator
                </div>

                <h1 style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: "#F8FAFC",
                    margin: "0 0 24px",
                    letterSpacing: "-1px",
                    lineHeight: 1.1
                }}>
                    Transit Tycoon
                </h1>

                <p style={{
                    fontSize: 18,
                    color: "#94A3B8",
                    marginBottom: 48,
                    fontStyle: "italic",
                    lineHeight: 1.6
                }}>
                    Every policy changes the city.<br />
                    Can you balance budget, mobility, and congestion?
                </p>

                <button
                    onClick={onStart}
                    style={{
                        background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)",
                        color: "white",
                        border: "1px solid #3B82F6",
                        borderRadius: 12,
                        padding: "16px 48px",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 4px 20px rgba(29, 78, 216, 0.4)",
                        transition: "all 0.2s ease-in-out"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 6px 24px rgba(29, 78, 216, 0.6)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(29, 78, 216, 0.4)";
                    }}
                >
                    Start Game
                </button>
            </div>

            {/* Inline styles for basic animations */}
            <style>
                {`
                @keyframes fadeIn {
                    from {opacity: 0; transform: translateY(20px); }
                    to {opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </div>
    );
}

function TutorialFlow({ onComplete }) {
    const [tutorialStep, setTutorialStep] = useState(0);

    const nextStep = () => {
        if (tutorialStep < TUTORIAL_STEPS.length - 1) {
            setTutorialStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const currentStep = TUTORIAL_STEPS[tutorialStep];

    return (
        <div style={{
            minHeight: "100vh",
            background: "#020817",
            color: "white",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif"
        }}>
            {/* The background "Game" being explained */}
            <div style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                <MockGameUI tutorialStep={tutorialStep} />
            </div>

            {/* Spotlight Overlay */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(2, 8, 23, 0.65)",
                zIndex: 50,
                pointerEvents: "none"
            }} />

            {/* Content Box */}
            <div style={{
                position: "absolute",
                ...currentStep.contentPosition,
                zIndex: 200,
                maxWidth: 340,
                background: "#0F172A",
                border: "1px solid #1E293B",
                borderRadius: 16,
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                animation: "fadeInUp 0.6s ease-out forwards",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 32 }}>{currentStep.icon}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: "#3B82F6", textTransform: "uppercase", fontWeight: 800, marginBottom: 2 }}>Step {tutorialStep + 1} of 5</div>
                        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#F8FAFC" }}>{currentStep.title}</h3>
                    </div>
                </div>
                <p style={{ fontSize: 15, color: "#94A3B8", lineHeight: 1.6, marginBottom: 24 }}>{currentStep.text}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        {TUTORIAL_STEPS.map((_, i) => (
                            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === tutorialStep ? "#3B82F6" : "#1E293B" }} />
                        ))}
                    </div>
                    <ActionButton onClick={nextStep} text={tutorialStep === TUTORIAL_STEPS.length - 1 ? "Finish Tutorial" : "Next Step"} primary />
                </div>
            </div>
        </div>
    );
}

const C = {
    pageBg: "#F7F4EF", cardBg: "#FFFFFF", insetBg: "#EAE6DE",
    border: "#D4CFC6", borderLight: "#E8E2D8",
    text: "#1A1714", textSub: "#3D3830", textMuted: "#6B6358", textFaint: "#9C9188",
    blue: "#1B4FD8", blueBg: "#EEF3FF", blueBorder: "#B8CBFF",
    green: "#166534", greenBg: "#F0FDF4", greenBorder: "#86EFAC",
    amber: "#92400E", amberBg: "#FFFBEB", amberBorder: "#FCD34D",
    red: "#991B1B", redBg: "#FFF1F1", redBorder: "#FECACA",
    purple: "#6D28D9", purpleBg: "#F5F3FF", purpleBorder: "#C4B5FD",
    uberColor: "#B91C1C", busColor: "#1B4FD8",
    track: "#E2DDD6", overlay: "rgba(26,23,20,0.78)",
};

function MockGameUI({ tutorialStep }) {
    const isStep = (s) => tutorialStep === s;
    const highlight = (s) => ({
        zIndex: isStep(s) ? 100 : 1,
        position: "relative",
        transition: "all 0.5s ease",
        opacity: (tutorialStep === -1 || isStep(s)) ? 1 : 0.25,
        boxShadow: isStep(s) ? `0 0 0 6px ${C.blue}33, 0 20px 40px rgba(0,0,0,0.2)` : "none",
        borderRadius: isStep(s) ? 12 : 0,
        background: isStep(s) ? C.cardBg : "transparent"
    });

    return (
        <div style={{
            background: C.pageBg,
            width: "100%",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Georgia, serif",
            color: C.text,
            overflow: "hidden"
        }}>
            {/* 1. Top Bar - matches city1 planning screen */}
            <div className="mobile-header" style={{ 
                ...highlight(1), 
                background: C.cardBg, 
                borderBottom: `1px solid ${C.border}`, 
                padding: "8px 16px", 
                display: "flex", 
                alignItems: "center", 
                gap: 14,
                zIndex: isStep(1) ? 101 : 51 // Stay above overlay when highlighted
            }}>
                <div style={{ minWidth: 110 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: C.blue, textTransform: "uppercase", fontWeight: 800 }}>City 1 · Smallville</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>January</div>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 9, color: C.textFaint }}>
                        <span>Jan</span>
                        <span style={{ color: C.blue, fontWeight: 700 }}>1/12</span>
                        <span>Dec</span>
                    </div>
                    <div style={{ height: 5, background: C.track, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "8.3%", background: C.blue, borderRadius: 3 }} />
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ position: "relative", width: 44, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                         <div style={{ fontSize: 14, fontWeight: 800 }}>20</div>
                         <div style={{ fontSize: 8, color: C.textFaint, textTransform: "uppercase" }}>sec</div>
                    </div>
                    <button style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 800 }}>✓ End Turn</button>
                </div>
            </div>

            {/* 2. Performance Header */}
            <div style={{ ...highlight(0), background: C.cardBg, borderBottom: `1px solid ${C.border}`, padding: "0" }}>
                <div className="mobile-grade-bar" style={{ padding: "6px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Projected Grade</div>
                    <div style={{ background: C.green, color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 14, fontWeight: 900 }}>B+</div>
                    <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>Score 68/100</div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>Goal: Grade B or Higher to Advance</div>
                </div>
                <div className="mobile-grade-bar-row2" style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, height: 6, background: C.track, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                        <div style={{ width: "65%", background: C.green }} />
                        <div style={{ width: "5%", background: C.amber }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.green }} />
                            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Happiness <span style={{ color: C.green }}>+65</span></span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.amber }} />
                            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Budget <span style={{ color: C.amber }}>+3</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Main 3-Column Layout */}
            <div className="mobile-stack" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* LEFT: Policy */}
                <div className="mobile-full-width" style={{ ...highlight(3), width: 272, flexShrink: 0, padding: "14px 16px", borderRight: `1px solid ${C.border}`, pointerEvents: "none" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Set Policy</div>
                    {/* Uber Tax Mock */}
                    <div style={{ ...highlight(3), marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                             <span style={{ fontSize: 13, fontWeight: 600 }}>Uber / AV Tax</span>
                             <span style={{ fontSize: 18, fontWeight: 700, color: C.red }}>0%</span>
                        </div>
                        <div style={{ height: 4, background: C.track, borderRadius: 2, position: "relative", opacity: 0.5 }}>
                             <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: C.textMuted, borderRadius: "50%" }} />
                        </div>
                        <div style={{ fontSize: 9, color: C.textFaint, marginTop: 6 }}>⚠️ Locked for January & February</div>
                    </div>
                    {/* Bus Subsidy Mock */}
                    <div style={{ ...highlight(3), marginBottom: 20 }}>
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>Bus Fare Subsidy</span>
                              <span style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>20%</span>
                         </div>
                         <div style={{ height: 4, background: C.track, borderRadius: 2, position: "relative" }}>
                              <div style={{ position: "absolute", left: "20%", top: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, background: "#fff", border: `2px solid ${C.blue}`, borderRadius: "50%" }} />
                         </div>
                    </div>
                    {/* Budget Delta Mock */}
                    <div style={{ padding: "10px 12px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                         <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Est. budget change</span>
                         <span style={{ fontSize: 16, fontWeight: 800, color: C.green }}>+0.12M</span>
                    </div>
                </div>

                {/* CENTER: Road Visualization */}
                <div className="mobile-road-height" style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                        <CityRoadScene cityLevel={1} uberTax={0} busSubsidy={20} congestion={42} />
                    </div>
                    {/* Advisor Strip at bottom of scene */}
                    <div style={{ 
                        ...highlight(4), 
                        padding: "10px 14px", 
                        background: "rgba(255,255,255,0.93)", 
                        backdropFilter: "blur(4px)", 
                        borderTop: `1px solid ${C.border}`,
                        maxHeight: "90px",
                        overflow: "hidden"
                    }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 20 }}>🧑‍💼</span>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: C.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Maya · Advisor</div>
                                <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>Smallville's roads are getting busy. We need to find a balance between revenue and mobility.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Metrics */}
                <div className="mobile-full-width" style={{ ...highlight(2), width: 272, flexShrink: 0, padding: "14px 16px", borderLeft: `1px solid ${C.border}`, pointerEvents: "none" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Live Preview</div>
                    {[
                        { label: "Happiness", val: 65, color: C.green, target: "Goal: 65+" },
                        { label: "Mobility", val: 58, color: C.blue, target: "Target: 55–75" },
                        { label: "Congestion", val: 42, color: C.amber, target: "Goal: under 40" }
                    ].map((m, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>{m.label}</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</span>
                            </div>
                            <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${m.val}%`, background: m.color }} />
                            </div>
                            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>{m.target}</div>
                        </div>
                    ))}
                    <div style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                             <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Budget</span>
                             <span style={{ fontSize: 16, fontWeight: 700, color: C.green }}>$12.0M</span>
                        </div>
                        <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden" }}>
                             <div style={{ height: "100%", width: "100%", background: C.green }} />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Extra padding at bottom to handle global button overlap */}
            <div style={{ height: 100, flexShrink: 0 }} />
        </div>
    );
}

const TUTORIAL_STEPS = [
    {
        icon: "🏆",
        title: "The Mission",
        text: "This is your performance health. Your goal is to reach Grade B (65+ points) by December. Happiness and Budget efficiency both contribute to your score.",
        contentPosition: { top: "135px", left: "50%", transform: "translateX(-50%)" }
    },
    {
        icon: "⏰",
        title: "Monthly Cycle",
        text: "Smallville waits for no one! Each month gives you 20 seconds to set policy. Watch the timer—once it hits zero, your choices are locked and the month ends.",
        contentPosition: { top: "75px", left: "50%", transform: "translateX(-50%)" }
    },
    {
        icon: "📊",
        title: "City Health",
        text: "Monitor these gauges constantly. Happiness is your primary score driver, but it depends on keeping Mobility high and Congestion low.",
        contentPosition: { top: "50%", right: "290px", transform: "translateY(-50%)" }
    },
    {
        icon: "🎮",
        title: "Policy Sliders",
        text: "These are your primary tools. Taxing Uber (top) generates revenue and cuts congestion, while Subsidizing Buses (bottom) increases mobility but costs money. Balance these to keep the city thriving!",
        contentPosition: { top: "40%", left: "290px" }
    },
    {
        icon: "🧑‍💼",
        title: "Advisor Maya",
        text: "Listen to Maya! She provides expert context and feedback on your policy decisions at the bottom of the screen. Her hints change every month.",
        contentPosition: { bottom: "220px", left: "50%", transform: "translateX(-50%)" }
    }
];
