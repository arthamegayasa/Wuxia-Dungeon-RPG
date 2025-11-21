import React from 'react';
import { CharacterStatus } from '../types';
import { Scroll, MapPin, User, Activity, Zap, BookOpen, Shield, Users, Briefcase } from 'lucide-react';

interface StatusPanelProps {
  status: CharacterStatus;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status }) => {
  return (
    <div className="h-full bg-ink-900 border-r border-jade-900/30 flex flex-col overflow-y-auto text-sm shadow-2xl scrollbar-thin scrollbar-track-ink-900 scrollbar-thumb-jade-900">
      <div className="p-6 space-y-8">
        
        {/* Header / Location */}
        <div className="bg-gradient-to-br from-ink-950 to-ink-900 p-5 rounded-lg border border-jade-900/30 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <MapPin size={48} className="text-jade-500" />
          </div>
          <div className="flex items-center gap-2 text-jade-500 mb-2 uppercase tracking-widest text-[10px] font-bold">
             <span>Current Location</span>
          </div>
          <div className="text-parchment-100 font-serif text-xl leading-tight font-medium relative z-10">{status.location}</div>
          <div className="text-gray-500 text-xs mt-3 flex items-center gap-2 font-mono border-t border-gray-800/50 pt-2">
            <Scroll size={12} />
            {status.date}
          </div>
        </div>

        {/* Character Identity */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 text-gray-500">
                <User size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Cultivator Status
                </h3>
            </div>
            
            <div className="bg-ink-800/30 rounded-lg p-4 space-y-4 border border-gray-800/50">
                <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-lg text-parchment-100 tracking-wide">{status.name}</span>
                    <span className="text-gray-500 text-xs font-mono bg-ink-950 px-2 py-1 rounded">{status.age} yrs</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-ink-950/80 p-3 rounded border border-gray-800 flex flex-col gap-1">
                         <span className="text-[10px] text-gray-500 uppercase">Realm</span>
                         <div className="flex items-center gap-1.5 text-purple-300 text-sm font-medium">
                            <Activity size={14} />
                            <span>{status.realm}</span>
                         </div>
                    </div>
                    <div className="bg-ink-950/80 p-3 rounded border border-gray-800 flex flex-col gap-1">
                         <span className="text-[10px] text-gray-500 uppercase">Combat Power</span>
                         <div className="text-yellow-600/90 font-mono text-sm font-bold flex items-center gap-1.5">
                             <Shield size={14} />
                             {status.cp}
                         </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs pt-1 px-1 border-t border-gray-800/30">
                    <Zap size={14} className="text-jade-400/70" />
                    <span className="text-gray-400">Root: <span className="text-parchment-200">{status.root}</span></span>
                </div>
            </div>
        </div>

        {/* Active Arts */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-3 text-gray-500">
                <BookOpen size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Daoist Arts
                </h3>
            </div>
            <ul className="space-y-2">
                {status.activeArts.length > 0 ? (
                    status.activeArts.map((art, idx) => (
                        <li key={idx} className="text-parchment-300 pl-3 border-l-2 border-jade-800 text-xs py-1.5 hover:bg-ink-800/30 transition-colors rounded-r">
                            {art}
                        </li>
                    ))
                ) : (
                    <li className="text-gray-700 italic text-xs pl-2">None learned yet</li>
                )}
            </ul>
        </div>

        {/* Inventory */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-3 text-gray-500">
                <Briefcase size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Spatial Bag
                </h3>
            </div>
             <div className="flex flex-wrap gap-2">
                {status.keyItems.length > 0 ? (
                    status.keyItems.map((item, idx) => (
                        <span key={idx} className="px-2.5 py-1.5 bg-ink-800 rounded text-xs text-gray-300 border border-gray-700/50 shadow-sm">
                            {item}
                        </span>
                    ))
                ) : (
                    <span className="text-gray-700 text-xs italic pl-2">Empty</span>
                )}
             </div>
        </div>

        {/* Relations */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-3 text-gray-500">
                <Users size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Karma & Bonds
                </h3>
            </div>
            <ul className="space-y-2">
                {status.relations.length > 0 ? (
                    status.relations.map((rel, idx) => (
                        <li key={idx} className="text-xs text-gray-400 flex items-start gap-2 bg-ink-950/30 p-2 rounded border border-gray-800/30">
                            <span className="text-jade-700 mt-0.5">•</span> {rel}
                        </li>
                    ))
                ) : (
                    <li className="text-gray-700 italic text-xs pl-2">No karmic ties</li>
                )}
            </ul>
        </div>

      </div>
    </div>
  );
};