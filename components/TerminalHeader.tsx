
import React from 'react';
import { APP_VERSION, AUTHOR_NAME } from '../constants.tsx';

export default function TerminalHeader() {
  return (
    <div className="bg-black/80 border-b border-red-950 px-4 py-3 flex items-center justify-between select-none relative z-50 backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#ff0000] animate-pulse"></div>
        <div className="flex flex-col">
          <span className="text-[10px] font-orbitron text-red-600 tracking-[0.2em] uppercase font-black italic">
            WORM_CORE
          </span>
          <span className="text-[7px] opacity-30 uppercase font-bold tracking-widest">
            {APP_VERSION}
          </span>
        </div>
      </div>
      
      <div className="text-[8px] text-right">
        <div className="text-red-900 font-bold uppercase tracking-tighter">Master_Uplink</div>
        <div className="text-red-500 font-black italic">{AUTHOR_NAME}</div>
      </div>
    </div>
  );
}
