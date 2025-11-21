import React, { useState } from 'react';
import { GameState, GamePhase, TurnData } from './types';
import { initializeGame, sendAction } from './services/geminiService';
import { SetupScreen } from './components/SetupScreen';
import { StatusPanel } from './components/StatusPanel';
import { StoryPanel } from './components/StoryPanel';
import { AlertTriangle, Menu, X, User } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.SETUP,
    history: [],
    currentTurn: null,
    isLoading: false,
    language: 'English',
    error: null,
  });

  const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);

  const handleStartGame = async (lang: 'English' | 'Indonesian', name: string, gender: string, isRandom: boolean) => {
    setGameState(prev => ({ ...prev, isLoading: true, error: null, language: lang }));
    
    try {
      const turnData = await initializeGame(lang, name, gender, isRandom);
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.PLAYING,
        isLoading: false,
        currentTurn: turnData,
        history: [turnData]
      }));
    } catch (error) {
      console.error(error);
      setGameState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to initialize the cultivation world. The connection to the Heavenly Dao is severed. Please check your API Key or try again." 
      }));
    }
  };

  const handleAction = async (actionText: string) => {
    setGameState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const turnData = await sendAction(actionText);
      setGameState(prev => ({
        ...prev,
        isLoading: false,
        currentTurn: turnData,
        history: [...prev.history, turnData]
      }));
    } catch (error) {
      console.error(error);
      setGameState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Your action failed to reach the heavens. (API Error)" 
      }));
    }
  };

  // Render Error Banner
  const ErrorBanner = () => gameState.error ? (
    <div className="absolute top-14 md:top-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-3 w-[90%] md:w-auto">
        <AlertTriangle size={20} className="shrink-0" />
        <span className="text-sm">{gameState.error}</span>
        <button 
            onClick={() => setGameState(prev => ({...prev, error: null}))} 
            className="ml-auto hover:text-white font-bold"
        >
            ✕
        </button>
    </div>
  ) : null;

  if (gameState.phase === GamePhase.SETUP) {
    return (
        <>
            <ErrorBanner />
            <SetupScreen onStart={handleStartGame} isLoading={gameState.isLoading} />
        </>
    );
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row overflow-hidden bg-ink-900 text-gray-200 relative">
      <ErrorBanner />
      
      {/* --- Mobile Header --- */}
      {gameState.currentTurn && (
          <div className="md:hidden h-14 bg-ink-950 border-b border-jade-900/30 flex items-center justify-between px-4 z-30 shrink-0 shadow-md">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-ink-800 rounded-full flex items-center justify-center border border-jade-900/50">
                  <User size={16} className="text-jade-500"/>
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-parchment-100 leading-tight">{gameState.currentTurn.status.name}</span>
                  <span className="text-[10px] text-jade-400 uppercase tracking-wider leading-tight">{gameState.currentTurn.status.realm}</span>
               </div>
            </div>
            <button 
                onClick={() => setIsMobileStatusOpen(true)} 
                className="p-2 text-jade-500 hover:bg-ink-800 rounded transition-colors"
                aria-label="Open Status"
            >
              <Menu size={24} />
            </button>
          </div>
      )}

      {/* --- Mobile Status Drawer/Overlay --- */}
      {isMobileStatusOpen && gameState.currentTurn && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col animate-in slide-in-from-right duration-200">
            <div className="bg-ink-950 p-4 flex justify-between items-center border-b border-jade-900/30 shrink-0">
                <div className="flex items-center gap-2 text-jade-500">
                    <User size={20} />
                    <span className="font-serif text-lg">Character Status</span>
                </div>
                <button 
                    onClick={() => setIsMobileStatusOpen(false)} 
                    className="p-2 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>
            </div>
            <div className="flex-1 overflow-hidden bg-ink-900">
                <StatusPanel status={gameState.currentTurn.status} />
            </div>
        </div>
      )}
      
      {/* --- Desktop Sidebar --- */}
      <div className="hidden md:block w-80 flex-shrink-0 h-full z-20 relative">
         {gameState.currentTurn && <StatusPanel status={gameState.currentTurn.status} />}
      </div>

      {/* --- Main Story Area --- */}
      <div className="flex-1 h-full relative z-10 overflow-hidden">
        <StoryPanel 
            turnData={gameState.currentTurn} 
            onAction={handleAction} 
            isLoading={gameState.isLoading} 
        />
      </div>
    </div>
  );
}