
import React, { useState, useEffect } from 'react';
import { Button } from './Shared';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  gradient: string;
  accentColor: string;
  tagline: string;
}

export const PublicOnboardingView: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const steps: OnboardingStep[] = [
    {
      title: "Smart Mobility",
      description: "Zimbabwe's premier AI-powered transport platform. Experience seamless rides and freight delivery with intelligent routing optimized for local conditions.",
      icon: "rocket",
      gradient: "from-orange-500 via-red-500 to-pink-500",
      accentColor: "text-orange-500",
      tagline: "Journey Begins"
    },
    {
      title: "AI Assistant",
      description: "Powered by advanced AI for natural language requests. Simply describe where you need to go, and our smart system handles the rest with precision.",
      icon: "brain",
      gradient: "from-blue-500 via-indigo-500 to-purple-500",
      accentColor: "text-blue-500",
      tagline: "Smart Technology"
    },
    {
      title: "Fair Pricing",
      description: "Transparent bidding marketplace ensures competitive rates. Drivers compete for your trip, giving you the power to choose based on price and quality.",
      icon: "hand-holding-dollar",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      accentColor: "text-emerald-500",
      tagline: "Best Value"
    }
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 300);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className={`absolute top-1/4 -left-1/4 w-96 h-96 bg-gradient-to-br ${step.gradient} opacity-10 blur-3xl rounded-full transition-all duration-1000 ease-in-out`}></div>
        <div className={`absolute bottom-1/4 -right-1/4 w-96 h-96 bg-gradient-to-br ${step.gradient} opacity-10 blur-3xl rounded-full transition-all duration-1000 ease-in-out`}></div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Brand header */}
        <div className={`mb-8 sm:mb-12 text-center transition-all duration-500 ${isAnimating ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Ride<span className={`${step.accentColor}`}>In</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wider">ZIMBABWE</p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center gap-2 mb-8 sm:mb-12">
          {steps.map((_, index) => (
            <div key={index} className="relative">
              <div className={`h-2 rounded-full transition-all duration-500 ${
                index === currentStep 
                  ? 'w-12 bg-gradient-to-r ' + step.gradient 
                  : index < currentStep
                    ? 'w-8 bg-slate-600'
                    : 'w-8 bg-slate-700'
              }`}></div>
              {index === currentStep && (
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${step.gradient} animate-pulse opacity-40`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Icon container with enhanced animations */}
        <div className={`relative w-full max-w-xs aspect-square mb-8 sm:mb-12 transition-all duration-500 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          {/* Animated rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`absolute w-full h-full border-2 border-slate-700 rounded-full animate-pulse`}></div>
            <div className={`absolute w-[85%] h-[85%] border border-slate-700/50 rounded-full animate-reverse-spin`}></div>
            <div className={`absolute w-[70%] h-[70%] border border-slate-700/30 rounded-full animate-spin-slow`}></div>
          </div>

          {/* Main icon container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl border border-slate-700/50 backdrop-blur-xl overflow-hidden group transition-all duration-500 hover:scale-105`}>
              {/* Glassmorphism overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
              
              {/* Icon with gradient */}
              <div className={`relative z-10 text-7xl sm:text-8xl bg-gradient-to-br ${step.gradient} bg-clip-text text-transparent transition-all duration-500`}>
                <i className={`fa-solid fa-${step.icon}`}></i>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </div>
          </div>

          {/* Step indicator badge */}
          <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-xs font-bold tracking-wider shadow-lg bg-gradient-to-r ${step.gradient} text-white whitespace-nowrap z-20`}>
            {step.tagline}
          </div>
        </div>

        {/* Content section with improved typography */}
        <div className={`w-full text-center mb-8 sm:mb-12 px-4 transition-all duration-500 ${
          isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
            {step.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-sm mx-auto">
            {step.description}
          </p>
        </div>

        {/* Action buttons with improved styling */}
        <div className="w-full space-y-4 px-4">
          <Button 
            variant="primary"
            className={`w-full py-4 sm:py-5 text-sm sm:text-base font-bold rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r ${step.gradient} text-white border-0`}
            onClick={handleNext}
            aria-label={currentStep === steps.length - 1 ? 'Get started' : 'Continue to next step'}
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
          </Button>

          {currentStep < steps.length - 1 && (
            <button 
              onClick={handleSkip}
              className="w-full py-3 text-sm text-slate-400 font-medium hover:text-white transition-colors"
              aria-label="Skip onboarding"
            >
              Skip
            </button>
          )}
        </div>

        {/* Step counter */}
        <div className="mt-6 sm:mt-8 text-xs text-slate-500 font-medium">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
};
