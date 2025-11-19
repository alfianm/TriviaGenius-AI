import React, { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import StandardGame from './components/StandardGame';
import LiveGame from './components/LiveGame';
import { GameConfig, GameMode, TriviaQuestion, Personality } from './types';
import { generateTriviaQuestions } from './services/geminiService';
import { Loader2, ExternalLink } from 'lucide-react';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SETUP);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleStartGame = async (newConfig: GameConfig) => {
    setConfig(newConfig);
    setGameMode(GameMode.LOADING);
    setError(null);

    try {
      const { questions, sources } = await generateTriviaQuestions(newConfig.topic, "medium");
      setQuestions(questions);
      setSources(sources);
      
      if (newConfig.mode === 'live') {
        setGameMode(GameMode.LIVE);
      } else {
        setGameMode(GameMode.STANDARD);
      }
    } catch (err) {
      setError("Failed to generate questions. Please try a different topic.");
      setGameMode(GameMode.SETUP);
    }
  };

  const handleGameComplete = (score: number) => {
    setFinalScore(score);
    setGameMode(GameMode.RESULTS);
  };

  const resetGame = () => {
    setGameMode(GameMode.SETUP);
    setQuestions([]);
    setSources([]);
    setFinalScore(0);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="z-10 w-full max-w-4xl flex flex-col items-center">
        
        {gameMode === GameMode.SETUP && (
          <>
            <SetupScreen onStart={handleStartGame} />
            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}
          </>
        )}

        {gameMode === GameMode.LOADING && (
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto" />
            <h2 className="text-2xl font-bold text-white">Constructing Trivia...</h2>
            <p className="text-slate-400">Searching the web for facts about "{config?.topic}"</p>
          </div>
        )}

        {gameMode === GameMode.STANDARD && config && (
          <StandardGame 
            questions={questions} 
            personality={config.personality} 
            onComplete={handleGameComplete} 
          />
        )}

        {gameMode === GameMode.LIVE && config && (
          <LiveGame 
            questions={questions} 
            personality={config.personality} 
            onEndGame={() => handleGameComplete(0)} 
          />
        )}

        {gameMode === GameMode.RESULTS && (
          <div className="bg-slate-800/90 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-700 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-2">Game Over!</h2>
            {config?.mode === 'standard' && (
               <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 my-6">
                  {finalScore} / {questions.length}
               </p>
            )}
            <p className="text-slate-400 mb-8">
              {config?.mode === 'live' ? "Thanks for chatting with the host!" : "Great effort!"}
            </p>
            
            <button 
              onClick={resetGame}
              className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Search Grounding Sources Footer */}
        {sources.length > 0 && gameMode !== GameMode.SETUP && gameMode !== GameMode.LOADING && (
          <div className="mt-8 w-full max-w-2xl">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2 text-center">Sources</p>
            <div className="flex flex-wrap justify-center gap-2">
              {sources.map((url, idx) => {
                try {
                  const domain = new URL(url).hostname.replace('www.', '');
                  return (
                    <a 
                      key={idx} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-slate-900/50 rounded border border-slate-800 text-xs text-slate-400 hover:text-purple-400 hover:border-purple-500/50 transition-colors"
                    >
                      <span className="truncate max-w-[150px]">{domain}</span>
                      <ExternalLink size={10} />
                    </a>
                  );
                } catch (e) { return null; }
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;