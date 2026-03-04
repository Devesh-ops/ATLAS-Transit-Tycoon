import React, { useState } from "react";

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
                {currentScreen.type === "resident" && (
                    <ResidentScreen content={currentScreen} onNext={nextStep} />
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

function ResidentScreen({ content, onNext }) {
    return (
        <div>
            <div style={{
                display: "inline-block",
                padding: "20px",
                background: "rgba(30, 41, 59, 0.4)",
                borderRadius: "50%",
                marginBottom: 24,
                border: "1px solid #334155"
            }}>
                <div style={{ fontSize: 50 }}>{content.icon}</div>
            </div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: "#3B82F6", textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
                {content.role}
            </div>
            <div style={{
                position: "relative",
                background: "#0F172A",
                border: "1px solid #1E293B",
                borderRadius: 12,
                padding: "24px 32px",
                marginBottom: 40,
                fontStyle: "italic",
                fontSize: 20,
                color: "#F1F5F9",
                lineHeight: 1.6,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
                "{content.quote}"
                {/* Speech Bubble Tail */}
                <div style={{
                    position: "absolute",
                    top: "-10px",
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    width: 20,
                    height: 20,
                    background: "#0F172A",
                    borderLeft: "1px solid #1E293B",
                    borderTop: "1px solid #1E293B"
                }} />
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
        icon: "🌡️",
        title: "Cities are getting hotter.",
        text: "Extreme heat is no longer an anomaly. It is the new reality. As temperatures rise, the city's infrastructure weakens."
    },
    {
        type: "narrative",
        icon: "🛑",
        title: "Transportation systems are under pressure.",
        text: "Gridlock strangles the streets. Public transit struggles to keep up with demand and extreme weather."
    },
    {
        type: "narrative",
        icon: "🚶",
        title: "But people still need to move.",
        text: "They need to get to work, to the hospital, to their families. The city cannot stop."
    },
    {
        type: "resident",
        icon: "🧍",
        role: "The Commuter",
        quote: "I just need to get to work on time. I don't care how, I just need a reliable way to get there without spending a fortune."
    },
    {
        type: "resident",
        icon: "🚌",
        role: "The Transit Rider",
        quote: "The buses are getting too hot. I can't ride them in the afternoon anymore. We need better cooling or more frequent service."
    },
    {
        type: "resident",
        icon: "🚗",
        role: "The Driver",
        quote: "I'd take the bus, but it takes three times as long. And trying to drive? I spend half my life stuck in traffic with these new taxes."
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
                    Atlas Policy Simulator
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
            <div style={{ filter: "blur(2px)", opacity: 0.4, pointerEvents: "none", width: "100%", height: "100%" }}>
                <MockGameUI />
            </div>

            {/* Spotlight Overlay */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(2, 8, 23, 0.7)",
                zIndex: 50
            }}>
                {/* Visual hole */}
                <div style={{
                    position: "absolute",
                    ...currentStep.spotlight,
                    boxShadow: "0 0 0 9999px rgba(2, 8, 23, 0.7), 0 0 30px rgba(59, 130, 246, 0.5)",
                    borderRadius: currentStep.spotlight.borderRadius || 12,
                    zIndex: 60,
                    transition: "all 0.5s ease-in-out"
                }} />
            </div>

            {/* Content Box */}
            <div style={{
                position: "absolute",
                ...currentStep.contentPosition,
                zIndex: 100,
                maxWidth: 320,
                background: "#0F172A",
                border: "1px solid #1E293B",
                borderRadius: 16,
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                animation: "fadeInUp 0.6s ease-out forwards",
                transition: "all 0.5s ease-in-out"
            }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{currentStep.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", color: "#F8FAFC" }}>{currentStep.title}</h3>
                <p style={{ fontSize: 15, color: "#94A3B8", lineHeight: 1.6, marginBottom: 24 }}>{currentStep.text}</p>
                <ActionButton onClick={nextStep} text={tutorialStep === TUTORIAL_STEPS.length - 1 ? "Finish Tutorial" : "Next Step"} primary />
            </div>
        </div>
    );
}

function MockGameUI() {
    return (
        <div style={{ padding: "80px 40px 40px", maxWidth: 900, margin: "0 auto", height: "100vh", position: "relative" }}>
            {/* Header Area */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 60, opacity: 0.8 }}>
                <div style={{ background: "#0F172A", border: "1px solid #1E293B", padding: "12px 24px", borderRadius: 8 }}>
                    <div style={{ color: "#64748B", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Budget</div>
                    <div style={{ color: "#10B981", fontSize: 20, fontWeight: 700 }}>$12,000,000</div>
                </div>
                <div style={{ textAlign: "center", paddingTop: 10 }}>
                    <div style={{ fontSize: 40 }}>☀️</div>
                    <div style={{ color: "#FBBF24", fontWeight: 700, fontSize: 14 }}>Summer</div>
                </div>
                <div style={{ background: "#0F172A", border: "1px solid #1E293B", padding: "12px 24px", borderRadius: 8, textAlign: "right" }}>
                    <div style={{ color: "#64748B", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Month</div>
                    <div style={{ color: "#F8FAFC", fontSize: 20, fontWeight: 700 }}>June</div>
                </div>
            </div>

            <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
                {/* Sliders Area */}
                <div style={{ flex: 1, padding: 32, background: "rgba(15, 23, 42, 0.6)", border: "1px solid #1E293B", borderRadius: 16 }}>
                    <h4 style={{ margin: "0 0 24px", color: "#F8FAFC", fontSize: 16 }}>Policy Controls</h4>
                    {[
                        { label: "Uber Tax", val: 40, color: "#3B82F6" },
                        { label: "Bus Subsidy", val: 70, color: "#10B981" }
                    ].map((slider, i) => (
                        <div key={i} style={{ marginBottom: 32 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <span style={{ fontSize: 14, color: "#94A3B8" }}>{slider.label}</span>
                                <span style={{ fontSize: 14, color: slider.color, fontWeight: 600 }}>{slider.val}%</span>
                            </div>
                            <div style={{ height: 6, background: "#1E293B", borderRadius: 3, position: "relative" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${slider.val}%`, background: slider.color, borderRadius: 3 }} />
                                <div style={{ position: "absolute", left: `${slider.val}%`, top: "50%", transform: "translate(-50%, -50%)", width: 16, height: 16, background: "white", borderRadius: "50%", border: `2px solid ${slider.color}` }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Metrics Area */}
                <div style={{ flex: 1, padding: 32, background: "rgba(15, 23, 42, 0.6)", border: "1px solid #1E293B", borderRadius: 16 }}>
                    <h4 style={{ margin: "0 0 24px", color: "#F8FAFC", fontSize: 16 }}>City Health Metrics</h4>
                    {[
                        { label: "Happiness", val: 82, color: "#10B981" },
                        { label: "Mobility", val: 65, color: "#3B82F6" },
                        { label: "Congestion", val: 28, color: "#EF4444" }
                    ].map((metric, i) => (
                        <div key={i} style={{ marginBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 13, color: "#94A3B8" }}>{metric.label}</span>
                                <span style={{ fontSize: 13, color: metric.color, fontWeight: 600 }}>{metric.val}%</span>
                            </div>
                            <div style={{ height: 10, background: "#1E293B", borderRadius: 5, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${metric.val}%`, background: metric.color }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const TUTORIAL_STEPS = [
    {
        icon: "🎮",
        title: "Policy Tools",
        text: "Use these sliders to set your city's policies. Taxing Uber generates revenue but can hurt mobility. Subsidizing buses costs money but helps people move.",
        spotlight: { top: "58%", left: "28%", width: "420px", height: "300px", transform: "translate(-50%, -50%)" },
        contentPosition: { top: "50%", left: "68%", transform: "translateY(-50%)" }
    },
    {
        icon: "📊",
        title: "Metric Bars",
        text: "These gauges show the health of the city. Keep an eye on Happiness, Mobility, and Congestion. If they drop too low, your term might end early!",
        spotlight: { top: "58%", left: "72%", width: "420px", height: "300px", transform: "translate(-50%, -50%)" },
        contentPosition: { top: "50%", right: "68%", transform: "translateY(-50%)" }
    },
    {
        icon: "🌡️",
        title: "External Factors",
        text: "Seasons and temperature will affect the city dynamically. Extreme heat or cold makes transportation harder, and you'll need to adapt your policies.",
        spotlight: { top: "16.5%", left: "50%", width: "120px", height: "120px", transform: "translate(-50%, -50%)", borderRadius: "50%" },
        contentPosition: { top: "42%", left: "50%", transform: "translateX(-50%)" }
    },
    {
        icon: "⚖️",
        title: "Balance is Key",
        text: "Your goal is to survive the year by balancing the budget while keeping citizens happy and the city moving. Good luck, Director!",
        spotlight: { top: "50%", left: "50%", width: "0px", height: "0px", transform: "translate(-50%, -50%)" },
        contentPosition: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    }
];
