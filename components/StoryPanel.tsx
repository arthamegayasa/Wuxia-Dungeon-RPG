import React, { useEffect, useRef, useState } from 'react';
import { TurnData, GameChoice } from '../types';
import { Send, Sparkles, Feather } from 'lucide-react';

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
  const typingSpeedRef = useRef(10); // ms per char

  // Typing effect logic
  useEffect(() => {
    if (!turnData) return;
    
    setIsTyping(true);
    setDisplayedNarrative(''); // Clear previous text
    
    // We use the full string and slice it to avoid any index-0 skipping issues
    const fullText = turnData.narrative;
    let currentIndex = 0;
    
    const timer = setInterval(() => {
      currentIndex++;
      // Using substring(0, currentIndex) ensures we always capture the start of the string correctly
      setDisplayedNarrative(fullText.substring(0, currentIndex));
      
      // Auto-scroll logic
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // Only auto-scroll if user is already near the bottom to prevent jumping if reading history
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

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isLoading) return;
    onAction(customInput);
    setCustomInput('');
  };

  const parseMarkdown = (text: string) => {
      let html = text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-jade-400 font-bold">$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em class="text-jade-200/80">$1</em>')
        // Headers
        .replace(/^#\s+(.*)$/gm, '<h2 class="text-2xl font-bold text-jade-500 mt-8 mb-4 border-b border-jade-900/50 pb-2">$1</h2>')
        .replace(/^##\s+(.*)$/gm, '<h3 class="text-xl font-bold text-jade-400 mt-6 mb-3">$1</h3>');
      
      // Paragraph spacing - Replace double newlines with a spacing div
      html = html.replace(/\n\n/g, '<div class="h-6"></div>');
      // Replace single newlines with break
      html = html.replace(/\n/g, '<br />');

      return { __html: html };
  };

  // Allow user to click to skip typing effect
  const skipTyping = () => {
      if (!isTyping || !turnData) return;
      setDisplayedNarrative(turnData.narrative);
      setIsTyping(false);
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
        {/* Optimized padding for mobile (px-5 py-6) */}
        <div className="max-w-4xl mx-auto px-5 py-6 sm:px-10 sm:py-12 min-h-full flex flex-col">
            
            {!turnData && !isLoading && (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-600/50 italic">
                 <Feather size={48} strokeWidth={1} className="mb-4 opacity-30" />
                 <span className="tracking-widest text-sm uppercase">The scroll awaits...</span>
               </div>
            )}
            
            {turnData && (
                <div className="flex-1 pb-10">
                    {/* 
                       Removed 'prose' class to prevent layout/indentation issues.
                       Using explicit text sizing and leading for better readability. 
                    */}
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

      {/* Interaction Area - Redesigned for clarity and mobile compactness */}
      <div className="bg-ink-900/95 backdrop-blur-md border-t border-jade-900/30 p-3 sm:p-6 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         
         {turnData && !isLoading && !isTyping && (
             <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
                {/* Vertical list is better for reading choices than a grid */}
                <div className="flex flex-col gap-2 sm:gap-3">
                    {turnData.choices.filter(c => c.id !== 3 && !c.text.toLowerCase().includes("free action")).map((choice) => (
                        <button
                            key={choice.id}
                            onClick={(e) => { e.stopPropagation(); handleChoiceClick(choice); }}
                            className="group w-full text-left bg-ink-800 border-l-[3px] border-l-gray-600 hover:border-l-jade-500 border-y border-r border-gray-800 p-3 sm:p-4 rounded-r-lg transition-all duration-200 hover:bg-ink-800/80 shadow-sm"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <div className="font-bold text-parchment-100 group-hover:text-white text-base sm:text-lg font-serif">
                                        {choice.text}
                                    </div>
                                    {choice.subtext && (
                                        <div className="text-xs sm:text-sm text-gray-500 group-hover:text-jade-400/90 font-sans mt-1">
                                            {choice.subtext}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
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
                            className="w-full bg-ink-950 text-parchment-200 border border-gray-800 rounded-lg pl-5 pr-12 py-3 sm:py-4 focus:outline-none focus:border-jade-600 focus:ring-1 focus:ring-jade-600/50 transition-all font-serif placeholder:text-gray-700 placeholder:italic shadow-inner text-sm sm:text-base"
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