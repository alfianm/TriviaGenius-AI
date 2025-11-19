import React, { useState, useEffect, useRef } from 'react';
    import { TriviaQuestion, Personality } from '../types';
    import { speakText } from '../services/geminiService';
    import { Volume2, ArrowRight, RefreshCw } from 'lucide-react';
    
    interface StandardGameProps {
      questions: TriviaQuestion[];
      personality: Personality;
      onComplete: (score: number) => void;
    }
    
    const StandardGame: React.FC<StandardGameProps> = ({ questions, personality, onComplete }) => {
      const [currentIndex, setCurrentIndex] = useState(0);
      const [selectedOption, setSelectedOption] = useState<string | null>(null);
      const [isAnswered, setIsAnswered] = useState(false);
      const [score, setScore] = useState(0);
      const [isPlayingAudio, setIsPlayingAudio] = useState(false);
      const [feedback, setFeedback] = useState('');
    
      const audioContextRef = useRef<AudioContext | null>(null);
    
      const currentQuestion = questions[currentIndex];
    
      useEffect(() => {
        // Initial speak
        playQuestionAudio();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [currentIndex]);
    
      const playAudio = async (text: string) => {
        try {
          setIsPlayingAudio(true);
          const audioData = await speakText(text, personality);
          
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const ctx = audioContextRef.current;
          
          // Decode raw PCM
          const buffer = await ctx.decodeAudioData(audioData); 
          // Note: In strict browsers, decodeAudioData needs headers (WAV/MP3). 
          // Our helper speakText returns raw PCM or WAV? 
          // The Gemini TTS API returns WAV container by default usually unless raw specified, but 'inlineData' is raw bytes.
          // The previous prompt instruction implementation manual decodeAudioData is better for raw PCM.
          // However, Gemini 2.5 TTS output format depends. 
          // Let's assume the provided `speakText` returns an ArrayBuffer that might be PCM.
          // If it's standard `generateContent` with audio modality, it often wraps in a container.
          // IF it fails, we might need the manual decoder from audioUtils. 
          // Let's switch to manual decodeAudioData from audioUtils just to be safe if it is raw PCM.
          
          /* Using the manual decoder from audioUtils which handles Int16 PCM */
          // Import dynamically to avoid circular dependency issues if any, or just copy logic? 
          // We will trust the browser decodeAudioData first, if it fails, catch and try raw?
          // Actually, let's rely on the fact that Gemini TTS usually sends a WAV header if not streaming via Live API.
          // BUT, the Prompt "Generate Speech" example uses manual decoding. Let's stick to that pattern for safety.
          
          const { decodeAudioData: manualDecode } = await import('../services/audioUtils');
          
          let audioBuffer: AudioBuffer;
          try {
             audioBuffer = await ctx.decodeAudioData(audioData.slice(0)); // Try native first (if WAV)
          } catch (e) {
             // Fallback to manual PCM decode
             audioBuffer = await manualDecode(new Uint8Array(audioData), 24000);
          }
    
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.start();
          source.onended = () => setIsPlayingAudio(false);
        } catch (error) {
          console.error("Audio playback error", error);
          setIsPlayingAudio(false);
        }
      };
    
      const playQuestionAudio = () => {
        if (!currentQuestion) return;
        const text = `${currentQuestion.question} Is it... ${currentQuestion.options.join(', or ')}?`;
        playAudio(text);
      };
    
      const handleOptionSelect = (option: string) => {
        if (isAnswered) return;
        setSelectedOption(option);
        setIsAnswered(true);
    
        const isCorrect = option === currentQuestion.correctAnswer || 
                          (option.length === 1 && currentQuestion.correctAnswer.startsWith(option)); // Handle 'A' vs 'A. Answer'
        
        let responseText = "";
        if (isCorrect) {
          setScore(s => s + 1);
          responseText = `That is correct! ${currentQuestion.explanation}`;
          setFeedback("Correct!");
        } else {
          responseText = `Sorry, that's wrong. The answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`;
          setFeedback("Incorrect.");
        }
        playAudio(responseText);
      };
    
      const handleNext = () => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsAnswered(false);
          setSelectedOption(null);
          setFeedback('');
        } else {
          onComplete(score);
        }
      };
    
      return (
        <div className="max-w-2xl mx-auto p-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Question {currentIndex + 1}/{questions.length}</span>
            <span className="text-sm font-bold text-purple-400">Score: {score}</span>
          </div>
    
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{currentQuestion.question}</h2>
            <button 
              onClick={playQuestionAudio}
              disabled={isPlayingAudio}
              className={`flex items-center space-x-2 text-sm ${isPlayingAudio ? 'text-purple-400' : 'text-slate-400 hover:text-white'} transition-colors`}
            >
              <Volume2 size={16} />
              <span>{isPlayingAudio ? 'Speaking...' : 'Replay Question'}</span>
            </button>
          </div>
    
          <div className="grid grid-cols-1 gap-3 mb-8">
            {currentQuestion.options.map((option, idx) => {
              let btnClass = "p-4 rounded-xl text-left font-medium transition-all duration-200 border-2 ";
              if (isAnswered) {
                if (option === currentQuestion.correctAnswer) {
                  btnClass += "bg-green-900/50 border-green-500 text-green-100";
                } else if (selectedOption === option) {
                  btnClass += "bg-red-900/50 border-red-500 text-red-100";
                } else {
                  btnClass += "bg-slate-700/50 border-transparent text-slate-400 opacity-50";
                }
              } else {
                btnClass += "bg-slate-700 border-transparent hover:bg-slate-600 hover:border-purple-500 text-white";
              }
    
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  disabled={isAnswered}
                  className={btnClass}
                >
                  {option}
                </button>
              );
            })}
          </div>
    
          {isAnswered && (
            <div className="animate-fade-in-up">
              <div className="bg-slate-900/50 p-4 rounded-xl mb-4 border-l-4 border-purple-500">
                <p className="text-purple-200 text-sm">{currentQuestion.explanation}</p>
              </div>
              <button
                onClick={handleNext}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors"
              >
                <span>{currentIndex === questions.length - 1 ? 'Finish Game' : 'Next Question'}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      );
    };
    
    export default StandardGame;