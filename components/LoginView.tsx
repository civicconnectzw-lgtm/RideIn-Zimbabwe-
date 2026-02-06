
import React, { useState, useEffect } from 'react';
import { User, VehicleType } from '../types';
import { PASSENGER_CATEGORIES, FREIGHT_CATEGORIES, ZIM_CITIES } from '../constants';
import { Button, Input } from './Shared';
import { xanoService } from '../services/xano';
import { compressImage } from '../services/utils';

export const LoginView: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [city, setCity] = useState('Harare');
  
  // Driver Details
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [religion, setReligion] = useState('');
  const [personality, setPersonality] = useState<'Talkative' | 'Quiet'>('Talkative');
  
  // Vehicle Details
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.PASSENGER);
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return regex.test(pass);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgot) {
      if (forgotStep === 1) handleRequestReset();
      else handleCompleteReset();
      return;
    }
    if (isSignup && role === 'driver' && step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('0')) val = val.substring(1);
    setPhone(val);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setLoading(true);
        const compressedDataUrl = await compressImage(file);
        setPhotos(prev => {
          const newPhotos = [...prev];
          newPhotos[index] = compressedDataUrl;
          return newPhotos;
        });
      } catch (err) {
        console.error("Compression failed:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRequestReset = async () => {
    if (!phone) {
      setError('Mobile signal required for protocol reset');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formattedPhone = `+263${phone}`;
      await xanoService.requestPasswordReset(formattedPhone);
      setForgotStep(2);
      setSuccess('Tactical reset code dispatched via SMS');
    } catch (err: any) {
      setError(err.message || 'Node communication failure during reset request');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    if (!resetCode || !password) {
      setError('Both code and new access key required');
      return;
    }
    if (!validatePassword(password)) {
      setError('Security policy mismatch: Use 8+ characters with mixed cases and symbols');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formattedPhone = `+263${phone}`;
      const user = await xanoService.completePasswordReset(formattedPhone, resetCode, password);
      if (user) onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Invalid authorization code or node timeout');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setIsScanning(true);
    
    if (!phone || !password) {
        setError('Authorization credentials required');
        setLoading(false);
        setIsScanning(false);
        return;
    }

    if (isSignup) {
      if (!fullName) {
        setError('Identity string required for new node registration');
        setLoading(false);
        setIsScanning(false);
        return;
      }
      if (!validatePassword(password)) {
        setError('Security policy mismatch: Use 8+ characters with mixed cases and symbols');
        setLoading(false);
        setIsScanning(false);
        return;
      }
    }

    try {
      const formattedPhone = `+263${phone}`;
      let user;
      if (isSignup) {
        user = await xanoService.signup({
          name: fullName,
          phone: formattedPhone,
          role: role,
          city: city,
          age: parseInt(age) || 0,
          gender,
          maritalStatus,
          religion,
          personality,
          vehicle: role === 'driver' ? {
            type: vehicleType,
            category: vehicleCategory,
            photos: photos.filter(p => p !== null) as string[]
          } : undefined
        }, password);
      } else {
        user = await xanoService.login(formattedPhone, password);
      }
      if (user) onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Authentication sequence failed');
    } finally {
      setLoading(false);
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000814] flex flex-col p-8 safe-top font-mono overflow-y-auto no-scrollbar relative text-white">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-orange/10 animate-scan"></div>
      
      <div className="mb-14 animate-fade-in relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-1.5 bg-brand-orange rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">System_Access_v2.5</span>
        </div>
        <h1 className="text-6xl font-black text-white italic tracking-tighter">Ride<span className="text-brand-orange">In</span></h1>
      </div>

      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full relative z-10 pb-10">
        <form onSubmit={handleNext} className="space-y-8">
          {!isForgot && !isSignup && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-black text-white tracking-tighter mb-1 uppercase">Protocol: Auth</h2>
              <div className="h-1 w-12 bg-brand-orange/40 mb-8 rounded-full"></div>
            </div>
          )}

          {!isForgot && isSignup && step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-black text-white tracking-tighter mb-1 uppercase">Protocol: Deploy</h2>
              <div className="h-1 w-12 bg-brand-orange/40 mb-8 rounded-full"></div>
              
              <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
                <button type="button" onClick={() => setRole('rider')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${role === 'rider' ? 'bg-brand-orange text-white shadow-[0_0_15px_rgba(255,95,0,0.3)]' : 'text-white/20'}`}>Rider_Node</button>
                <button type="button" onClick={() => setRole('driver')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${role === 'driver' ? 'bg-brand-orange text-white shadow-[0_0_15px_rgba(255,95,0,0.3)]' : 'text-white/20'}`}>Driver_Node</button>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {(!isForgot && isSignup && step === 1) && (
              <Input 
                variant="dark" 
                label="Identifier" 
                icon="user" 
                placeholder="Full Name" 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                required 
                autoComplete="name"
                className="animate-step-in"
              />
            )}

            {(forgotStep === 1 || (!isForgot && step === 1)) && (
              <Input 
                variant="dark" 
                label="Mobile_Terminal" 
                icon="phone" 
                prefixText="+263" 
                placeholder="77 000 0000" 
                value={phone} 
                onChange={handlePhoneChange} 
                maxLength={9} 
                inputMode="tel" 
                required 
                autoComplete="tel-national"
                className="animate-step-in"
              />
            )}

            {isForgot && forgotStep === 2 && (
              <Input 
                variant="dark" 
                label="Reset_Code" 
                icon="key" 
                placeholder="000000" 
                value={resetCode} 
                onChange={e => setResetCode(e.target.value)} 
                maxLength={6} 
                inputMode="numeric" 
                required 
                className="animate-scale-in"
              />
            )}

            {(!isForgot || forgotStep === 2) && step === 1 && (
              <Input 
                variant="dark" 
                label={isForgot ? "New_Access_Key" : "Access_Key"} 
                icon="lock" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="animate-step-in"
              />
            )}

            {isSignup && step === 1 && (
              <div className="space-y-1 animate-step-in">
                <label className="text-[10px] uppercase tracking-[0.2em] ml-1 block text-white/30 font-black">Operational_Sector</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"><i className="fa-solid fa-map-location-dot"></i></div>
                  <select 
                    value={city} 
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-white/[0.03] border-b-2 border-white/10 text-white focus:border-brand-orange/50 focus:bg-white/[0.05] rounded-t-2xl py-5 pl-12 pr-6 font-bold text-base outline-none appearance-none transition-all"
                  >
                    {ZIM_CITIES.map(c => <option key={c} value={c} className="bg-[#001D3D]">{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {isSignup && role === 'driver' && step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <Input variant="dark" label="Biological_Age" icon="calendar" type="number" value={age} onChange={e => setAge(e.target.value)} required inputMode="numeric" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Gender</label>
                    <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-white/[0.03] border-b-2 border-white/10 text-white py-5 px-4 rounded-t-2xl outline-none font-bold">
                      <option className="bg-[#001D3D]">Male</option>
                      <option className="bg-[#001D3D]">Female</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Status</label>
                    <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="w-full bg-white/[0.03] border-b-2 border-white/10 text-white py-5 px-4 rounded-t-2xl outline-none font-bold">
                      <option className="bg-[#001D3D]">Single</option>
                      <option className="bg-[#001D3D]">Married</option>
                      <option className="bg-[#001D3D]">Divorced</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            {isSignup && role === 'driver' && step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Asset_Type</label>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setVehicleType(VehicleType.PASSENGER)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${vehicleType === VehicleType.PASSENGER ? 'bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(255,95,0,0.2)]' : 'bg-white/5 text-white/20 border-white/5'}`}>Passenger</button>
                    <button type="button" onClick={() => setVehicleType(VehicleType.FREIGHT)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${vehicleType === VehicleType.FREIGHT ? 'bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(255,95,0,0.2)]' : 'bg-white/5 text-white/20 border-white/5'}`}>Freight</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {photos.map((photo, i) => (
                    <div key={i} className="aspect-square bg-white/[0.02] rounded-[2rem] border-2 border-dashed border-white/10 relative overflow-hidden group hover:border-brand-orange/40 transition-all">
                      {photo ? (
                        <>
                          <img src={photo} className="w-full h-full object-cover" alt={`Asset ${i}`} />
                          <button type="button" onClick={() => setPhotos(prev => { const n = [...prev]; n[i] = null; return n; })} className="absolute top-3 right-3 w-8 h-8 bg-red-600/80 backdrop-blur-md rounded-full text-white text-[12px] flex items-center justify-center shadow-lg"><i className="fa-solid fa-xmark"></i></button>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group-hover:bg-white/[0.04] transition-colors">
                          <i className="fa-solid fa-camera text-white/10 text-2xl mb-2"></i>
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">IMG_{i+1}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, i)} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-[1.5rem] text-[10px] font-black text-red-500 uppercase tracking-[0.3em] text-center animate-shake flex items-center justify-center gap-3">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {error}
            </div>
          )}

          <div className="pt-6 space-y-6">
            <Button 
              type="submit" 
              variant="secondary" 
              className={`w-full py-7 text-[12px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_25px_50px_rgba(255,95,0,0.2)] relative overflow-hidden ${isScanning ? 'opacity-80' : ''}`}
              loading={loading}
              disabled={loading}
            >
              {isForgot ? 'COMPLETE_RECOVERY' : (isSignup ? (step < 3 && role === 'driver' ? 'SYNC_PROTOCOL' : 'ESTABLISH_NODE') : 'INITIATE_UPLINK')}
              {isScanning && <div className="absolute inset-x-0 h-1 bg-white/20 animate-scan pointer-events-none"></div>}
            </Button>
            
            <div className="flex justify-between px-3">
              <button type="button" onClick={() => { setIsSignup(!isSignup); setIsForgot(false); setStep(1); setError(''); }} className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] hover:text-white transition-colors">
                {isSignup ? 'NODE_LOG_IN' : 'NEW_NODE_JOIN'}
              </button>
              <button type="button" onClick={() => { setIsForgot(!isForgot); setIsSignup(false); setForgotStep(1); setError(''); }} className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] hover:text-white transition-colors">
                {isForgot ? 'CANCEL_OPS' : 'LOST_ACCESS?'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
