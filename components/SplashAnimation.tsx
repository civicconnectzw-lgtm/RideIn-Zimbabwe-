
import React, { useEffect, useState } from 'react';

export const SplashAnimation: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('NEURAL_IGNITION_');
  const [logs, setLogs] = useState<string[]>([]);

  const systemLogs = [
    "[BOOT] Initializing core protocols...",
    "[GRID] Fetching sector data for Zimbabwe...",
    "[AUTH] Establishing secure handshake...",
    "[AI] Loading Gemini Intelligence Layer...",
    "[NETWORK] Syncing with Ably Realtime Hub...",
    "[MAP] Calibrating Mapbox GL render engine...",
    "[NODE] Identity verification in progress...",
    "[SUCCESS] Uplink established."
  ];

  useEffect(() => {
    const duration = 2000; 
    const intervalTime = 16;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const baseProgress = (currentStep / steps) * 100;
      const burstProgress = Math.min(baseProgress + (Math.sin(currentStep * 0.1) * 3), 100);
      
      setProgress(burstProgress);

      if (burstProgress > 20 && burstProgress < 45) setLoadingText('SYNCING_SECTOR_GRID_');
      else if (burstProgress >= 45 && burstProgress < 75) setLoadingText('AUTHORIZING_UPLINK_');
      else if (burstProgress >= 75 && burstProgress < 95) setLoadingText('DEPLOYING_INTERFACE_');
      else if (burstProgress >= 95) setLoadingText('NODE_ONLINE');

      if (currentStep % Math.floor(steps / 8) === 0 && logs.length < systemLogs.length) {
        setLogs(prev => [...prev, systemLogs[prev.length]]);
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        setProgress(100);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [logs.length]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#000814] flex flex-col items-center justify-center overflow-hidden font-mono text-white">
      {/* CRT Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none z-[100] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,95,0,0.1)_0%,transparent_70%)]"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <div className="absolute top-12 left-8 text-[9px] text-brand-orange/30 space-y-1 z-10 hidden md:block">
        {logs.map((log, i) => (
          <div key={i} className="animate-fade-in text-brand-orange/60">&gt; {log}</div>
        ))}
      </div>

      <div className="relative z-20 flex flex-col items-center">
        <div className="mb-20 text-center relative animate-fade-in">
          <div className="absolute -inset-20 bg-brand-orange/5 blur-[100px] rounded-full animate-pulse-slow"></div>
          <div className="relative">
            <h1 className="text-8xl font-black text-white tracking-tighter italic leading-none select-none">
              Ride<span className="text-brand-orange">In</span>
            </h1>
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              <p className="text-[9px] font-black text-blue-300/40 uppercase tracking-[0.6em] whitespace-nowrap">Tactical_Zim_Node</p>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>
          </div>
        </div>

        <div className="w-80 relative animate-slide-up">
          <div className="flex justify-between items-end mb-4 px-1">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className={`w-1 h-1 rounded-full ${progress > 20 ? 'bg-brand-orange shadow-[0_0_5px_#FF5F00]' : 'bg-white/10'}`}></div>
                <div className={`w-1 h-1 rounded-full ${progress > 50 ? 'bg-brand-orange shadow-[0_0_5px_#FF5F00]' : 'bg-white/10'}`}></div>
                <div className={`w-1 h-1 rounded-full ${progress > 80 ? 'bg-brand-orange shadow-[0_0_5px_#FF5F00]' : 'bg-white/10'}`}></div>
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[150px]">{loadingText}</span>
            </div>
            <span className="text-[14px] font-black text-brand-orange tracking-tighter w-12 text-right">{Math.round(progress)}%</span>
          </div>
          
          <div className="h-1 w-full bg-white/5 rounded-full p-[1px] backdrop-blur-sm border border-white/5 overflow-hidden">
            <div 
              className="h-full bg-brand-orange rounded-full transition-all duration-75 ease-out shadow-[0_0_15px_#FF5F00]" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-3 px-6 py-2 rounded-full border border-white/5 bg-white/[0.01]">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse"></div>
           <span className="text-[8px] text-white/20 uppercase font-black tracking-[0.5em]">GRID_SECURITY: ALPHA_LOADED</span>
        </div>
      </div>
    </div>
  );
};
