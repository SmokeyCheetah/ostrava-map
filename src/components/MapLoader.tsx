'use client';

import dynamic from 'next/dynamic';

// Dynamic import of the actual Leaflet Map component with SSR disabled
const MapLoader = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Načítám mapu Ostravy...</p>
      </div>
    </div>
  ),
});

export default MapLoader;
