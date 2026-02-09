import React, { useState } from 'react';
import { User } from '../types';
import { xanoService } from '../services/xano';
import { Button, Input } from './Shared';
import { useToastContext } from '../hooks/useToastContext';
import { ZIM_CITIES } from '../constants';
import { compressImage } from '../services/utils';

interface ProfileViewProps {
  user: User;
  onClose: () => void;
  onUserUpdate: (user: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onClose, onUserUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.name);
  const [city, setCity] = useState(user.city);
  const [avatar, setAvatar] = useState(user.avatar);
  const toast = useToastContext();

  // Driver-specific fields
  const [age, setAge] = useState(user.age?.toString() || '');
  const [gender, setGender] = useState(user.gender || '');
  const [maritalStatus, setMaritalStatus] = useState(user.maritalStatus || '');
  const [religion, setReligion] = useState(user.religion || '');
  const [personality, setPersonality] = useState<'Talkative' | 'Quiet' | ''>(user.personality || '');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setAvatar(compressed);
      } catch (err) {
        toast.error('Failed to upload photo');
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates: Partial<User> = {
        name,
        city,
        avatar,
      };

      // Add driver-specific fields if user is a driver
      if (user.role === 'driver') {
        if (age) updates.age = parseInt(age, 10);
        if (gender) updates.gender = gender;
        if (maritalStatus) updates.maritalStatus = maritalStatus;
        if (religion) updates.religion = religion;
        if (personality) updates.personality = personality as 'Talkative' | 'Quiet';
      }

      const updatedUser = await xanoService.updateProfile(updates);
      onUserUpdate(updatedUser);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`p-6 pt-12 safe-top shadow-lg ${
        user.role === 'driver' 
          ? 'bg-gradient-to-br from-brand-orange to-brand-orange-light' 
          : 'bg-gradient-to-r from-brand-blue to-brand-blue-light'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">My Profile</h1>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={loading}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <i className={`fa-solid fa-${editing ? 'check' : 'pen'}`}></i>
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/30">
              <img
                src={avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
            {editing && (
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-lg">
                <i className="fa-solid fa-camera text-brand-blue text-sm"></i>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            )}
          </div>
          {!editing && (
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-1">{name}</h2>
              <p className="text-sm text-white/60 uppercase tracking-widest">{user.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 bg-zinc-50 space-y-6">
        {/* Stats */}
        {!editing && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <div className="text-2xl font-black text-black mb-1">{user.rating?.toFixed(1) || '0.0'}</div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Rating</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <div className="text-2xl font-black text-black mb-1">{user.tripsCount || 0}</div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Trips</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <div className="text-2xl font-black text-black mb-1">
                <i className="fa-solid fa-check text-green-500"></i>
              </div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Verified</div>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Basic Information</h3>
          <div className="space-y-4">
            {editing ? (
              <>
                <Input
                  label="Full Name"
                  icon="user"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div>
                  <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold mb-2">
                    City
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-100 text-black rounded-xl py-4 px-6 font-bold text-sm outline-none appearance-none"
                  >
                    {ZIM_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-user text-zinc-300 w-5"></i>
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">Name</p>
                    <p className="font-bold text-black">{name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-phone text-zinc-300 w-5"></i>
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">Phone</p>
                    <p className="font-bold text-black">{user.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-location-dot text-zinc-300 w-5"></i>
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">City</p>
                    <p className="font-bold text-black">{city}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Driver-specific fields */}
        {user.role === 'driver' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Driver Details</h3>
            <div className="space-y-4">
              {editing ? (
                <>
                  <Input
                    label="Age"
                    icon="calendar"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                  <div>
                    <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold mb-2">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-100 text-black rounded-xl py-4 px-6 font-bold text-sm outline-none appearance-none"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <Input
                    label="Marital Status"
                    icon="ring"
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    placeholder="e.g., Single, Married"
                  />
                  <Input
                    label="Religion"
                    icon="church"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    placeholder="Optional"
                  />
                  <div>
                    <label className="text-[10px] uppercase tracking-widest ml-1 block text-zinc-500 font-bold mb-2">
                      Personality
                    </label>
                    <select
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value as 'Talkative' | 'Quiet' | '')}
                      className="w-full bg-zinc-50 border border-zinc-100 text-black rounded-xl py-4 px-6 font-bold text-sm outline-none appearance-none"
                    >
                      <option value="">Select Personality</option>
                      <option value="Talkative">Talkative</option>
                      <option value="Quiet">Quiet</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {user.age && (
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-calendar text-zinc-300 w-5"></i>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">Age</p>
                        <p className="font-bold text-black">{user.age} years</p>
                      </div>
                    </div>
                  )}
                  {user.gender && (
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-venus-mars text-zinc-300 w-5"></i>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">Gender</p>
                        <p className="font-bold text-black">{user.gender}</p>
                      </div>
                    </div>
                  )}
                  {user.personality && (
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-comment text-zinc-300 w-5"></i>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">Personality</p>
                        <p className="font-bold text-black">{user.personality}</p>
                      </div>
                    </div>
                  )}
                  {user.vehicle && (
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-car text-zinc-300 w-5"></i>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">Vehicle</p>
                        <p className="font-bold text-black">
                          {user.vehicle.type} - {user.vehicle.category}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Save/Cancel buttons for editing */}
        {editing && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setName(user.name);
                setCity(user.city);
                setAvatar(user.avatar);
                setAge(user.age?.toString() || '');
                setGender(user.gender || '');
                setMaritalStatus(user.maritalStatus || '');
                setReligion(user.religion || '');
                setPersonality(user.personality || '');
              }}
              className="flex-1 py-4"
            >
              Cancel
            </Button>
            <Button
              variant="dark"
              onClick={handleSave}
              loading={loading}
              disabled={loading}
              className="flex-1 py-4"
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
