
import React, { useState, useEffect } from 'react';
import { Button } from './Shared';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  color: string;
  highlight: string;
  tagline: string;
}

export const PublicOnboardingView: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const steps: OnboardingStep[] = [
    {
      title: "Tactical Mobility",
      description: "Zimbabwe's premier AI-driven transport marketplace. Deploying optimized routing for riders and heavy freight across the nation.",
      icon: "rocket",
      color: "text-brand-orange",
      highlight: "NETWORK ACTIVE",
      tagline: "MISSION READY"
    },
    {
      title: "Gemini Intelligence",
      description: "Harness 'Magic Assist' for natural language dispatch. Simply describe your mission parameters and let our AI handle the logistics.",
      icon: "brain-circuit",
      color: "text-blue-400",
      highlight: "AI DISPATCH",
      tagline: "NEURAL CORE 2.5"
    },
    {
      title: "Elite Marketplace",
      description: "Strategic bidding protocol for total transparency. Drivers compete for your mission, ensuring market-fair pricing every time.",
      icon: "microchip",
      color: "text-emerald-500",
      highlight: "SECURE GRID",
      tagline: "MARKET OPS"
    }
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  if (booting) {
    return (
      <div className="fixed inset-0 z-[200] bg-brand-blue flex flex-col items-center justify-center p-8 overflow-hidden font-mono">
        <div className="flex flex-col items-center gap-4 text-brand-orange">
          <i className="fa-solid fa-satellite-dish text-4xl animate-pulse"></i>
          <p className="text-[10px] font-black tracking-[0.5em] animate-pulse">INITIALIZING NEURAL LINK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-brand-blue flex flex-col items-center justify-center p-8 animate-fade-in overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-orange/5 blur-[120px] rounded-full animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse-slow"></div>
      
      {/* Floating HUD Elements */}
      <div className="absolute top-12 left-12 opacity-20 text-[8px] font-mono text-white tracking-[0.3em] rotate-90 origin-left">
        PROTOCOL_V1.0_SECURE
      </div>

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center text-center">
        {/* Step Identity */}
        <div className="mb-12 animate-slide-down">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-4 bg-brand-orange/40"></span>
            <span className="text-[10px] font-black text-brand-orange uppercase tracking-[0.4em]">{step.tagline}</span>
            <span className="h-[1px] w-4 bg-brand-orange/40"></span>
          </div>
          <h1 className="text-2xl font-black text-white italic tracking-tighter">RideIn <span className="text-white/40">Elite</span></h1>
        </div>

        {/* Tactical Icon Sphere */}
        <div className="relative w-56 h-56 mb-12 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-white/5 rounded-full animate-reverse-spin"></div>
          <div className="absolute inset-4 border border-brand-orange/20 rounded-full animate-spin-slow"></div>
          <div className="absolute inset-8 border border-white/5 rounded-full"></div>
          <div className="w-36 h-36 rounded-[3rem] bg-white/5 backdrop-blur-3xl border border-white/10 flex items-center justify-center shadow-2xl relative rotate-3">
             <i className={`fa-solid fa-${step.icon} text-6xl ${step.color} drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]`}></i>
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-brand-orange text-white text-[8px] font-black px-4 py-1.5 rounded-full tracking-[0.2em] shadow-xl whitespace-nowrap">
               {step.highlight}
             </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="min-h-[160px] flex flex-col justify-center mb-8">
          <h2 className="text-4xl font-black text-white tracking-tighter mb-4 uppercase animate-step-in italic">
            {step.title}
          </h2>
          <p className="text-blue-100/50 text-[13px] font-medium leading-relaxed max-w-[300px] mx-auto animate-fade-in" key={currentStep}>
            {step.description}
          </p>
        </div>

        {/* Step Navigation HUD */}
        <div className="flex items-center gap-4 mb-12">
           <span className="text-[10px] font-black text-white/20">0{currentStep + 1}</span>
           <div className="flex gap-2">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-700 ${i === currentStep ? 'bg-brand-orange w-8 shadow-[0_0_10px_rgba(255,95,0,0.5)]' : 'bg-white/10 w-2'}`}
                ></div>
              ))}
           </div>
           <span className="text-[10px] font-black text-white/20">03</span>
        </div>

        {/* Primary Interaction */}
        <div className="w-full space-y-4">
          <Button 
            variant="secondary" 
            className="w-full py-6 text-[11px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-brand-orange/30 transform active:scale-95 transition-all"
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? 'Engage Marketplace' : 'Initialize Next'}
          </Button>

          <button 
            onClick={onComplete}
            className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-white transition-colors py-2"
          >
            Skip Briefing Protocol
          </button>
        </div>
      </div>

      {/* Grid Coordinates Footer */}
      <div className="absolute bottom-12 inset-x-8 flex justify-between items-center opacity-20 text-[9px] font-mono text-white tracking-[0.2em]">
        <span>LAT: -17.8252</span>
        <div className="h-[1px] flex-1 mx-4 bg-white/20"></div>
        <span>LNG: 31.0335</span>
      </div>
    </div>
  );
};
