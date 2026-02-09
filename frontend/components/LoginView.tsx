import React, { useState } from 'react';
import { User, VehicleType } from '../types';
import { ZIM_CITIES } from '../constants';
import { Button, Input } from './Shared';
import { useAuthContext } from '../contexts/AuthContext';
import { compressImage } from '../services/utils';

export const LoginView: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const authContext = useAuthContext();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('Harare');
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.PASSENGER);
  const [vehicleCategory, setVehicleCategory] = useState<string>('Standard');

  // Item 24: Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1); // 1 = enter phone, 2 = enter code + new password
  const [resetPhone, setResetPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup && role === 'driver' && step < 2) setStep(step + 1);
    else handleSubmit();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPhotos(prev => {
          const newP = [...prev];
          newP[index] = compressed;
          return newP;
        });
      } catch (err) {}
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    // Client-side validation
    const cleanPhone = phone.replace(/^0+/, ''); // Remove leading zeros
    
    if (cleanPhone.length !== 9) {
      setError('Phone number must be 9 digits (without leading 0)');
      setLoading(false);
      return;
    }
    
    if (isSignup) {
      if (!fullName.trim()) {
        setError('Name is required');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        setLoading(false);
        return;
      }
    } else {
      if (password.length < 4) {
        setError('Password must be at least 4 characters');
        setLoading(false);
        return;
      }
    }
    
    try {
      const formattedPhone = `+263${cleanPhone}`;
      let user;
      if (isSignup) {
        user = await authContext.signup({
          name: fullName, phone: formattedPhone, role, city,
          vehicle: role === 'driver' ? { type: vehicleType, category: vehicleCategory, photos: photos.filter(p => p !== null) as string[] } : undefined
        }, password);
      } else {
        user = await authContext.login(formattedPhone, password);
      }
      // No need to call onLogin - authContext automatically updates
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Item 24: Password reset handlers
  const handleRequestPasswordReset = async () => {
    setLoading(true);
    setError('');
    
    const cleanPhone = resetPhone.replace(/^0+/, '');
    if (cleanPhone.length !== 9) {
      setError('Phone number must be 9 digits (without leading 0)');
      setLoading(false);
      return;
    }
    
    try {
      const formattedPhone = `+263${cleanPhone}`;
      await authContext.requestPasswordReset(formattedPhone);
      setResetStep(2);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePasswordReset = async () => {
    setLoading(true);
    setError('');
    
    const cleanPhone = resetPhone.replace(/^0+/, '');
    if (!resetCode.trim()) {
      setError('Please enter the verification code');
      setLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }
    
    try {
      const formattedPhone = `+263${cleanPhone}`;
      await authContext.completePasswordReset(formattedPhone, resetCode, newPassword);
      // Reset successful, return to login
      setShowPasswordReset(false);
      setResetStep(1);
      setResetPhone('');
      setResetCode('');
      setNewPassword('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg-soft flex flex-col p-8 safe-top font-sans">
      <div className="mt-12 mb-12 p-8 rounded-3xl bg-gradient-to-br from-brand-blue to-brand-blue-light shadow-lg">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
          {isSignup ? 'Create Account' : 'Welcome back'}
        </h1>
        <p className="text-white/80 font-bold text-xs uppercase tracking-widest mt-2">RideIn Zimbabwe</p>
      </div>

      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full pb-12">
        <form onSubmit={handleNext} className="space-y-6">
          {isSignup && step === 1 && (
            <div className="flex bg-zinc-50 p-1 rounded-xl border border-zinc-100">
              <button type="button" onClick={() => setRole('rider')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${role === 'rider' ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Passenger</button>
              <button type="button" onClick={() => setRole('driver')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${role === 'driver' ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Driver</button>
            </div>
          )}

          <div className="space-y-4">
            {isSignup && step === 1 && <Input label="Full Name" icon="user" placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} required />}
            {step === 1 && <Input label="Phone Number" icon="phone" prefixText="+263" placeholder="77 000 0000" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={9} required />}
            {step === 1 && <Input label="Password" icon="lock" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />}
            
            {isSignup && step === 1 && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold">City</label>
                <select value={city} onChange={e => setCity(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 text-black rounded-xl py-4 px-6 font-bold text-sm outline-none appearance-none">
                  {ZIM_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {isSignup && role === 'driver' && step === 2 && (
              <>
                <div className="space-y-2 mb-4">
                  <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold">Vehicle Type</label>
                  <div className="flex bg-zinc-50 p-1 rounded-xl border border-zinc-100">
                    <button type="button" onClick={() => { setVehicleType(VehicleType.PASSENGER); setVehicleCategory('Standard'); }} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${vehicleType === VehicleType.PASSENGER ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Passenger</button>
                    <button type="button" onClick={() => { setVehicleType(VehicleType.FREIGHT); setVehicleCategory('Bike Delivery (Up to 20kg)'); }} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${vehicleType === VehicleType.FREIGHT ? 'bg-white text-black shadow-sm' : 'text-zinc-400'}`}>Freight</button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold">Vehicle Category</label>
                  <select value={vehicleCategory} onChange={e => setVehicleCategory(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 text-black rounded-xl py-4 px-6 font-bold text-sm outline-none appearance-none">
                    {vehicleType === VehicleType.PASSENGER ? (
                      <>
                        <option value="Standard">Standard</option>
                        <option value="Premium">Premium</option>
                        <option value="Luxury">Luxury</option>
                      </>
                    ) : (
                      <>
                        <option value="Bike Delivery (Up to 20kg)">Bike Delivery (Up to 20kg)</option>
                        <option value="1–2 Tonne Truck">1–2 Tonne Truck</option>
                        <option value="3–5 Tonne Truck">3–5 Tonne Truck</option>
                        <option value="7–10 Tonne Truck">7–10 Tonne Truck</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold">Vehicle Photos</label>
                  <div className="grid grid-cols-2 gap-4">
                    {photos.map((photo, i) => (
                      <div key={i} className="aspect-square bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 relative overflow-hidden flex items-center justify-center">
                        {photo ? <img src={photo} className="w-full h-full object-cover" /> : <label className="cursor-pointer text-zinc-300 flex flex-col items-center"><i className="fa-solid fa-camera text-xl mb-1"></i><input type="file" className="hidden" onChange={(e) => handlePhotoUpload(e, i)} /></label>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">{error}</div>}

          <div className="pt-4 space-y-4">
            <Button type="submit" variant="dark" className="w-full py-5 rounded-2xl" loading={loading} disabled={loading}>
              {isSignup ? (step === 1 && role === 'driver' ? 'Next' : 'Create Account') : 'Log In'}
            </Button>
            
            {/* Item 24: Forgot Password link */}
            {!isSignup && (
              <button 
                type="button" 
                onClick={() => setShowPasswordReset(true)} 
                className="w-full text-[10px] font-bold text-brand-blue uppercase tracking-widest text-center hover:underline"
              >
                Forgot Password?
              </button>
            )}
            
            <button type="button" onClick={() => { setIsSignup(!isSignup); setStep(1); }} className="w-full text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">
              {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>

      {/* Item 24: Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-black mb-2">
                {resetStep === 1 ? 'Reset Password' : 'Enter Code'}
              </h2>
              <p className="text-xs text-zinc-500 uppercase tracking-widest">
                {resetStep === 1 ? 'Enter your phone number' : 'Check your SMS for the code'}
              </p>
            </div>

            <div className="space-y-4">
              {resetStep === 1 ? (
                <>
                  <Input 
                    label="Phone Number" 
                    icon="phone" 
                    prefixText="+263" 
                    placeholder="77 000 0000" 
                    value={resetPhone} 
                    onChange={e => setResetPhone(e.target.value.replace(/\D/g, ''))} 
                    maxLength={9} 
                  />
                  {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{error}</div>}
                  <Button 
                    variant="dark" 
                    className="w-full py-4 rounded-xl" 
                    onClick={handleRequestPasswordReset}
                    loading={loading}
                    disabled={loading}
                  >
                    Send Code
                  </Button>
                </>
              ) : (
                <>
                  <Input 
                    label="Verification Code" 
                    icon="key" 
                    placeholder="Enter 6-digit code" 
                    value={resetCode} 
                    onChange={e => setResetCode(e.target.value)} 
                    maxLength={6}
                  />
                  <Input 
                    label="New Password" 
                    icon="lock" 
                    type="password" 
                    placeholder="••••••••" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                  {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{error}</div>}
                  <Button 
                    variant="dark" 
                    className="w-full py-4 rounded-xl" 
                    onClick={handleCompletePasswordReset}
                    loading={loading}
                    disabled={loading}
                  >
                    Reset Password
                  </Button>
                </>
              )}
              
              <button 
                type="button"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetStep(1);
                  setResetPhone('');
                  setResetCode('');
                  setNewPassword('');
                  setError('');
                }}
                className="w-full text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};