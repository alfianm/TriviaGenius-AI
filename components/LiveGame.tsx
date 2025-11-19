import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Personality, TriviaQuestion } from '../types';
import { createPCM16Blob, decodeAudioData, arrayBufferToBase64 } from '../services/audioUtils';
import AudioVisualizer from './AudioVisualizer';
import { Mic, MicOff, XCircle } from 'lucide-react';

interface LiveGameProps {
  questions: TriviaQuestion[];
  personality: Personality;
  onEndGame: () => void;
}

const LiveGame: React.FC<LiveGameProps> = ({ questions, personality, onEndGame }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error' | 'closed'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Session Refs
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    let isActive = true;

    const startSession = async () => {
      try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("No API Key");

        const ai = new GoogleGenAI({ apiKey });
        
        // Prepare Contexts
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        // Setup Audio Input
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
        inputAnalyserRef.current = inputContextRef.current.createAnalyser();
        source.connect(inputAnalyserRef.current);

        // Script Processor for PCM streaming
        const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const { base64 } = createPCM16Blob(inputData);
          
          if (sessionRef.current) {
             sessionRef.current.then((session: any) => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64
                  }
                });
             });
          }
        };

        source.connect(processor);
        processor.connect(inputContextRef.current.destination);

        // Output Analyser
        outputAnalyserRef.current = outputContextRef.current.createAnalyser();
        outputAnalyserRef.current.connect(outputContextRef.current.destination);

        // System Instruction Construction
        const systemInstruction = `
          You are a ${personality} Trivia Host. 
          Your goal is to quiz the user with the following specific questions.
          
          GAME DATA:
          ${JSON.stringify(questions)}
          
          INSTRUCTIONS:
          1. Introduce yourself briefly and the topic.
          2. Ask the questions one by one.
          3. Wait for the user's answer.
          4. Determine if the answer is correct based on the provided 'correctAnswer'.
          5. Give feedback (Sassy, Formal, etc. based on persona) and read the explanation briefly.
          6. Move to the next question.
          7. After the last question, give them a final score (count how many they got right) and say goodbye.
          
          Do NOT hallucinate new questions. Stick to the list provided.
          Keep your responses concise and conversational.
        `;

        // Connect to Gemini Live
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
          },
          callbacks: {
            onopen: () => {
              if (isActive) setStatus('active');
              console.log("Live Session Connected");
            },
            onmessage: async (msg: LiveServerMessage) => {
              // Handle Audio Output
              const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio && outputContextRef.current && outputAnalyserRef.current) {
                try {
                  const ctx = outputContextRef.current;
                  const audioBuffer = await decodeAudioData(
                     new Uint8Array(base64ToArrayBuffer(base64Audio)), 
                     24000
                  );
                  
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputAnalyserRef.current);
                  
                  // Time scheduling for smooth playback
                  const currentTime = ctx.currentTime;
                  if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                  }
                  
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (err) {
                  console.error("Audio decoding error", err);
                }
              }

              // Handle Interruptions
              if (msg.serverContent?.interrupted) {
                console.log("Model interrupted");
                sourcesRef.current.forEach(s => {
                  try { s.stop(); } catch (e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              if (isActive) setStatus('closed');
            },
            onerror: (err) => {
              console.error("Live Session Error", err);
              if (isActive) setStatus('error');
            }
          }
        });
        
        sessionRef.current = sessionPromise;
      } catch (e) {
        console.error("Setup failed", e);
        setStatus('error');
      }
    };

    startSession();

    return () => {
      isActive = false;
      // Cleanup
      if (sessionRef.current) {
        // session.close() isn't directly exposed on the promise wrapper usually, 
        // but the library handles cleanup on unmount mostly or we just stop sending audio.
        // The @google/genai library examples use session.close() but the promise resolves to session.
        sessionRef.current.then((s: any) => s.close && s.close());
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      inputContextRef.current?.close();
      outputContextRef.current?.close();
    };
  }, [questions, personality]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Helper function to convert base64 to buffer for the visualizer/decoder
  function base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 space-y-8">
      <div className="relative w-full max-w-md aspect-square rounded-full bg-slate-800 flex items-center justify-center border-4 border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
         {/* Visualizer for Output (AI Voice) */}
         <div className="absolute inset-0 flex items-center justify-center opacity-70">
             {status === 'active' && (
                 <AudioVisualizer analyser={outputAnalyserRef.current} isActive={true} color="#d8b4fe" />
             )}
         </div>

         {/* Avatar Icon / Status */}
         <div className="z-10 text-center space-y-2">
             <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all duration-500 ${status === 'active' ? 'bg-purple-600 shadow-lg shadow-purple-500' : 'bg-slate-600'}`}>
                 {status === 'connecting' && <span className="animate-pulse text-white text-3xl">...</span>}
                 {status === 'active' && <span className="text-white text-4xl">🎙️</span>}
                 {status === 'error' && <span className="text-white text-4xl">⚠️</span>}
             </div>
             <h3 className="text-xl font-bold text-white">{personality} Host</h3>
             <p className="text-sm text-purple-300 uppercase tracking-wider font-bold">{status}</p>
         </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-6">
        <button 
          onClick={toggleMute}
          className={`p-6 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400 border-2 border-red-500' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
        >
          {isMuted ? <MicOff size={32} /> : <Mic size={32} />}
        </button>

        <button 
          onClick={onEndGame}
          className="p-6 rounded-full bg-slate-700 text-white hover:bg-red-600/80 transition-all hover:scale-105"
        >
          <XCircle size={32} />
        </button>
      </div>

      <div className="max-w-md text-center text-slate-400 text-sm">
        <p>Speak clearly to answer the questions.</p>
        <p className="mt-2 text-xs opacity-50">AI can make mistakes. Questions grounded by Google Search.</p>
      </div>
    </div>
  );
};

export default LiveGame;