import React, { useState } from 'react';
import { Scroll, Play, Dices } from 'lucide-react';

interface SetupScreenProps {
  onStart: (lang: 'English' | 'Indonesian', name: string, gender: string, isRandom: boolean) => void;
  isLoading: boolean;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, isLoading }) => {
  const [lang, setLang] = useState<'English' | 'Indonesian'>('English');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');
  const [isRandom, setIsRandom] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !isRandom) return;
    onStart(lang, isRandom ? "Unknown" : name, isRandom ? "Unknown" : gender, isRandom);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 relative overflow-hidden p-4">
        {/* Background Ambience */}
        <div className="absolute inset-0 bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] opacity-10 bg-cover bg-center"></div>
        
        <div className="relative max-w-md w-full bg-ink-800 border border-gray-700 rounded-2xl shadow-2xl p-8 z-10">
            <div className="text-center mb-8">
                <div className="inline-block p-3 bg-ink-900 rounded-full border border-gray-700 mb-4 text-jade-500">
                    <Scroll size={32} />
                </div>
                <h1 className="text-3xl font-serif text-gray-100 mb-2">Daoist Dungeon Master</h1>
                <p className="text-gray-500 text-sm">Enter the Cycle of Reincarnation</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Language */}
                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">Language</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setLang('English')}
                            className={`py-2 px-4 rounded border transition-all ${lang === 'English' ? 'bg-jade-900/50 border-jade-500 text-jade-100' : 'bg-ink-900 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                        >
                            English
                        </button>
                        <button
                            type="button"
                            onClick={() => setLang('Indonesian')}
                            className={`py-2 px-4 rounded border transition-all ${lang === 'Indonesian' ? 'bg-jade-900/50 border-jade-500 text-jade-100' : 'bg-ink-900 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                        >
                            Indonesian
                        </button>
                    </div>
                </div>

                {!isRandom && (
                    <>
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">Dao Name</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Lin Fan"
                                className="w-full bg-ink-900 border border-gray-700 rounded p-3 text-gray-200 focus:border-jade-500 focus:ring-1 focus:ring-jade-500 outline-none transition-all"
                            />
                        </div>

                        {/* Gender */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">Gender</label>
                            <select 
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full bg-ink-900 border border-gray-700 rounded p-3 text-gray-200 focus:border-jade-500 outline-none"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Dao Spirit</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Random Toggle */}
                <div className="flex items-center gap-3 py-2">
                    <button 
                        type="button"
                        onClick={() => setIsRandom(!isRandom)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${isRandom ? 'bg-jade-600' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isRandom ? 'left-5' : 'left-1'}`}></div>
                    </button>
                    <span className="text-sm text-gray-400 cursor-pointer" onClick={() => setIsRandom(!isRandom)}>Random Reincarnation</span>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading || (!name && !isRandom)}
                    className="w-full py-4 bg-gradient-to-r from-jade-700 to-jade-900 hover:from-jade-600 hover:to-jade-800 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <span className="animate-pulse">Generating World...</span>
                    ) : (
                        <>
                           {isRandom ? <Dices size={20} /> : <Play size={20} />}
                           <span>Begin Journey</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    </div>
  );
};
