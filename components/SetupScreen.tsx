import React, { useState } from 'react';
import { GameConfig, Personality } from '../types';
import { Sparkles, Search, Brain, Zap } from 'lucide-react';

interface SetupScreenProps {
  onStart: (config: GameConfig) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [topic, setTopic] = useState('');
  const [personality, setPersonality] = useState<Personality>(Personality.SASSY);
  const [mode, setMode] = useState<'standard' | 'live'>('live');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onStart({ topic, personality, mode });
    }
  };

  return (
    <div className="w-full max-w-lg bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-700/50">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">TriviaGenius AI</h1>
        <p className="text-slate-400">Powered by Gemini 2.5</p>
      </div>

      <form onSubmit={handleStart} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Trivia Topic</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-500" size={20} />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 80s Sci-Fi Movies, Quantum Physics, Cat Breeds..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
              required
            />
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
               <Sparkles size={12} /> Uses Google Search Grounding for accuracy
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Host Personality</label>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(Personality).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPersonality(p)}
                className={`p-3 rounded-lg text-sm font-medium transition-all border ${
                  personality === p
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-slate-700 border-transparent text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Game Mode</label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                mode === 'live'
                  ? 'border-purple-500 bg-purple-900/20 text-purple-100'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <Zap size={24} className={mode === 'live' ? 'text-purple-400' : 'text-slate-500'} />
              <span className="font-bold">Live Voice Chat</span>
              <span className="text-xs opacity-70">Real-time conversation</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                mode === 'standard'
                  ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <Brain size={24} className={mode === 'standard' ? 'text-blue-400' : 'text-slate-500'} />
              <span className="font-bold">Classic Mode</span>
              <span className="text-xs opacity-70">Text & TTS Audio</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!topic}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Game
        </button>
      </form>
    </div>
  );
};

export default SetupScreen;