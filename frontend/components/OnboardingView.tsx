import React, { useState } from 'react';
import { Button } from './Shared';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  gradient: string;
  accentColor: string;
}

interface OnboardingViewProps {
  role: 'rider' | 'driver';
  onComplete: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ role, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const riderSteps: OnboardingStep[] = [
    {
      title: "Smart Dispatch",
      description: "Request rides or freight deliveries using natural language. Our AI understands landmarks and local context instantly.",
      icon: "wand-magic-sparkles",
      gradient: "from-blue-500 to-indigo-600",
      accentColor: "text-blue-600"
    },
    {
      title: "Bidding Market",
      description: "Drivers compete for your trip in real-time. Choose your partner based on price, rating, and vehicle class.",
      icon: "hand-holding-dollar",
      gradient: "from-orange-500 to-red-600",
      accentColor: "text-orange-600"
    },
    {
      title: "Safe Journey",
      description: "Every journey is monitored for your safety. Share your live location with trusted contacts with a single tap.",
      icon: "shield-halved",
      gradient: "from-green-500 to-emerald-600",
      accentColor: "text-green-600"
    }
  ];

  const driverSteps: OnboardingStep[] = [
    {
      title: "Mission Control",
      description: "Access a constant stream of high-value ride and freight requests across your designated service areas.",
      icon: "gauge-high",
      gradient: "from-orange-500 to-red-600",
      accentColor: "text-orange-600"
    },
    {
      title: "Strategic Bidding",
      description: "Set your own prices. Counter-offer on requests and build your reputation as an elite marketplace partner.",
      icon: "chart-line",
      gradient: "from-blue-500 to-indigo-600",
      accentColor: "text-blue-600"
    },
    {
      title: "Fleet Support",
      description: "Benefit from localized mapping and real-time traffic intelligence optimized for the Zimbabwean landscape.",
      icon: "map-location-dot",
      gradient: "from-purple-500 to-pink-600",
      accentColor: "text-purple-600"
    }
  ];

  const steps = role === 'rider' ? riderSteps : driverSteps;
  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 300);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-y-auto">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${step.gradient} opacity-10 blur-3xl rounded-full transition-all duration-1000`}></div>
        <div className={`absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr ${step.gradient} opacity-10 blur-3xl rounded-full transition-all duration-1000`}></div>
      </div>

      <div className="flex-1 flex flex-col px-6 sm:px-10 pt-12 sm:pt-16 pb-8 sm:pb-12 relative z-10 min-h-screen max-w-2xl mx-auto w-full">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-12 sm:mb-16 shrink-0">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                  i === currentStep 
                    ? `w-12 bg-gradient-to-r ${step.gradient}` 
                    : i < currentStep
                      ? 'w-6 bg-slate-400'
                      : 'w-6 bg-slate-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col items-center justify-center mb-12 sm:mb-16">
          {/* Icon container with enhanced design */}
          <div className={`relative w-full max-w-xs aspect-square mb-8 sm:mb-12 transition-all duration-500 ${
            isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}>
            {/* Decorative rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`absolute w-full h-full border-2 border-slate-300 rounded-full`}></div>
              <div className={`absolute w-[85%] h-[85%] border border-slate-200 rounded-full`}></div>
            </div>

            {/* Main icon card */}
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className={`relative w-full h-full rounded-[2rem] bg-white shadow-2xl flex items-center justify-center overflow-hidden group transition-all duration-500 hover:scale-105`}>
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-5`}></div>
                
                {/* Icon */}
                <div className={`relative z-10 text-7xl sm:text-8xl bg-gradient-to-br ${step.gradient} bg-clip-text text-transparent`}>
                  <i className={`fa-solid fa-${step.icon}`}></i>
                </div>

                {/* Hover shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>
            </div>

            {/* Step number badge */}
            <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br ${step.gradient} text-white font-black text-xl flex items-center justify-center shadow-lg z-20`}>
              {currentStep + 1}
            </div>
          </div>

          {/* Text content with improved typography */}
          <div className={`text-center px-4 sm:px-8 transition-all duration-500 ${
            isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 sm:mb-6 tracking-tight leading-tight">
              {step.title}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-md mx-auto">
              {step.description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto space-y-4 shrink-0">
          <Button 
            variant="primary"
            className={`w-full py-4 sm:py-5 rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] font-bold text-sm sm:text-base bg-gradient-to-r ${step.gradient} text-white border-0`}
            onClick={handleNext}
            aria-label={isLastStep ? 'Get started' : 'Continue to next step'}
          >
            {isLastStep ? 'Get Started' : 'Continue'}
          </Button>
          
          {!isLastStep && (
            <button 
              onClick={handleSkip}
              className="w-full py-3 text-sm text-slate-500 font-semibold hover:text-slate-700 transition-colors"
              aria-label="Skip onboarding"
            >
              Skip
            </button>
          )}
        </div>

        {/* Brand footer */}
        <div className="mt-6 sm:mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <div className="h-px w-8 bg-slate-300"></div>
            <span>RideIn Zimbabwe</span>
            <div className="h-px w-8 bg-slate-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
};