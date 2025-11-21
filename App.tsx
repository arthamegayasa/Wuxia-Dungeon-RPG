import React, { useState } from 'react';
import { GameState, GamePhase, TurnData } from './types';
import { initializeGame, sendAction } from './services/geminiService';
import { SetupScreen } from './components/SetupScreen';
import { StatusPanel } from './components/StatusPanel';
import { StoryPanel } from './components/StoryPanel';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.SETUP,
    history: [],
    currentTurn: null,
    isLoading: false,
    language: 'English',
    error: null,
  });

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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-3">
        <AlertTriangle size={20} />
        <span>{gameState.error}</span>
        <button 
            onClick={() => setGameState(prev => ({...prev, error: null}))} 
            className="ml-4 hover:text-white font-bold"
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
      
      {/* Left Panel: Status (Fixed width on desktop, hidden/collapsible logic could be added for mobile, but sticking to responsive layout) */}
      <div className="hidden md:block w-80 flex-shrink-0 h-full z-20 relative">
         {gameState.currentTurn && <StatusPanel status={gameState.currentTurn.status} />}
      </div>
      
      {/* Mobile Status Toggle (Simplified: Just show status on top for now or rely on scroll if we were doing complex mobile UI. 
         For this task, we'll stack them on mobile but let Status take less space) */}
      <div className="md:hidden h-1/4 w-full overflow-y-auto border-b border-gray-700">
         {gameState.currentTurn && <StatusPanel status={gameState.currentTurn.status} />}
      </div>

      {/* Right Panel: Story & Interaction */}
      <div className="flex-1 h-3/4 md:h-full relative z-10">
        <StoryPanel 
            turnData={gameState.currentTurn} 
            onAction={handleAction} 
            isLoading={gameState.isLoading} 
        />
      </div>
    </div>
  );
}
