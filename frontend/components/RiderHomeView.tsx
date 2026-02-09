import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { User, Trip, TripStatus, VehicleType } from '../types';
import { Button, Card, Input } from './Shared';
import { xanoService } from '../services/xano';
import { mapboxService, GeoResult } from '../services/mapbox';
import { geminiService } from '../services/gemini';
import { ActiveTripView } from './ActiveTripView';
import { SideDrawer } from './SideDrawer';
import { ScoutView } from './ScoutView';
import { TripHistoryView } from './TripHistoryView';
import { ProfileView } from './ProfileView';
import { FavouritesView } from './FavouritesView';
import { PASSENGER_CATEGORIES, FREIGHT_CATEGORIES } from '../constants';
import { useToastContext } from '../hooks/useToastContext';
import { calculateTripPrice, getPriceBreakdown } from '../services/pricing';

const MapView = React.lazy(() => import('./MapView'));

export const RiderHomeView: React.FC<{ user: User; onLogout: () => void; onUserUpdate: (user: User) => void }> = ({ user, onLogout, onUserUpdate }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ride' | 'freight'>('ride');
  const [viewState, setViewState] = useState<'idle' | 'review' | 'bidding' | 'active'>('idle');
  const [showScout, setShowScout] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.0335, -17.8252]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [proposedFare, setProposedFare] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(PASSENGER_CATEGORIES[0].name);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | null>(null);

  // Item 18: Freight booking fields
  const [itemDescription, setItemDescription] = useState('');
  const [requiresAssistance, setRequiresAssistance] = useState(false);
  const [cargoPhotos, setCargoPhotos] = useState<string[]>([]);

  const toast = useToastContext();

  // Calculate price breakdown for display
  const priceBreakdown = useMemo(() => {
    if (routeDistance === 0) return null;
    const vehicleType = activeTab === 'ride' ? VehicleType.PASSENGER : VehicleType.FREIGHT;
    return getPriceBreakdown(routeDistance, selectedCategory, vehicleType);
  }, [routeDistance, selectedCategory, activeTab]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.longitude, pos.coords.latitude]);
          setPickupCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          mapboxService.reverseGeocode(pos.coords.latitude, pos.coords.longitude)
            .then(setPickup)
            .catch((err) => {
              console.error('Failed to get location address:', err);
              toast.warning('Unable to get your current address');
            });
        },
        (err) => {
          console.error('Geolocation error:', err);
          toast.info('Location access denied. Please enter your pickup location manually.');
        }
      );
    }
  }, [toast]);

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

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      mapboxService.getRoute(pickupCoords, dropoffCoords)
        .then(route => {
          if (route) {
            setRouteGeometry(route.geometry);
            const distanceKm = parseFloat(route.distance);
            setRouteDistance(distanceKm);
            // Route service may return duration as string or number depending on API version
            setRouteDuration(typeof route.duration === 'string' ? parseFloat(route.duration) : route.duration);
            
            // Calculate price based on distance and selected category
            const vehicleType = activeTab === 'ride' ? VehicleType.PASSENGER : VehicleType.FREIGHT;
            const price = calculateTripPrice(distanceKm, selectedCategory, vehicleType);
            setProposedFare(price);
            
            setViewState('review');
          }
        })
        .catch((err) => {
          console.error('Failed to get route:', err);
          toast.error('Unable to calculate route. Please try different locations.');
        });
    }
  }, [pickupCoords, dropoffCoords, toast, activeTab, selectedCategory]);

  const handleAddressSearch = async (query: string, field: 'pickup' | 'dropoff') => {
    if (field === 'pickup') setPickup(query); else setDropoff(query);
    setActiveField(field);
    if (query.length > 2) {
      try {
        const results = await mapboxService.searchAddress(query);
        setSuggestions(results);
      } catch (err) {
        console.error('Address search failed:', err);
        // Silently fail for search suggestions
      }
    }
  };

  const handleSelectSuggestion = (res: GeoResult) => {
    if (activeField === 'pickup') { setPickup(res.address); setPickupCoords({ lat: res.lat, lng: res.lng }); }
    else { setDropoff(res.address); setDropoffCoords({ lat: res.lat, lng: res.lng }); }
    setSuggestions([]); setActiveField(null);
  };

  const handleMagicAssist = async () => {
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
        toast.success('Trip details parsed successfully!');
      } else {
        toast.warning('Unable to parse your request. Please try again.');
      }
    } catch (err) {
      console.error('AI parsing failed:', err);
      toast.error('AI assistance unavailable. Please enter trip details manually.');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleRequestTrip = async () => {
    if (!pickupCoords || !dropoffCoords) {
      toast.warning('Please select both pickup and dropoff locations');
      return;
    }
    
    // Item 18: Validate freight-specific fields
    if (activeTab === 'freight' && !itemDescription.trim()) {
      toast.warning('Please describe the items you want to transport');
      return;
    }
    
    try {
      const trip = await xanoService.requestTrip({
        riderId: user.id, 
        type: activeTab === 'ride' ? VehicleType.PASSENGER : VehicleType.FREIGHT, 
        category: selectedCategory,
        pickup: { address: pickup, lat: pickupCoords.lat, lng: pickupCoords.lng },
        dropoff: { address: dropoff, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
        proposed_price: proposedFare, 
        distance_km: routeDistance, 
        duration: routeDuration,
        // Item 18: Include freight-specific fields
        itemDescription: activeTab === 'freight' ? itemDescription : undefined,
        requiresAssistance: activeTab === 'freight' ? requiresAssistance : undefined,
        cargoPhotos: activeTab === 'freight' && cargoPhotos.length > 0 ? cargoPhotos : undefined,
      });
      setActiveTrip(trip); 
      setViewState('bidding');
      toast.success('Trip request sent! Waiting for drivers...');
    } catch (err) {
      console.error('Failed to request trip:', err);
      const message = err instanceof Error ? err.message : 'Failed to request trip';
      toast.error(message);
    }
  };

  if (viewState === 'active' && activeTrip) return <ActiveTripView trip={activeTrip} role="rider" onClose={() => setViewState('idle')} />;

  return (
    <div className="h-screen flex flex-col bg-white relative overflow-hidden font-sans">
      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={user} 
        onLogout={onLogout} 
        activeView="map" 
        onNavigate={(v) => {
          if (v === 'scout') {
            setShowScout(true);
          } else if (v === 'history') {
            setShowHistory(true);
          } else if (v === 'profile') {
            setShowProfile(true);
          } else if (v === 'favourites') {
            setShowFavourites(true);
          } else if (v === 'map') {
            // Already on map - do nothing
          } else {
            toast.info(`${v.charAt(0).toUpperCase() + v.slice(1)} is coming soon!`);
          }
        }} 
        onUserUpdate={onUserUpdate} 
      />
      {showScout && <ScoutView onClose={() => setShowScout(false)} />}
      {showHistory && <TripHistoryView user={user} onClose={() => setShowHistory(false)} />}
      {showProfile && <ProfileView user={user} onClose={() => setShowProfile(false)} onUserUpdate={onUserUpdate} />}
      {showFavourites && <FavouritesView user={user} onClose={() => setShowFavourites(false)} />}

      <div className="absolute top-0 inset-x-0 z-30 p-8 pt-16 safe-top bg-gradient-to-b from-white/90 to-transparent pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={() => setIsDrawerOpen(true)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black border border-zinc-100 shadow-sm haptic-press"><i className="fa-solid fa-bars text-xl"></i></button>
          <div className="flex bg-zinc-100 rounded-full p-1 border border-zinc-200">
            <button onClick={() => setActiveTab('ride')} className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'ride' ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Passenger</button>
            <button onClick={() => setActiveTab('freight')} className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'freight' ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Freight</button>
          </div>
          <div className="w-12"></div>
        </div>
      </div>

      <div className="flex-1 relative">
        <Suspense fallback={<div className="w-full h-full bg-zinc-50" />}>
          <MapView center={mapCenter} markers={pickupCoords ? [{id:'p', ...pickupCoords, type:'pickup'}] : []} routeGeometry={routeGeometry} zoom={14} />
        </Suspense>

        {viewState === 'idle' && (
          <div className="absolute bottom-12 inset-x-8 z-30">
            <Card className="!p-6 bg-white border border-zinc-100 shadow-xl rounded-3xl">
              <div className="relative mb-4">
                <Input variant="light" placeholder="Describe your trip..." icon="wand-magic-sparkles" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleMagicAssist()} />
                {aiPrompt && <button onClick={handleMagicAssist} disabled={isAiParsing} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-brand-orange text-white rounded-lg">{isAiParsing ? '...' : 'Go'}</button>}
              </div>
              <div className="space-y-3">
                <Input variant="light" placeholder="Pickup location" icon="location-dot" value={pickup} onChange={e => handleAddressSearch(e.target.value, 'pickup')} onFocus={() => setActiveField('pickup')} />
                <Input variant="light" placeholder="Where to?" icon="flag-checkered" value={dropoff} onChange={e => handleAddressSearch(e.target.value, 'dropoff')} onFocus={() => setActiveField('dropoff')} />
                {activeField && suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-2xl z-50">
                    {suggestions.map((s, i) => <button key={i} onClick={() => handleSelectSuggestion(s)} className="w-full px-6 py-4 text-left hover:bg-zinc-50 border-b border-zinc-100 last:border-0 text-sm font-bold truncate">{s.address}</button>)}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {viewState === 'review' && (
          <div className="absolute bottom-12 inset-x-8 z-30 animate-slide-up">
            <Card className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Estimated Fare</p>
                  <div className="text-4xl font-black text-black tracking-tighter">${proposedFare.toFixed(2)}</div>
                  {priceBreakdown && (
                    <div className="mt-3 space-y-1 text-xs text-zinc-500">
                      <div className="flex justify-between">
                        <span>Base price (up to 3 km):</span>
                        <span className="font-bold">${priceBreakdown.basePrice.toFixed(2)}</span>
                      </div>
                      {priceBreakdown.additionalDistance > 0 && (
                        <div className="flex justify-between">
                          <span>{priceBreakdown.additionalDistance.toFixed(2)} km @ ${priceBreakdown.pricePerKm}/km:</span>
                          <span className="font-bold">${priceBreakdown.additionalCharge.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-zinc-200 flex justify-between font-bold">
                        <span>Distance:</span>
                        <span>{routeDistance.toFixed(2)} km</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mb-8">
                {(activeTab === 'ride' ? PASSENGER_CATEGORIES : FREIGHT_CATEGORIES).map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.name)} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${selectedCategory === cat.name ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-zinc-100 text-zinc-300'}`}><i className={`fa-solid fa-${cat.icon} text-xl`}></i><span className="text-[8px] font-bold uppercase">{cat.name}</span></button>
                ))}
              </div>
              
              {/* Item 18: Freight-specific fields */}
              {activeTab === 'freight' && (
                <div className="mb-6 space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                  <div>
                    <label className="block text-xs font-bold text-orange-600 uppercase tracking-wide mb-2">
                      Item Description *
                    </label>
                    <textarea
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Describe what you're transporting (e.g., furniture, boxes, equipment)"
                      className="w-full px-4 py-3 rounded-xl border border-orange-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm resize-none"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiresAssistance}
                        onChange={(e) => setRequiresAssistance(e.target.checked)}
                        className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-bold text-orange-900">
                        <i className="fa-solid fa-hand-holding-hand mr-2"></i>
                        Requires loading/unloading assistance
                      </span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-orange-600 uppercase tracking-wide mb-2">
                      Cargo Photos (Optional)
                    </label>
                    <div className="flex gap-2 overflow-x-auto">
                      {cargoPhotos.map((photo, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img src={photo} alt={`Cargo ${idx + 1}`} className="w-20 h-20 rounded-lg object-cover border-2 border-orange-200" />
                          <button
                            onClick={() => setCargoPhotos(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {cargoPhotos.length < 4 && (
                        <label className="w-20 h-20 flex-shrink-0 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-400 transition">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const { compressImage } = await import('../services/utils');
                                  const compressed = await compressImage(file);
                                  setCargoPhotos(prev => [...prev, compressed]);
                                } catch (err) {
                                  toast.error('Failed to upload photo');
                                }
                              }
                            }}
                          />
                          <i className="fa-solid fa-camera text-orange-400 text-xl"></i>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <Button variant="dark" className="w-full py-5 rounded-2xl shadow-lg" onClick={handleRequestTrip}>Request Ride</Button>
            </Card>
          </div>
        )}

        {viewState === 'bidding' && activeTrip && (
          <div className="absolute bottom-12 inset-x-8 z-30 animate-slide-up">
            <Card className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-orange/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-spinner-third animate-spin text-3xl text-brand-orange"></i>
                </div>
                <h3 className="text-xl font-black text-black mb-2">Finding Drivers...</h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Sending your request</p>
              </div>
              
              <div className="space-y-3 mb-6 p-4 bg-zinc-50 rounded-2xl">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                  <i className="fa-solid fa-location-dot text-brand-blue"></i>
                  <span className="truncate">{activeTrip.pickup.address}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                  <i className="fa-solid fa-flag-checkered text-brand-orange"></i>
                  <span className="truncate">{activeTrip.dropoff.address}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                  <i className="fa-solid fa-car text-zinc-400"></i>
                  <span>{activeTrip.category}</span>
                  <span className="ml-auto text-lg font-black text-black">${activeTrip.proposed_price.toFixed(2)}</span>
                </div>
              </div>

              {activeTrip.bids && activeTrip.bids.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Available Drivers</p>
                  {activeTrip.bids.map(bid => (
                    <div key={bid.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-md border border-zinc-100 hover:shadow-lg transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-zinc-200 overflow-hidden shrink-0">
                        <img src={`https://ui-avatars.com/api/?name=${bid.driverName}&background=random`} alt={bid.driverName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm text-black truncate">{bid.driverName}</div>
                        <div className="text-[10px] text-zinc-400 font-bold">⭐ {bid.driverRating.toFixed(1)} • {bid.eta}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg text-black">${bid.amount.toFixed(2)}</div>
                        <Button variant="primary" className="mt-1 px-4 py-1 text-[9px]" onClick={async () => {
                          await xanoService.acceptBid(activeTrip.id, bid.id);
                          setViewState('active');
                        }}>Accept</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" className="w-full py-4 rounded-2xl" onClick={async () => {
                await xanoService.cancelTrip(activeTrip.id);
                setActiveTrip(null);
                setViewState('idle');
              }}>Cancel Request</Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};