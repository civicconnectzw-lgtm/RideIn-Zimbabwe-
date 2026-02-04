
import React, { useEffect, useState } from 'react';

export const SplashAnimation: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Production Ignition...');

  useEffect(() => {
    // Optimized duration for faster first-time experience (2.8s)
    const duration = 2800; 
    const intervalTime = 40;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const percent = Math.min((currentStep / steps) * 100, 100);
      setProgress(percent);

      if (percent > 20 && percent < 50) setLoadingText('Verifying SSL Integrity...');
      else if (percent >= 50 && percent < 80) setLoadingText('Stabilizing Marketplace...');
      else if (percent >= 80) setLoadingText('Node: LIVE');

      if (currentStep >= steps) clearInterval(timer);
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-brand-blue flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-orange/20 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-blue-light/30 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-20 text-center animate-fade-in">
           <div className="flex items-baseline justify-center">
             <h1 className="text-7xl font-black text-white tracking-tighter italic">RideIn</h1>
           </div>
           <p className="text-[10px] font-bold text-blue-200 uppercase tracking-[0.4em] mt-3">Zimbabwe Edition • Production</p>
        </div>

        <div className="w-64">
          <div className="flex justify-between items-end mb-2">
             <span className="text-[10px] font-bold text-white uppercase tracking-widest animate-pulse">{loadingText}</span>
             <span className="text-[10px] font-black text-brand-orange">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
             <div 
               className="h-full bg-brand-orange transition-all duration-300 ease-out shadow-[0_0_15px_rgba(255,95,0,0.5)]" 
               style={{ width: `${progress}%` }}
             ></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-center animate-fade-in" style={{ animationDelay: '1s' }}>
         <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[9px] font-bold text-blue-200 uppercase tracking-[0.3em]">AI Intelligence Active</span>
         </div>
         <div className="text-[8px] text-blue-300/50 uppercase font-medium">© 2025 RideIn Zimbabwe • Secure Node</div>
      </div>
    </div>
  );
};
