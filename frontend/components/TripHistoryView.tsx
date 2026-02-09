import React, { useState, useEffect } from 'react';
import { Trip, User, TripStatus } from '../types';
import { xanoService } from '../services/xano';
import { Button, Card, Badge } from './Shared';
import { useToastContext } from '../hooks/useToastContext';

interface TripHistoryViewProps {
  user: User;
  onClose: () => void;
}

export const TripHistoryView: React.FC<TripHistoryViewProps> = ({ user, onClose }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalTrips, setTotalTrips] = useState(0);
  const toast = useToastContext();

  useEffect(() => {
    loadTrips();
  }, [page]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const { trips: fetchedTrips, total } = await xanoService.getTripHistory(page, 20);
      setTrips(fetchedTrips);
      setTotalTrips(total);
    } catch (err) {
      console.error('Failed to load trip history:', err);
      toast.error('Failed to load trip history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TripStatus): string => {
    switch (status) {
      case TripStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TripStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      case TripStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <h1 className="text-xl font-black text-white uppercase tracking-tight">My Trips</h1>
            <p className="text-xs text-white/60 uppercase tracking-widest">{totalTrips} Total Trips</p>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Trip List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 bg-zinc-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Loading trips...</p>
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <i className="fa-solid fa-clock-rotate-left text-5xl text-zinc-300 mb-4"></i>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No trips yet</p>
            <p className="text-xs text-zinc-300 mt-2">Your trip history will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <Card key={trip.id} className="bg-white border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <Badge color={trip.type === 'PASSENGER' ? 'blue' : 'orange'}>
                      {trip.type}
                    </Badge>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(trip.status)}`}>
                      {trip.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 uppercase tracking-wide">
                      {formatDate(trip.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-blue mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-zinc-800 truncate">{trip.pickup.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-orange mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-zinc-800 truncate">{trip.dropoff.address}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-4 text-[10px] text-zinc-400 uppercase tracking-wide">
                    <span>{trip.distance_km?.toFixed(1)} km</span>
                    <span>{trip.category}</span>
                  </div>
                  <div className="text-lg font-black text-black">
                    ${(trip.final_price || trip.proposed_price)?.toFixed(2)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && trips.length > 0 && (
        <div className="bg-white border-t border-zinc-200 p-4 safe-bottom">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2 text-xs disabled:opacity-50"
            >
              <i className="fa-solid fa-chevron-left mr-2"></i>
              Previous
            </Button>
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
              Page {page}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={trips.length < 20}
              className="px-6 py-2 text-xs disabled:opacity-50"
            >
              Next
              <i className="fa-solid fa-chevron-right ml-2"></i>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
