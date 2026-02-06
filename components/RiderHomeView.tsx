
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { User, Trip, TripStatus, VehicleType, Bid, PassengerCategory, FreightCategory } from '../types';
import { Button, Card, Badge, Input } from './Shared';
import { xanoService } from '../services/xano';
import { ablyService } from '../services/ably';
import { mapboxService } from '../services/mapbox';
import { geminiService } from '../services/gemini';
import { ActiveTripView } from './ActiveTripView';
import { SideDrawer } from './SideDrawer';
import { OnboardingView } from './OnboardingView';
import { ScoutView } from './ScoutView';
import { PASSENGER_CATEGORIES, FREIGHT_CATEGORIES } from '../constants';

const MapView = React.lazy(() => import('./MapView'));

const calculateSuggestedFare = (distanceKm: number) => {
  return Math.max(2, distanceKm <= 3 ? 2 : distanceKm <= 5 ? 3 : 3 + (distanceKm - 5) * 0.5);
};

export const RiderHomeView: React.FC<{ user: User; onLogout: () => void; onUserUpdate: (user: User) => void }> = ({ user, onLogout, onUserUpdate }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [activeTab, setActiveTab] = useState<'ride' | 'freight'>('ride');
  const [viewState, setViewState] = useState<'idle' | 'review' | 'bidding' | 'active'>('idle');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showScout, setShowScout] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.0335, -17.8252]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeDetails, setRouteDetails] = useState<{distance: string, duration: string} | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<Map<string, any>>(new Map());
  const [proposedFare, setProposedFare] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(PASSENGER_CATEGORIES[0].name);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [fareExplanation, setFareExplanation] = useState<string | null>(null);

  // Tactical Initial GPS Lock
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setMapCenter(coords);
          setPickupCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          mapboxService.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(setPickup);
        },
        (err) => console.warn("[GPS] Signal acquisition failed", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Sync with Active Trip
  useEffect(() => {
    const unsub = xanoService.subscribeToActiveTrip((trip) => {
      if (trip && trip.status !== TripStatus.COMPLETED && trip.status !== TripStatus.CANCELLED) {
        setActiveTrip(trip);
        setViewState('active');
      } else if (viewState === 'active') {
        setActiveTrip(null);
        setViewState('idle');
      }
    });
    return unsub;
  }, [viewState]);

  // Presence for Nearby Drivers
  useEffect(() => {
    const cleanup = ablyService.subscribeToNearbyDrivers(user.city || 'Harare', mapCenter[1], mapCenter[0], (driver) => {
      setNearbyDrivers(prev => {
        const next = new Map(prev);
        next.set(driver.driverId, driver);
        return next;
      });
    });
    return cleanup;
  }, [mapCenter, user.city]);

  // Route Calculation
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      setIsRouting(true);
      mapboxService.getRoute(pickupCoords, dropoffCoords).then(route => {
        if (route) {
          setRouteGeometry(route.geometry);
          setRouteDetails({ distance: `${route.distance}km`, duration: `${route.duration}m` });
          const fare = calculateSuggestedFare(parseFloat(route.distance));
          setProposedFare(fare);
          setViewState('review');
        }
        setIsRouting(false);
      });
    }
  }, [pickupCoords, dropoffCoords]);

  // Listen for Bids
  useEffect(() => {
    if (activeTrip && activeTrip.status === TripStatus.BIDDING) {
      const unsub = ablyService.subscribeToRideEvents(activeTrip.id, (event) => {
        if (event.id) { // it's a bid
          setBids(prev => prev.some(b => b.id === event.id) ? prev : [...prev, event]);
        }
      });
      return unsub;
    }
  }, [activeTrip]);

  const handleMagicDispatch = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await geminiService.parseDispatchPrompt(aiPrompt, pickupCoords || undefined);
      if (result) {
        if (result.pickup) {
          setPickup(result.pickup);
          const p = await mapboxService.searchAddress(result.pickup);
          if (p[0]) setPickupCoords({ lat: p[0].lat, lng: p[0].lng });
        }
        if (result.dropoff) {
          setDropoff(result.dropoff);
          const d = await mapboxService.searchAddress(result.dropoff);
          if (d[0]) setDropoffCoords({ lat: d[0].lat, lng: d[0].lng });
        }
        if (result.category) setSelectedCategory(result.category);
        setAiPrompt('');
      }
    } catch (e) {
      console.error("[Magic] Dispatch parse error", e);
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleRequestTrip = async () => {
    if (!pickupCoords || !dropoffCoords) return;
    setLoading(true);
    try {
      const trip = await xanoService.requestTrip({
        riderId: user.id,
        type: activeTab === 'ride' ? VehicleType.PASSENGER : VehicleType.FREIGHT,
        category: selectedCategory,
        pickup: { address: pickup, lat: pickupCoords.lat, lng: pickupCoords.lng },
        dropoff: { address: dropoff, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
        proposed_price: proposedFare,
        distance_km: parseFloat(routeDetails?.distance || "0"),
        duration: parseInt(routeDetails?.duration || "0"),
      });
      setActiveTrip(trip);
      setViewState('bidding');
    } catch (e) {
      alert("Grid error: Trip request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bid: Bid) => {
    if (!activeTrip) return;
    setLoading(true);
    try {
      const trip = await xanoService.acceptBid(activeTrip.id, bid.id);
      setActiveTrip(trip);
      setViewState('active');
    } catch (e) {
      alert("Protocol error: Could not secure bid.");
    } finally {
      setLoading(false);
    }
  };

  const handleExplainFare = async () => {
    if (!proposedFare) return;
    setFareExplanation("Consulting Fare Guard...");
    const explanation = await geminiService.explainFare({
      pickup,
      dropoff,
      price: proposedFare.toString()
    });
    setFareExplanation(explanation);
  };

  const mapMarkers = useMemo(() => {
    const markers: any[] = [];
    if (pickupCoords) markers.push({ id: 'pickup', ...pickupCoords, type: 'pickup' });
    if (dropoffCoords) markers.push({ id: 'dropoff', ...dropoffCoords, type: 'dropoff' });
    nearbyDrivers.forEach(d => markers.push({ id: d.driverId, ...d, type: 'driver' }));
    return markers;
  }, [pickupCoords, dropoffCoords, nearbyDrivers]);

  if (viewState === 'active' && activeTrip) {
    return <ActiveTripView trip={activeTrip} role="rider" onClose={() => setViewState('idle')} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#000814] relative overflow-hidden font-mono">
      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={user} 
        onLogout={onLogout} 
        activeView={activeView} 
        onNavigate={(view) => {
           if (view === 'scout') setShowScout(true);
           else setActiveView(view);
        }} 
        onUserUpdate={onUserUpdate} 
      />

      {showScout && <ScoutView onClose={() => setShowScout(false)} />}

      {/* Header HUD */}
      <div className="absolute top-0 inset-x-0 z-30 p-6 pt-12 safe-top bg-gradient-to-b from-[#000814] to-transparent pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={() => setIsDrawerOpen(true)} className="w-12 h-12 bg-white/5 backdrop-blur-3xl rounded-2xl flex items-center justify-center text-white border border-white/10 haptic-press shadow-2xl">
            <i className="fa-solid fa-bars-staggered text-xl"></i>
          </button>
          
          <div className="flex bg-white/5 backdrop-blur-3xl rounded-2xl p-1 border border-white/10 shadow-2xl">
            <button onClick={() => setActiveTab('ride')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ride' ? 'bg-brand-orange text-white shadow-lg' : 'text-white/30'}`}>Rider</button>
            <button onClick={() => setActiveTab('freight')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'freight' ? 'bg-brand-orange text-white shadow-lg' : 'text-white/30'}`}>Freight</button>
          </div>

          <div className="w-12 h-12"></div>
        </div>
      </div>

      {/* Core Map Logic */}
      <div className="flex-1 relative">
        <Suspense fallback={<div className="w-full h-full bg-[#000814] animate-pulse" />}>
          <MapView 
            center={mapCenter} 
            markers={mapMarkers} 
            routeGeometry={routeGeometry} 
            zoom={14} 
            onLocationPick={(lat, lng) => {
              if (!pickupCoords) {
                setPickupCoords({ lat, lng });
                mapboxService.reverseGeocode(lat, lng).then(setPickup);
              } else if (!dropoffCoords) {
                setDropoffCoords({ lat, lng });
                mapboxService.reverseGeocode(lat, lng).then(setDropoff);
              }
            }}
          />
        </Suspense>

        {/* Tactical UI Overlays */}
        {viewState === 'idle' && (
          <div className="absolute bottom-10 inset-x-6 z-30 space-y-4 animate-slide-up">
            <Card variant="glass" className="!p-4 bg-black/60 backdrop-blur-2xl border-white/5 shadow-2xl rounded-[2.5rem]">
              <div className="relative mb-4">
                <Input 
                  variant="glass" 
                  placeholder="Where to, Commander?" 
                  icon="wand-magic-sparkles" 
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="!bg-transparent border-0"
                  onKeyDown={e => e.key === 'Enter' && handleMagicDispatch()}
                />
                {aiPrompt && (
                  <button onClick={handleMagicDispatch} disabled={isAiParsing} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-brand-orange rounded-xl text-white shadow-lg haptic-press">
                    {isAiParsing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors" onClick={() => {/* Open search */}}>
                   <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6]"></div>
                   <p className="text-xs font-bold text-white/40 truncate">{pickup || 'Tactical Pickup Point'}</p>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="w-2 h-2 rounded-full bg-brand-orange shadow-[0_0_8px_#FF5F00]"></div>
                   <p className="text-xs font-bold text-white/40 truncate">{dropoff || 'Set Mission Objective'}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {viewState === 'review' && (
          <div className="absolute bottom-0 inset-x-0 z-40 bg-[#001D3D] rounded-t-[3rem] p-8 shadow-2xl animate-slide-up border-t border-white/5">
            <div className="w-14 h-1.5 bg-white/5 rounded-full mx-auto mb-8"></div>
            
            <div className="flex justify-between items-end mb-8">
               <div>
                  <h3 className="text-[10px] font-black text-brand-orange uppercase tracking-[0.4em] mb-1">Mission Quote</h3>
                  <div className="text-4xl font-black text-white tracking-tighter">${proposedFare.toFixed(2)}</div>
               </div>
               <button onClick={handleExplainFare} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white transition-colors haptic-press">
                  <i className="fa-solid fa-shield-halved"></i>
               </button>
            </div>

            {fareExplanation && (
              <div className="mb-8 p-4 bg-brand-orange/5 border border-brand-orange/10 rounded-2xl animate-fade-in">
                 <p className="text-[10px] text-brand-orange font-bold leading-relaxed italic">"{fareExplanation}"</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-8">
              {(activeTab === 'ride' ? PASSENGER_CATEGORIES : FREIGHT_CATEGORIES).map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 haptic-press ${selectedCategory === cat.name ? 'border-brand-orange bg-brand-orange/10 shadow-[0_0_15px_rgba(255,95,0,0.1)]' : 'border-white/5 bg-white/5 opacity-40'}`}
                >
                  <i className={`fa-solid fa-${cat.icon} text-lg ${selectedCategory === cat.name ? 'text-brand-orange' : 'text-white'}`}></i>
                  <span className="text-[8px] font-black uppercase tracking-widest">{cat.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
               <Button variant="ghost" className="flex-1 py-6 !rounded-2xl text-white/20" onClick={() => {setPickupCoords(null); setDropoffCoords(null); setViewState('idle');}}>Abort</Button>
               <Button variant="secondary" className="flex-[3] py-6 !rounded-3xl text-sm font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(255,95,0,0.2)]" loading={loading} onClick={handleRequestTrip}>Initiate Request</Button>
            </div>
          </div>
        )}

        {viewState === 'bidding' && (
          <div className="absolute inset-0 z-50 bg-[#000814]/90 backdrop-blur-xl flex flex-col p-8 safe-top">
             <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative mb-12">
                   <div className="absolute -inset-10 bg-brand-orange/10 blur-3xl rounded-full animate-pulse-slow"></div>
                   <div className="w-32 h-32 border-4 border-brand-orange/20 rounded-[3rem] flex items-center justify-center relative z-10">
                      <i className="fa-solid fa-satellite-dish text-5xl text-brand-orange animate-pulse"></i>
                   </div>
                </div>
                
                <h2 className="text-3xl font-black text-white italic tracking-tighter mb-4 uppercase">Broadcasting Grid...</h2>
                <p className="text-blue-100/30 text-[10px] font-bold uppercase tracking-[0.4em] mb-12 max-w-[200px] leading-relaxed">Securing tactical bids from nearby drivers in {user.city}</p>

                <div className="w-full space-y-4 max-w-sm">
                   {bids.length === 0 ? (
                      <div className="py-20 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center text-white/10 italic">
                         <span className="text-xs">Scanning sector...</span>
                      </div>
                   ) : (
                      bids.map(bid => (
                        <Card key={bid.id} className="!bg-[#001D3D] border-0 !p-5 rounded-[2rem] flex items-center justify-between animate-scale-in group">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-white/5 overflow-hidden">
                                 <img src={bid.driverAvatar || `https://ui-avatars.com/api/?name=${bid.driverName}&background=random`} alt={bid.driverName} />
                              </div>
                              <div className="text-left">
                                 <h4 className="font-black text-white text-sm tracking-tight">{bid.driverName}</h4>
                                 <div className="flex items-center gap-2 mt-0.5">
                                    <Badge color="orange" className="!text-[7px]">{bid.driverRating} ★</Badge>
                                    <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">{bid.vehicleInfo}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="text-right flex flex-col items-end gap-2">
                              <div className="text-xl font-black text-white tracking-tighter">${bid.amount}</div>
                              <button onClick={() => handleAcceptBid(bid)} className="px-4 py-2 bg-brand-orange text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all">Select</button>
                           </div>
                        </Card>
                      ))
                   )}
                </div>
             </div>
             
             <button onClick={() => xanoService.cancelTrip(activeTrip!.id).then(() => setViewState('idle'))} className="mt-auto py-8 text-[10px] font-black text-white/20 uppercase tracking-[0.5em] hover:text-red-500 transition-colors">
                Cancel Deployment
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
