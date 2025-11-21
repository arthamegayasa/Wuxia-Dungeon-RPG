import React, { useEffect, useRef, useState } from 'react';
import { TurnData, GameChoice } from '../types';
import { Send, Sparkles } from 'lucide-react';

interface StoryPanelProps {
  turnData: TurnData | null;
  onAction: (action: string) => void;
  isLoading: boolean;
}

export const StoryPanel: React.FC<StoryPanelProps> = ({ turnData, onAction, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [customInput, setCustomInput] = useState('');
  const [displayedNarrative, setDisplayedNarrative] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Typing effect logic
  useEffect(() => {
    if (!turnData) return;
    
    // Immediate update if it's a refresh or weird state, but usually we type
    setIsTyping(true);
    setDisplayedNarrative('');
    let i = 0;
    const text = turnData.narrative;
    const speed = 10; // ms per char

    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedNarrative((prev) => prev + text.charAt(i));
        i++;
        // Scroll to bottom while typing
         if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
         }
      } else {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [turnData]);

  const handleChoiceClick = (choice: GameChoice) => {
    if (isLoading || isTyping) return;
    
    // If it's a free action placeholder, focusing the input is handled by the user manually typing,
    // but we can support clicking the button to prompt input too.
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

  // Convert markdown-ish bold/italics to HTML for display
  // Simple parser for bold **text** and *italics*
  const parseMarkdown = (text: string) => {
      const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-jade-300 font-semibold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-gray-400">$1</em>')
        .replace(/\n/g, '<br />');
      return { __html: html };
  };

  return (
    <div className="h-full flex flex-col bg-ink-900 relative">
      
      {/* Narrative Area */}
      <div className="flex-1 overflow-y-auto p-8 sm:p-12 font-serif leading-relaxed text-gray-300 text-lg tracking-wide selection:bg-jade-900 selection:text-white">
        {!turnData && !isLoading && (
           <div className="h-full flex items-center justify-center text-gray-600 italic">
             The scroll is blank. Awaiting the Dao...
           </div>
        )}
        
        {turnData && (
            <div className="prose prose-invert max-w-none">
                 <div dangerouslySetInnerHTML={parseMarkdown(displayedNarrative)} />
            </div>
        )}

        {isLoading && (
            <div className="mt-6 flex items-center gap-2 text-jade-500 animate-pulse">
                <Sparkles size={20} />
                <span className="font-sans text-sm tracking-widest uppercase">Consulting the Heavens...</span>
            </div>
        )}
        
        <div ref={bottomRef} className="h-8"></div>
      </div>

      {/* Interaction Area */}
      <div className="bg-ink-900 border-t border-gray-800 p-6 sm:px-12 sm:py-8 pb-10 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         
         {turnData && !isLoading && !isTyping && (
             <div className="space-y-4 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {turnData.choices.filter(c => c.id !== 3 && !c.text.toLowerCase().includes("free action")).map((choice) => (
                        <button
                            key={choice.id}
                            onClick={() => handleChoiceClick(choice)}
                            className="group text-left bg-gray-800 hover:bg-jade-900/30 border border-gray-700 hover:border-jade-500/50 p-4 rounded-lg transition-all duration-300"
                        >
                            <div className="font-bold text-jade-100 group-hover:text-white mb-1 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-gray-700 text-xs flex items-center justify-center group-hover:bg-jade-600 transition-colors">
                                    {choice.id}
                                </span>
                                {choice.text}
                            </div>
                            {choice.subtext && (
                                <div className="text-xs text-gray-500 group-hover:text-gray-400 pl-8 font-mono">
                                    {choice.subtext}
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Custom Input (Free Action) */}
                <form onSubmit={handleCustomSubmit} className="relative mt-4">
                    <input
                        id="custom-action-input"
                        type="text"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Attempt a unique action..."
                        className="w-full bg-ink-800 text-gray-200 border border-gray-700 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500 transition-all font-sans"
                    />
                    <button 
                        type="submit"
                        disabled={!customInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-jade-400 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
             </div>
         )}
      </div>
    </div>
  );
};
