import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/** Reusable loading/error/empty gate for list and detail screens. Renders children only in the success case. */
export default function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  errorMessage = 'Something went wrong.',
  onRetry,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 text-[#ff4d8d] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-white/60 text-sm">{errorMessage}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-[#ff4d8d] text-sm font-semibold mt-1">
            Try again
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
        <Inbox className="w-6 h-6 text-white/30" />
        <p className="text-white/30 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
