import React, { useEffect, useRef, useState } from 'react';
import { TurnData, GameChoice } from '../types';
import { Send, Sparkles, Feather, Info, X, Dice5, Trophy, Skull, AlertCircle } from 'lucide-react';

interface StoryPanelProps {
  turnData: TurnData | null;
  onAction: (action: string) => void;
  isLoading: boolean;
}

export const StoryPanel: React.FC<StoryPanelProps> = ({ turnData, onAction, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [customInput, setCustomInput] = useState('');
  const [displayedNarrative, setDisplayedNarrative] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedChoiceId, setExpandedChoiceId] = useState<number | null>(null);
  const typingSpeedRef = useRef(10); // ms per char

  // Typing effect logic
  useEffect(() => {
    if (!turnData) return;
    
    setIsTyping(true);
    setDisplayedNarrative(''); // Clear previous text
    setExpandedChoiceId(null); // Reset expanded choice on new turn
    
    const fullText = turnData.narrative;
    let currentIndex = 0;
    
    const timer = setInterval(() => {
      currentIndex++;
      setDisplayedNarrative(fullText.substring(0, currentIndex));
      
      // Auto-scroll logic
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight - scrollTop - clientHeight < 150) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      }

      if (currentIndex >= fullText.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, typingSpeedRef.current);

    return () => clearInterval(timer);
  }, [turnData]);

  const handleChoiceClick = (choice: GameChoice) => {
    if (isLoading || isTyping) return;
    
    if (choice.id === 3 || choice.text.toLowerCase().includes('free action')) {
       const inputEl = document.getElementById('custom-action-input');
       inputEl?.focus();
       return;
    }

    onAction(choice.text);
  };

  const toggleChoiceDetails = (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      setExpandedChoiceId(expandedChoiceId === id ? null : id);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isLoading) return;
    onAction(customInput);
    setCustomInput('');
  };

  const parseMarkdown = (text: string) => {
      let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-jade-400 font-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-jade-200/80">$1</em>')
        .replace(/^#\s+(.*)$/gm, '<h2 class="text-2xl font-bold text-jade-500 mt-8 mb-4 border-b border-jade-900/50 pb-2">$1</h2>')
        .replace(/^##\s+(.*)$/gm, '<h3 class="text-xl font-bold text-jade-400 mt-6 mb-3">$1</h3>');
      
      html = html.replace(/\n\n/g, '<div class="h-6"></div>');
      html = html.replace(/\n/g, '<br />');

      return { __html: html };
  };

  const skipTyping = () => {
      if (!isTyping || !turnData) return;
      setDisplayedNarrative(turnData.narrative);
      setIsTyping(false);
  };

  const renderSubtextDetails = (subtext: string) => {
      const parts = subtext.split('|').map(s => s.trim()).filter(Boolean);
      
      return (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-700/50 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200">
              {parts.map((part, idx) => {
                  let icon = <Info size={14} className="text-gray-500" />;
                  let colorClass = "text-gray-400";
                  
                  const lower = part.toLowerCase();
                  if (lower.includes('chance')) {
                      icon = <Dice5 size={14} className="text-blue-400" />;
                      colorClass = "text-blue-200";
                  } else if (lower.includes('reward') || lower.includes('success') || lower.includes('benefit')) {
                      icon = <Trophy size={14} className="text-jade-400" />;
                      colorClass = "text-jade-200";
                  } else if (lower.includes('risk') || lower.includes('failure') || lower.includes('danger')) {
                      icon = <Skull size={14} className="text-red-400" />;
                      colorClass = "text-red-200";
                  }

                  return (
                      <div key={idx} className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">{icon}</div>
                          <span className={`${colorClass} font-mono leading-tight`}>{part}</span>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col bg-ink-950 relative font-serif" onClick={skipTyping}>
      {/* Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

      {/* Narrative Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative z-0 scrollbar-thin scrollbar-thumb-jade-900 scrollbar-track-ink-950"
      >
        <div className="max-w-4xl mx-auto px-5 py-6 sm:px-10 sm:py-12 min-h-full flex flex-col">
            
            {!turnData && !isLoading && (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-600/50 italic">
                 <Feather size={48} strokeWidth={1} className="mb-4 opacity-30" />
                 <span className="tracking-widest text-sm uppercase">The scroll awaits...</span>
               </div>
            )}
            
            {turnData && (
                <div className="flex-1 pb-10">
                    <div 
                        className="text-lg md:text-xl leading-relaxed text-parchment-200/90 tracking-wide"
                        dangerouslySetInnerHTML={parseMarkdown(displayedNarrative)} 
                    />
                </div>
            )}

            {isLoading && (
                <div className="mt-4 flex items-center justify-center gap-3 text-jade-500/60 animate-pulse py-4">
                    <Sparkles size={16} />
                    <span className="font-sans text-xs tracking-[0.3em] uppercase">Communing with the Dao</span>
                    <Sparkles size={16} />
                </div>
            )}
            
            <div ref={bottomRef} className="h-4"></div>
        </div>
      </div>

      {/* Interaction Area */}
      <div className="bg-ink-900/95 backdrop-blur-md border-t border-jade-900/30 p-3 sm:p-6 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         
         {turnData && !isLoading && !isTyping && (
             <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-2">
                    {turnData.choices.filter(c => c.id !== 3 && !c.text.toLowerCase().includes("free action")).map((choice) => (
                        <div key={choice.id} className="group relative flex flex-col rounded-lg transition-all duration-200 bg-ink-800 border border-gray-800 hover:border-jade-500/50 shadow-sm">
                            <div className="flex items-stretch min-h-[3.5rem]">
                                {/* Main Action Button */}
                                <button
                                    onClick={() => handleChoiceClick(choice)}
                                    className="flex-1 text-left px-4 py-3 hover:bg-ink-800/80 flex items-center"
                                >
                                    <span className="font-bold text-parchment-100 group-hover:text-white text-base sm:text-lg font-serif">
                                        {choice.text}
                                    </span>
                                </button>

                                {/* Info/Details Toggle */}
                                {choice.subtext && (
                                    <button
                                        onClick={(e) => toggleChoiceDetails(e, choice.id)}
                                        className={`px-4 flex items-center justify-center border-l border-gray-800 transition-colors ${expandedChoiceId === choice.id ? 'bg-ink-950 text-jade-500' : 'hover:bg-ink-900/50 text-gray-500 hover:text-jade-400'}`}
                                    >
                                        {expandedChoiceId === choice.id ? <X size={18} /> : <Info size={18} />}
                                    </button>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {expandedChoiceId === choice.id && choice.subtext && (
                                <div className="bg-ink-950/50 px-4 pb-4 rounded-b-lg">
                                    {renderSubtextDetails(choice.subtext)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Custom Input (Free Action) */}
                <div className="relative pt-1 sm:pt-2">
                     <form onSubmit={(e) => { e.stopPropagation(); handleCustomSubmit(e); }} className="relative">
                        <input
                            id="custom-action-input"
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Forge your own destiny..."
                            className="w-full bg-ink-950 text-parchment-200 border border-gray-800 rounded-lg pl-5 pr-12 py-3 focus:outline-none focus:border-jade-600 focus:ring-1 focus:ring-jade-600/50 transition-all font-serif placeholder:text-gray-700 placeholder:italic shadow-inner text-sm sm:text-base"
                        />
                        <button 
                            type="submit"
                            disabled={!customInput.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-jade-400 disabled:opacity-30 transition-colors"
                        >
                            <Send size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </form>
                </div>
             </div>
         )}
      </div>
    </div>
  );
};