
import React, { useState } from 'react';
import { Button } from './Shared';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  color: string;
  tag: string;
}

interface OnboardingViewProps {
  role: 'rider' | 'driver';
  onComplete: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ role, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const riderSteps: OnboardingStep[] = [
    {
      title: "Tactical Dispatch",
      description: "Use Magic Assist to request rides using natural language. Just tell us where you are and where you're going.",
      icon: "wand-magic-sparkles",
      color: "text-brand-orange",
      tag: "AI POWERED"
    },
    {
      title: "Elite Marketplace",
      description: "Drivers bid for your trip in real-time. Choose the best price, rating, or ETA that suits your mission.",
      icon: "hand-holding-dollar",
      color: "text-emerald-500",
      tag: "BID PROTOCOL"
    },
    {
      title: "Freight Protocol",
      description: "Moving heavy gear? Switch to Freight mode to request anything from a bike to a 10-tonne truck.",
      icon: "truck-ramp-box",
      color: "text-blue-400",
      tag: "LOGISTICS"
    }
  ];

  const driverSteps: OnboardingStep[] = [
    {
      title: "Online Protocol",
      description: "Toggle 'Go Online' to broadcast your location to the grid and start receiving live ride requests.",
      icon: "signal",
      color: "text-emerald-500",
      tag: "BROADCAST"
    },
    {
      title: "Strategic Bidding",
      description: "See a request? Counter with your best price. High ratings and fair bids win more missions.",
      icon: "gavel",
      color: "text-brand-orange",
      tag: "BIDDING"
    },
    {
      title: "Safety First",
      description: "Your safety is monitored. Use the Safety Hub to trigger SOS or share your live status with dispatch.",
      icon: "shield-halved",
      color: "text-red-500",
      tag: "SECURITY"
    }
  ];

  const steps = role === 'rider' ? riderSteps : driverSteps;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-brand-blue/98 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-fade-in overflow-hidden">
      {/* Tech HUD Background */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border border-white/5 rounded-full animate-reverse-spin pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-brand-orange/10 rounded-full animate-spin-slow pointer-events-none"></div>
      
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center text-center">
        {/* Step Progress HUD */}
        <div className="flex gap-3 mb-16">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-700 ${i === currentStep ? 'bg-brand-orange w-12 shadow-[0_0_10px_rgba(255,95,0,0.5)]' : 'bg-white/10 w-6'}`}
            ></div>
          ))}
        </div>

        {/* Icon Sphere */}
        <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/5 rounded-full border border-white/10 animate-pulse"></div>
          <div className="w-32 h-32 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl border border-white/10 flex items-center justify-center shadow-2xl relative rotate-3">
             <i className={`fa-solid fa-${step.icon} text-5xl ${step.color} drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}></i>
             <div className="absolute -bottom-3 bg-brand-orange text-white text-[8px] font-black px-3 py-1 rounded-full tracking-[0.2em] shadow-lg">
               {step.tag}
             </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="min-h-[140px] flex flex-col justify-center">
          <h2 className="text-3xl font-black text-white tracking-tighter mb-4 animate-step-in uppercase italic">
            {step.title}
          </h2>
          <p className="text-blue-100/50 text-[13px] font-medium leading-relaxed max-w-[280px] mx-auto animate-fade-in" key={currentStep}>
            {step.description}
          </p>
        </div>

        {/* Action Button */}
        <div className="w-full mt-12 space-y-4">
          <Button 
            variant="secondary" 
            className="w-full py-6 text-[11px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-brand-orange/30 transform active:scale-95 transition-all"
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? 'Engage Protocol' : 'Initialize Next'}
          </Button>

          <button 
            onClick={onComplete}
            className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-white transition-colors py-2"
          >
            Skip Briefing
          </button>
        </div>
      </div>

      <div className="absolute bottom-12 text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">
        RideIn Tactical Authorization v1.0
      </div>
    </div>
  );
};
