'use client';

import type { RoasterError } from '@/types/roaster';

interface ErrorDisplayProps {
  error: string | null;
  roasterError?: RoasterError | null;
}

export function ErrorDisplay({ error, roasterError }: ErrorDisplayProps) {
  // If we have a roasterError, prefer showing its details
  const hasError = error || roasterError;
  
  if (!hasError) return null;

  const displayMessage = roasterError?.message || error;
  const errorCode = roasterError?.code;
  const isFatal = roasterError?.fatal ?? false;

  return (
    <div className={`
      ${isFatal ? 'bg-red-900/70 border-red-500' : 'bg-red-900/50 border-red-600'} 
      border rounded-lg p-4
    `}>
      <div className="flex items-start gap-3">
        <svg
          className={`w-6 h-6 ${isFatal ? 'text-red-300' : 'text-red-400'} flex-shrink-0 mt-0.5`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          {errorCode && (
            <span className={`
              inline-block px-2 py-0.5 text-xs font-mono rounded mb-1
              ${isFatal ? 'bg-red-800 text-red-200' : 'bg-red-900 text-red-300'}
            `}>
              {errorCode}
            </span>
          )}
          <p className={isFatal ? 'text-red-200 font-medium' : 'text-red-300'}>
            {displayMessage}
          </p>
          {isFatal && (
            <p className="text-red-400 text-sm mt-2">
              ⚠️ This error requires acknowledgment. Press "Clear Fault" to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
