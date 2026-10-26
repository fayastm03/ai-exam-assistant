import React from 'react';
import { Loader2 } from 'lucide-react';

export default function StudentLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-xs text-neutral-400">Loading student portal...</p>
    </div>
  );
}
