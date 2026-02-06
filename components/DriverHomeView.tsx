
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Trip, VehicleType, TripStatus } from '../types';
import { Button, Card, Badge } from './Shared';
import { xanoService } from '../services/xano';
import { ablyService } from '../services/ably';
import { geminiService } from '../services/gemini';
import { SideDrawer } from './SideDrawer';
import { ActiveTripView } from './ActiveTripView';
import { getHaversineDistance } from '../services/utils';

export const DriverHomeView: React.FC<{ user: User; onLogout: () => void; onUserUpdate: (user: User) => void }> = ({ user, onLogout, onUserUpdate }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [marketIntel, setMarketIntel] = useState<string>('');
  const [biddingTrip, setBiddingTrip] = useState<Trip | null>(null);
  const [counterAmount, setCounterAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: -17.8252, lng: 31.0335 });
  const lastRotation = useRef(0);
  const lastCoords = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (lastCoords.current) {
            const dy = newCoords.lat - lastCoords.current.lat;
            const dx = newCoords.lng - lastCoords.current.lng;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) {
              lastRotation.current = Math.atan2(dy, dx) * (180 / Math.PI);
            }
          }
          setLocation(newCoords);
          lastCoords.current = newCoords;

          if (isOnline) {
            ablyService.publishDriverLocation(user.id, user.city || 'Harare', newCoords.lat, newCoords.lng, lastRotation.current);
          }
        },
        undefined,
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, user.id, user.city]);

  useEffect(() => {
    let unsubRequests: (() => void) | null = null;
    if (isOnline) {
      geminiService.getMarketIntel(user.city || 'Harare').then(setMarketIntel);
      ablyService.enterDriverPresence(user.city || 'Harare', location.lat, location.lng, { userId: user.id, role: 'driver', avatar: user.avatar, name: user.name });
      const setupSubs = async () => {
        const cleanup = await ablyService.subscribeToRequests(user.city || 'Harare', location.lat, location.lng, (data: Trip) => {
           setAvailableTrips(prev => prev.some(t => t.id === data.id) ? prev : [data, ...prev]);
        });
        unsubRequests = cleanup;
      };
      setupSubs();
    }
    return () => { 
      if (unsubRequests) unsubRequests();
      if (isOnline) ablyService.leaveDriverPresence(user.city || 'Harare', location.lat, location.lng); 
    };
  }, [isOnline, user.city, location.lat, location.lng]);

  useEffect(() => {
    const unsub = xanoService.subscribeToActiveTrip((trip) => {
      if (trip && (trip.status === TripStatus.ACCEPTED || trip.status === TripStatus.ARRIVING || trip.status === TripStatus.IN_PROGRESS)) {
        setActiveTrip(trip);
      } else {
        setActiveTrip(null);
      }
    });
    return unsub;
  }, []);

  const sortedTrips = useMemo(() => {
    return availableTrips
      .map(trip => ({ ...trip, dist: getHaversineDistance(location.lat, location.lng, trip.pickup.lat, trip.pickup.lng) }))
      .filter(trip => trip.dist < 25) 
      .sort((a, b) => a.dist - b.dist);
  }, [availableTrips, location]);

  const handlePlaceBid = async () => {
    if (!biddingTrip) return;
    setLoading(true);
    try {
      await xanoService.submitBid(biddingTrip.id, parseFloat(counterAmount), user);
      setBiddingTrip(null);
      setAvailableTrips(prev => prev.filter(t => t.id !== biddingTrip.id));
    } catch (e) { alert("Bid failed."); } finally { setLoading(false); }
  };

  if (activeTrip) return <ActiveTripView trip={activeTrip} role="driver" onClose={() => setActiveTrip(null)} />;

  return (
    <div className="h-screen flex flex-col bg-[#000814] relative overflow-hidden font-sans">
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} user={user} onLogout={onLogout} activeView={activeView} onNavigate={setActiveView} onUserUpdate={onUserUpdate} />
      <div className="bg-[#001D3D] p-6 pt-12 flex justify-between items-center shadow-2xl safe-top border-b border-white/5 shrink-0 z-30">
         <button onClick={() => setIsDrawerOpen(true)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white haptic-press"><i className="fa-solid fa-bars-staggered text-xl"></i></button>
         <div className="text-center">
            <p className="text-[10px] font-black text-brand-orange uppercase tracking-[0.3em] mb-1">Fleet Node: {user.name.split(' ')[0]}</p>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-white/10'}`}></div>
              <p className="font-black text-white text-[11px] uppercase tracking-widest">{isOnline ? 'Protocol: Online' : 'Dormant'}</p>
            </div>
         </div>
         <button onClick={() => setIsOnline(!isOnline)} className={`px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all haptic-press ${isOnline ? 'bg-brand-orange text-white shadow-lg' : 'bg-white/10 text-white/40'}`}>
            {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
         </button>
      </div>
      <div className="flex-1 p-4 space-y-4 pb-32 overflow-y-auto no-scrollbar relative">
         {isOnline ? (
            <>
               {marketIntel && (
                  <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-3xl p-6 mb-2 animate-fade-in relative overflow-hidden group">
                     <p className="text-[9px] font-black text-brand-orange uppercase tracking-[0.3em] mb-2">Neural Market Intel</p>
                     <p className="text-[11px] font-bold text-white/80 leading-relaxed italic">"{marketIntel}"</p>
                  </div>
               )}
               {sortedTrips.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-white/20 text-center animate-fade-in">
                     <i className="fa-solid fa-satellite-dish text-6xl animate-pulse mb-6"></i>
                     <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-2">Scanning Grid...</h3>
                  </div>
               ) : (
                  sortedTrips.map(trip => (
                     <Card key={trip.id} className="p-7 animate-slide-up bg-[#001D3D] border-0 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-white/5">
                        <div className="flex justify-between items-start mb-6">
                           <Badge color={trip.type === VehicleType.FREIGHT ? 'orange' : 'blue'}>{trip.category}</Badge>
                           <div className="text-right">
                              <div className="text-3xl font-black text-white tracking-tighter">${trip.proposed_price}</div>
                              <div className="text-[9px] font-black text-brand-orange uppercase tracking-widest mt-1">{trip.dist.toFixed(1)}km away</div>
                           </div>
                        </div>
                        <div className="space-y-4 mb-8">
                           <div className="flex gap-4">
                              <div className="w-2 h-2 bg-brand-orange rounded-full mt-1.5 shrink-0"></div>
                              <p className="text-xs font-bold text-white/70 truncate">{trip.pickup.address}</p>
                           </div>
                           <div className="flex gap-4">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>
                              <p className="text-xs font-bold text-white/70 truncate">{trip.dropoff.address}</p>
                           </div>
                        </div>
                        <div className="flex gap-3 relative z-10">
                           <Button variant="ghost" className="flex-1 py-4 text-[9px] font-black uppercase tracking-widest !rounded-2xl text-white/30" onClick={() => setAvailableTrips(prev => prev.filter(t => t.id !== trip.id))}>Skip</Button>
                           <Button className="flex-[2] py-4 text-[9px] font-black uppercase tracking-widest !rounded-2xl shadow-xl" variant="secondary" onClick={() => { setBiddingTrip(trip); setCounterAmount(trip.proposed_price.toString()); }}>Engage</Button>
                        </div>
                     </Card>
                  ))
               )}
            </>
         ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-white/10 animate-fade-in">
               <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6"><i className="fa-solid fa-moon text-4xl"></i></div>
               <h3 className="text-lg font-black tracking-tight uppercase">Dormant Node</h3>
            </div>
         )}
      </div>
      {biddingTrip && (
         <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/80 backdrop-blur-xl p-6 animate-fade-in">
            <div className="bg-[#001D3D] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Strategic Bounty</h3>
                  <button onClick={() => setBiddingTrip(null)} className="text-white/40 hover:text-white transition-colors haptic-press"><i className="fa-solid fa-xmark text-xl"></i></button>
               </div>
               <div className="mb-14 text-center">
                  <input type="number" autoFocus inputMode="decimal" value={counterAmount} onChange={e => setCounterAmount(e.target.value)} className="bg-transparent border-0 text-center text-8xl font-black text-white outline-none w-full tracking-tighter" />
               </div>
               <Button className="w-full py-7 text-sm font-black uppercase tracking-[0.3em] rounded-3xl shadow-2xl" variant="secondary" onClick={handlePlaceBid} loading={loading}>Execute Deployment</Button>
            </div>
         </div>
      )}
    </div>
  );
};
