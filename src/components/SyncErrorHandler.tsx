import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface SyncError {
  type: 'create' | 'update' | 'delete';
  entity: string;
  error: string;
  timestamp: number;
}

export const SyncErrorHandler: React.FC = () => {
  const [errors, setErrors] = useState<SyncError[]>([]);

  useEffect(() => {
    const handleSyncError = (event: CustomEvent) => {
      const { type, entity, error } = event.detail;
      const newError: SyncError = {
        type,
        entity,
        error,
        timestamp: Date.now()
      };
      
      setErrors(prev => [newError, ...prev.slice(0, 4)]); // Keep only last 5 errors
      
      // Auto-remove error after 10 seconds
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.timestamp !== newError.timestamp));
      }, 10000);
    };

    window.addEventListener('sync-error', handleSyncError as EventListener);
    
    return () => {
      window.removeEventListener('sync-error', handleSyncError as EventListener);
    };
  }, []);

  const dismissError = (timestamp: number) => {
    setErrors(prev => prev.filter(e => e.timestamp !== timestamp));
  };

  const retrySync = () => {
    window.dispatchEvent(new CustomEvent('data-sync-required'));
    setErrors([]); // Clear all errors on retry
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {errors.map((error) => (
        <div
          key={error.timestamp}
          className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md"
        >
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800">
                Sync Error: {error.type} {error.entity}
              </h4>
              <p className="text-sm text-red-700 mt-1">{error.error}</p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={retrySync}
                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Sync
                </button>
                <button
                  onClick={() => dismissError(error.timestamp)}
                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
