import React from 'react';
import { CharacterStatus } from '../types';
import { Scroll, MapPin, User, Activity, Zap, BookOpen, Shield, Users, Briefcase, Layers, Sword, Backpack } from 'lucide-react';

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
            
            <div className="bg-ink-800/30 rounded-lg p-5 space-y-5 border border-gray-800/50">
                {/* Name & Age Header */}
                <div className="flex items-center justify-between border-b border-gray-800/50 pb-4">
                    <span className="font-serif font-bold text-lg text-parchment-100 tracking-wide">{status.name}</span>
                    <span className="text-gray-500 text-xs font-mono bg-ink-950 px-3 py-1 rounded border border-gray-800">{status.age} yrs</span>
                </div>

                {/* Combat Power Section */}
                <div className="relative group">
                     <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1">
                             <Shield size={12} /> Combat Power
                        </span>
                     </div>
                     <div className="bg-ink-950/80 p-4 rounded border border-yellow-900/30 shadow-inner relative overflow-hidden">
                         <div className="relative z-10 flex items-baseline gap-1">
                             <span className="text-yellow-600/90 font-mono text-xl font-bold tracking-tight">{status.cp}</span>
                         </div>
                         <div className="text-[10px] text-yellow-700/50 uppercase tracking-widest mt-1 font-mono z-10 relative">
                            Spirit Force
                         </div>
                         <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-600/50 to-transparent opacity-50"></div>
                     </div>
                </div>
                
                {/* Realm Section */}
                <div className="relative group">
                     <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1">
                            <Activity size={12} /> Cultivation Realm
                        </span>
                     </div>
                     <div className="bg-ink-950/80 p-4 rounded border border-purple-900/30 shadow-inner flex items-center justify-between relative overflow-hidden">
                         <div className="relative z-10">
                            <div className="text-purple-300 font-serif text-lg font-medium tracking-wide">
                                {status.realm}
                            </div>
                            <div className="text-[10px] text-purple-400/50 uppercase tracking-widest mt-1 font-mono">
                                Stage
                            </div>
                         </div>
                         <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500/50 to-transparent opacity-50"></div>
                         <div className="absolute -right-4 -bottom-4 text-purple-500/10 rotate-12 pointer-events-none">
                             <Layers size={48} />
                         </div>
                     </div>
                </div>

                {/* Root Section */}
                <div className="relative group">
                     <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1">
                            <Zap size={12} /> Spiritual Root
                        </span>
                     </div>
                     <div className="bg-ink-950/80 p-4 rounded border border-blue-900/30 shadow-inner">
                         <div className="text-blue-200/90 text-sm font-medium">
                            {status.root}
                         </div>
                         <div className="text-[10px] text-blue-400/50 uppercase tracking-widest mt-1 font-mono">
                            Affinity
                         </div>
                     </div>
                </div>
            </div>
        </div>

        {/* Active Arts */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-4 text-gray-500">
                <BookOpen size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Daoist Arts
                </h3>
            </div>
            <div className="space-y-3">
                {status.activeArts.length > 0 ? (
                    status.activeArts.map((art, idx) => (
                        <div key={idx} className="bg-ink-950 border border-gray-800 p-3 rounded-md relative overflow-hidden hover:border-jade-800/50 transition-all group">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-jade-800 group-hover:bg-jade-600 transition-colors"></div>
                             <div className="pl-3">
                                <div className="text-parchment-200 text-xs font-bold mb-1 font-serif tracking-wide">
                                    {art.split('(')[0]}
                                </div>
                                {art.includes('(') && (
                                    <div className="text-[10px] text-jade-400/70 font-mono">
                                        {art.split('(')[1].replace(')', '')}
                                    </div>
                                )}
                             </div>
                        </div>
                    ))
                ) : (
                    <div className="text-gray-700 italic text-xs p-4 border border-dashed border-gray-800 rounded text-center bg-ink-950/30">
                        No martial arts learned yet.
                    </div>
                )}
            </div>
        </div>

        {/* Equipped Gear */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-4 text-gray-500">
                <Briefcase size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Combat Gear
                </h3>
            </div>
            
            <div className="space-y-2">
                {/* Weapon Slot */}
                <div className="bg-ink-950 border border-gray-800 p-3 rounded flex items-center gap-3 group hover:border-red-900/50 transition-colors">
                    <div className="w-8 h-8 bg-ink-900 rounded flex items-center justify-center border border-gray-800 text-gray-600 group-hover:text-red-500/70">
                        <Sword size={16} />
                    </div>
                    <div className="flex-1">
                         <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Weapon</div>
                         <div className={`text-xs font-serif ${status.inventory.weapon === 'None' ? 'text-gray-600 italic' : 'text-parchment-200'}`}>
                            {status.inventory.weapon}
                         </div>
                    </div>
                </div>

                {/* Equipment Slots */}
                <div className="grid grid-cols-2 gap-2">
                    {status.inventory.equipment.map((item, idx) => (
                        <div key={idx} className="bg-ink-950 border border-gray-800 p-2.5 rounded flex flex-col gap-2 hover:border-jade-900/30 transition-colors">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Shield size={12} />
                                <span className="text-[9px] uppercase font-bold tracking-wider">Item {idx + 1}</span>
                            </div>
                            <div className={`text-xs font-serif truncate ${item === 'Empty' ? 'text-gray-600 italic' : 'text-parchment-200'}`}>
                                {item}
                            </div>
                        </div>
                    ))}
                    {/* Fallback if equipment array is missing or short (though type ensures it) */}
                    {[...Array(Math.max(0, 2 - status.inventory.equipment.length))].map((_, i) => (
                        <div key={`empty-${i}`} className="bg-ink-950 border border-gray-800/50 border-dashed p-2.5 rounded flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Shield size={12} />
                                <span className="text-[9px] uppercase font-bold tracking-wider">Slot {i + status.inventory.equipment.length + 1}</span>
                            </div>
                            <div className="text-xs text-gray-700 italic">Empty</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Spatial Bag */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-4 text-gray-500">
                <Backpack size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Spatial Bag
                </h3>
            </div>
             <div className="flex flex-wrap gap-2">
                {status.inventory.bag.length > 0 ? (
                    status.inventory.bag.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-ink-950 rounded border border-gray-800 text-xs text-gray-400 shadow-sm flex items-center gap-1 hover:border-gray-600 transition-colors cursor-help">
                           <span className="w-1 h-1 rounded-full bg-gray-600"></span> {item}
                        </span>
                    ))
                ) : (
                    <span className="text-gray-700 text-xs italic pl-2">Bag is empty</span>
                )}
             </div>
        </div>

        {/* Relations */}
        <div>
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-4 text-gray-500">
                <Users size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">
                    Karma & Bonds
                </h3>
            </div>
            <ul className="space-y-2">
                {status.relations.length > 0 ? (
                    status.relations.map((rel, idx) => (
                        <li key={idx} className="text-xs text-gray-400 flex items-center gap-2 bg-ink-950/50 p-2.5 rounded border border-gray-800/50">
                            <span className={`w-1.5 h-1.5 rounded-full ${rel.toLowerCase().includes('hostile') ? 'bg-red-500' : 'bg-jade-600'}`}></span>
                            {rel}
                        </li>
                    ))
                ) : (
                    <li className="text-gray-700 italic text-xs pl-2">No karmic ties established.</li>
                )}
            </ul>
        </div>

      </div>
    </div>
  );
};