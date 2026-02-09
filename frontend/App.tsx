import React, { useState, useEffect, Suspense, useRef } from 'react';
import { User, HomeViewProps, LoginViewProps } from './types';
import { xanoService } from './services/xano';
import { ablyService } from './services/ably';
import { PublicOnboardingView } from './components/PublicOnboardingView';
import ToastContainer from './components/ToastContainer';
import OfflineBanner from './components/OfflineBanner';
import { SessionStatusIndicator } from './components/SessionStatusIndicator';
import { ApiHealthIndicator } from './components/ApiHealthIndicator';
import { ToastProvider, useToastContext } from './hooks/useToastContext';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useAuthContext } from './contexts/AuthContext';

/**
 * Resilient Lazy Loader with fallback error component
 */
const lazyLoad = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<any>, 
  componentName: string
) => {
  return React.lazy((): Promise<{ default: T }> => 
    importFunc()
      .then(module => ({ default: module[componentName] as T }))
      .catch(error => {
        console.error(`[Boot] Resource Offline: ${componentName}`, error);
        const ErrorComponent: React.FC = () => (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-brand-blue text-white font-mono">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 flex items-center justify-center mb-6 text-red-500">
              <i className="fa-solid fa-link-slash text-2xl"></i>
            </div>
            <h3 className="font-black text-xl mb-2 italic uppercase text-brand-orange">PROTOCOL_FAILURE</h3>
            <p className="text-[10px] text-white/30 mb-8 uppercase tracking-widest max-w-xs leading-relaxed">
              The component node {componentName} failed to synchronize with the core grid.
            </p>
            <button onClick={() => window.location.reload()} className="px-10 py-4 bg-brand-orange text-brand-text-dark rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] haptic-press shadow-xl shadow-brand-orange/20">
              Restart Uplink
            </button>
          </div>
        );
        return { default: ErrorComponent as unknown as T };
      })
  );
};

// Strategic View Imports
const LoginView = lazyLoad<React.FC<LoginViewProps>>(() => import('./components/LoginView'), 'LoginView');
const RiderHomeView = lazyLoad<React.FC<HomeViewProps>>(() => import('./components/RiderHomeView'), 'RiderHomeView');
const DriverHomeView = lazyLoad<React.FC<HomeViewProps>>(() => import('./components/DriverHomeView'), 'DriverHomeView');
const PendingApprovalView = lazyLoad<React.FC<HomeViewProps>>(() => import('./components/PendingApprovalView'), 'PendingApprovalView');
const AdminDashboard = lazyLoad<React.FC<HomeViewProps>>(() => import('./components/AdminDashboard'), 'AdminDashboard');

const App: React.FC = () => {
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);
  
  const { isOnline } = useNetworkStatus();
  const toast = useToastContext();
  const toastRef = useRef(toast);
  const authContext = useAuthContext();
  
  // Keep toastRef up to date
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Initialize hasSeenIntro from localStorage
  useEffect(() => {
    const seen = localStorage.getItem('ridein_intro_seen');
    setHasSeenIntro(seen === 'true');
  }, []);

  // Show session expiration notification
  useEffect(() => {
    if (authContext.authState === 'session_expired' && authContext.error) {
      toastRef.current.error(authContext.error);
    } else if (authContext.authState === 'session_expiring') {
      toastRef.current.warning('Your session will expire soon. You will be logged out automatically.');
    }
  }, [authContext.authState, authContext.error]);

  const handleLogin = async () => {
    // LoginView already called authContext.login/signup which saved the token.
    // Now refresh the authContext to pick up the new session.
    await authContext.refreshUser();
  };

  const handleLogout = () => {
    authContext.logout();
  };

  const handleCompleteIntro = () => {
    localStorage.setItem('ridein_intro_seen', 'true');
    setHasSeenIntro(true);
  };

  // Loading component for suspense fallback
  const LoadingFallback = () => (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-brand-blue font-semibold">Loading...</p>
      </div>
    </div>
  );

  // Condition 1: Initial Load
  if (authContext.authState === 'initializing' || hasSeenIntro === null) {
    return <LoadingFallback />;
  }

  // Condition 2: First-time tactical onboarding
  if (!hasSeenIntro) {
    return <PublicOnboardingView onComplete={handleCompleteIntro} />;
  }

  // Condition 3: Unauthorized state
  if (!authContext.user || authContext.authState === 'unauthenticated') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginView onLogin={handleLogin} />
      </Suspense>
    );
  }

  const user = authContext.user;

  // Role-based routing logic
  const isDriver = user.role === 'driver';
  const isAdmin = user.role === 'admin';
  const isApproved = user.driver_approved === true || user.driver_status === 'approved';

  return (
    <Suspense fallback={<LoadingFallback />}>
      {isAdmin ? (
        <AdminDashboard 
          user={user} 
          onLogout={handleLogout} 
          onUserUpdate={async (updatedUser) => {
            await authContext.refreshUser();
          }} 
        />
      ) : isDriver ? (
        isApproved ? (
          <DriverHomeView 
            user={user} 
            onLogout={handleLogout} 
            onUserUpdate={async (updatedUser) => {
              await authContext.refreshUser();
            }} 
          />
        ) : (
          <PendingApprovalView 
            user={user} 
            onLogout={handleLogout} 
            onUserUpdate={async (updatedUser) => {
              await authContext.refreshUser();
            }} 
          />
        )
      ) : (
        <RiderHomeView 
          user={user} 
          onLogout={handleLogout} 
          onUserUpdate={async (updatedUser) => {
            await authContext.refreshUser();
          }} 
        />
      )}
      
      {/* Session Status Indicator */}
      <SessionStatusIndicator />
      
      {/* API Health Indicator */}
      <ApiHealthIndicator />
      
      {/* Global Connectivity Overlay - tactical feedback */}
      <OfflineBanner isOnline={isOnline} />
      
      {/* Global Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </Suspense>
  );
};

export default App;