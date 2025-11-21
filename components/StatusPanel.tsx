import React from 'react';
import { CharacterStatus } from '../types';
import { Scroll, MapPin, User, Activity, Zap, BookOpen, Shield, Users, Briefcase } from 'lucide-react';

interface StatusPanelProps {
  status: CharacterStatus;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status }) => {
  return (
    <div className="h-full bg-ink-800 border-r border-gray-700 flex flex-col overflow-y-auto text-sm shadow-xl">
      <div className="p-6 space-y-6">
        
        {/* Header / Location */}
        <div className="bg-ink-900/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 text-jade-400 mb-1">
             <MapPin size={16} />
             <span className="font-semibold tracking-wider">LOCATION</span>
          </div>
          <div className="text-gray-100 font-serif text-lg leading-tight">{status.location}</div>
          <div className="text-gray-500 text-xs mt-2 flex items-center gap-1">
            <Scroll size={12} />
            {status.date}
          </div>
        </div>

        {/* Character Identity */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-2">
                Cultivator
            </h3>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-200">
                    <User size={16} className="text-jade-500" />
                    <span className="font-semibold">{status.name}</span>
                </div>
                <span className="text-gray-400">{status.age} yrs</span>
            </div>
            <div className="flex items-center justify-between bg-ink-900/30 p-2 rounded">
                 <div className="flex items-center gap-2 text-purple-400">
                    <Activity size={16} />
                    <span>{status.realm}</span>
                 </div>
                 <div className="text-yellow-600 font-mono text-xs">CP: {status.cp}</div>
            </div>
            <div className="flex items-center gap-2 text-gray-300 bg-ink-900/30 p-2 rounded">
                <Zap size={16} className="text-blue-400" />
                <span>{status.root}</span>
            </div>
        </div>

        {/* Active Arts */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-2 flex items-center gap-2">
                <BookOpen size={14} /> Daoist Arts
            </h3>
            <ul className="space-y-2">
                {status.activeArts.length > 0 ? (
                    status.activeArts.map((art, idx) => (
                        <li key={idx} className="text-gray-300 pl-2 border-l-2 border-jade-700 text-xs py-1">
                            {art}
                        </li>
                    ))
                ) : (
                    <li className="text-gray-600 italic">None learned</li>
                )}
            </ul>
        </div>

        {/* Inventory */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-2 flex items-center gap-2">
                <Briefcase size={14} /> Spatial Bag
            </h3>
             <div className="flex flex-wrap gap-2">
                {status.keyItems.length > 0 ? (
                    status.keyItems.map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                            {item}
                        </span>
                    ))
                ) : (
                    <span className="text-gray-600 text-xs italic">Empty</span>
                )}
             </div>
        </div>

        {/* Relations */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-2 flex items-center gap-2">
                <Users size={14} /> Karma & Bonds
            </h3>
            <ul className="space-y-1">
                {status.relations.length > 0 ? (
                    status.relations.map((rel, idx) => (
                        <li key={idx} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-jade-600">•</span> {rel}
                        </li>
                    ))
                ) : (
                    <li className="text-gray-600 italic text-xs">No significant bonds</li>
                )}
            </ul>
        </div>

      </div>
    </div>
  );
};
