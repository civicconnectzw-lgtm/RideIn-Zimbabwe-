
import React, { useState, useEffect, useRef } from 'react';
import { geminiService } from '../services/gemini';

export const ScoutView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{text: string; grounding: any[]} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.debug("Location access denied for Scout")
      );
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [response, loading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResponse(null);
    
    try {
        const result = await geminiService.scout(query, userLocation);
        setResponse(result);
    } catch (err) {
        setResponse({ text: "CRITICAL: Intelligence node connection timed out.", grounding: [] });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#000814] flex flex-col animate-fade-in font-mono">
        {/* Terminal Header */}
        <div className="bg-[#001D3D] border-b border-brand-orange/20 p-6 pt-12 safe-top">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></div>
                    <h1 className="text-brand-orange text-xs font-black uppercase tracking-[0.4em]">Tactical Scout v4.2</h1>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-blue-200/50 hover:text-white transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <form onSubmit={handleSearch} className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-orange text-xs">$</div>
                <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter command or query..." 
                    className="w-full pl-10 pr-14 py-3 rounded-lg bg-black/40 border border-white/5 text-brand-orange placeholder-blue-900/50 text-sm focus:outline-none focus:border-brand-orange/50 transition-all"
                />
                <button type="submit" disabled={!query || loading} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-orange/40 hover:text-brand-orange transition-colors">
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                </button>
            </form>
        </div>

        {/* Console Output */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            {!response && !loading && (
                <div className="space-y-4 opacity-40">
                    <p className="text-[10px] text-blue-300">SYSTEM: Awaiting input...</p>
                    <p className="text-[10px] text-blue-300">GPS_LOCK: {userLocation ? 'ESTABLISHED' : 'SEARCHING...'}</p>
                    <div className="pt-20 flex flex-col items-center">
                        <i className="fa-solid fa-satellite-dish text-4xl text-brand-orange/20 mb-4"></i>
                        <p className="text-[9px] uppercase tracking-widest text-blue-900">Map Intelligence Protocol Active</p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-3 animate-pulse">
                    <span className="text-brand-orange text-xs">$ SCANNING_ZIMBABWE_GRID...</span>
                    <span className="cursor-blink"></span>
                </div>
            )}

            {response && (
                <div className="space-y-8 animate-fade-in pb-10">
                    <div className="bg-black/40 border border-white/5 p-6 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-brand-orange/50"></div>
                        <p className="text-[10px] text-blue-900 mb-4 uppercase tracking-widest">&gt;&gt; Intelligence_Report.txt</p>
                        <div className="text-blue-100 text-[13px] leading-relaxed whitespace-pre-line">
                           {response.text}
                           <span className="cursor-blink ml-1"></span>
                        </div>
                    </div>

                    {response.grounding && response.grounding.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-[9px] font-black text-blue-900 uppercase tracking-[0.4em] ml-2">Grounded Geo-Sources</p>
                            <div className="grid grid-cols-1 gap-3">
                                {response.grounding.map((chunk: any, i: number) => {
                                    const title = chunk.maps?.title || chunk.web?.title || "Data Link";
                                    const uri = chunk.maps?.uri || chunk.web?.uri;
                                    if (!uri) return null;

                                    return (
                                        <a key={i} href={uri} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 bg-[#001D3D]/50 border border-white/5 p-4 rounded-lg hover:border-brand-orange/30 transition-all">
                                            <div className="w-8 h-8 bg-brand-orange/10 flex items-center justify-center text-brand-orange rounded">
                                                <i className="fa-solid fa-link text-xs"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-brand-orange uppercase truncate tracking-widest">GEO:DATA_{i+1}</p>
                                                <p className="text-[12px] text-blue-200 truncate">{title}</p>
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-[10px] text-blue-900 group-hover:text-brand-orange"></i>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
