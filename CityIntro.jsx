import React, { useState } from "react";

export default function CityIntroFlow({ slides, onComplete, colorTokens }) {
    const [step, setStep] = useState(0);

    const nextStep = () => {
        if (step < slides.length - 1) {
            setStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const currentSlide = slides[step];
    const C = colorTokens;

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
                {slides.map((_, i) => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: i === step ? (C.blue || "#3B82F6") : "#1E293B",
                        transition: "background 0.3s ease",
                        boxShadow: i === step ? `0 0 10px ${C.blue || "#3B82F6"}` : "none"
                    }} />
                ))}
            </div>

            <div key={step} style={{
                maxWidth: 600,
                textAlign: "center",
                animation: "fadeInUp 0.6s ease-out forwards"
            }}>
                <div style={{ fontSize: 60, marginBottom: 24, filter: "drop-shadow(0 0 15px rgba(255,255,255,0.1))" }}>
                    {currentSlide.icon}
                </div>

                {currentSlide.label && (
                    <div style={{
                        fontSize: 12,
                        letterSpacing: 3,
                        color: currentSlide.labelColor || C.blue || "#3B82F6",
                        textTransform: "uppercase",
                        marginBottom: 16,
                        fontWeight: 700
                    }}>
                        {currentSlide.label}
                    </div>
                )}

                <h2 style={{ fontSize: 36, fontWeight: 800, color: "#F8FAFC", marginBottom: 24, lineHeight: 1.2 }}>
                    {currentSlide.title}
                </h2>

                <p style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.6, marginBottom: 40 }}>
                    {currentSlide.text}
                </p>

                {currentSlide.bullets && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40, textAlign: "left", maxWidth: 450, margin: "0 auto 40px" }}>
                        {currentSlide.bullets.map((bullet, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0F172A", padding: "12px 16px", borderRadius: 8, border: "1px solid #1E293B" }}>
                                <div style={{ color: bullet.color || C.blue || "#3B82F6", fontSize: 18 }}>{bullet.icon}</div>
                                <div style={{ fontSize: 15, color: "#CBD5E1" }}>{bullet.text}</div>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={nextStep}
                    style={{
                        background: currentSlide.primary ? `linear-gradient(135deg, ${C.blue || "#3B82F6"} 0%, ${C.blue || "#1D4ED8"} 100%)` : "#1E293B",
                        color: "white",
                        border: currentSlide.primary ? "none" : "1px solid #334155",
                        borderRadius: 8,
                        padding: "14px 44px",
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: currentSlide.primary ? `0 4px 15px ${C.blue}44` : "none"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        if (!currentSlide.primary) e.currentTarget.style.background = "#334155";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        if (!currentSlide.primary) e.currentTarget.style.background = "#1E293B";
                    }}
                >
                    {currentSlide.buttonText || "Continue"}
                </button>
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
