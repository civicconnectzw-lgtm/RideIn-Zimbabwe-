import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { xanoService } from '../services/xano';
import { Button, Card } from './Shared';
import { useToastContext } from '../hooks/useToastContext';

interface FavouritesViewProps {
  user: User;
  onClose: () => void;
}

export const FavouritesView: React.FC<FavouritesViewProps> = ({ user, onClose }) => {
  const [favourites, setFavourites] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToastContext();

  useEffect(() => {
    loadFavourites();
  }, []);

  const loadFavourites = async () => {
    setLoading(true);
    try {
      const drivers = await xanoService.getFavourites();
      setFavourites(drivers);
    } catch (err) {
      console.error('Failed to load favourites:', err);
      toast.error('Failed to load favourite drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavourite = async (driverId: string) => {
    try {
      await xanoService.removeFavourite(driverId);
      setFavourites((prev) => prev.filter((d) => d.id !== driverId));
      toast.success('Driver removed from favourites');
    } catch (err) {
      console.error('Failed to remove favourite:', err);
      toast.error('Failed to remove favourite');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-blue to-brand-blue-light p-6 pt-12 safe-top shadow-lg">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-black text-white uppercase tracking-tight">Saved Drivers</h1>
            <p className="text-xs text-white/60 uppercase tracking-widest">
              {favourites.length} Favourite{favourites.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Favourites List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-zinc-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Loading drivers...</p>
            </div>
          </div>
        ) : favourites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <i className="fa-solid fa-heart text-3xl text-red-300"></i>
            </div>
            <h3 className="text-lg font-black text-zinc-800 mb-2 uppercase">No Favourites Yet</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              After completing a trip, you can save your favourite drivers for quick booking next time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {favourites.map((driver) => (
              <Card key={driver.id} className="bg-white border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  {/* Driver Avatar */}
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-zinc-100 flex-shrink-0">
                    <img
                      src={driver.avatar || `https://ui-avatars.com/api/?name=${driver.name}&background=random`}
                      alt={driver.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Driver Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-black text-base truncate">{driver.name}</h3>
                      {driver.driver_verified && (
                        <i className="fa-solid fa-badge-check text-brand-blue text-sm" title="Verified Driver"></i>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                      <div className="flex items-center gap-1">
                        <i className="fa-solid fa-star text-yellow-400"></i>
                        <span className="font-bold">{driver.rating?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <i className="fa-solid fa-car text-zinc-400"></i>
                        <span>{driver.vehicle?.category || 'Standard'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <i className="fa-solid fa-map-pin text-zinc-400"></i>
                        <span>{driver.city}</span>
                      </div>
                    </div>

                    {driver.personality && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 rounded-full">
                        <i className={`fa-solid fa-${driver.personality === 'Talkative' ? 'comments' : 'volume-xmark'} text-zinc-400 text-[10px]`}></i>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wide">
                          {driver.personality}
                        </span>
                      </div>
                    )}

                    {driver.tripsCount !== undefined && driver.tripsCount > 0 && (
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wide">
                        {driver.tripsCount} Trip{driver.tripsCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleRemoveFavourite(driver.id)}
                      className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
                      title="Remove from favourites"
                    >
                      <i className="fa-solid fa-heart-crack"></i>
                    </button>
                  </div>
                </div>

                {/* Driver Stats */}
                {driver.yearsExperience && (
                  <div className="mt-4 pt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <i className="fa-solid fa-award text-brand-orange"></i>
                      <span className="font-bold">{driver.yearsExperience} years of experience</span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info Footer */}
      {!loading && favourites.length > 0 && (
        <div className="bg-blue-50 border-t border-blue-100 p-4 safe-bottom">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-circle-info text-brand-blue text-lg mt-0.5"></i>
            <div>
              <p className="text-xs font-bold text-brand-blue mb-1 uppercase tracking-wide">Quick Tip</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                You can request trips from your favourite drivers directly when they're online in your area.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
