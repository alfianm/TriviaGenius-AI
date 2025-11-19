import { GoogleGenAI, Modality } from "@google/genai";
import { TriviaQuestion, Personality, GroundingChunk } from "../types";
import { base64ToArrayBuffer } from "./audioUtils";

// Helper to get a safe client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates trivia questions using Gemini 2.5 Flash with Google Search Grounding.
 */
export const generateTriviaQuestions = async (
  topic: string,
  difficulty: string
): Promise<{ questions: TriviaQuestion[]; sources: string[] }> => {
  const ai = getClient();
  
  const prompt = `Generate 5 ${difficulty} trivia questions about "${topic}". 
  Return the response in a strict JSON format. 
  The JSON should be an array of objects.
  Each question object must have 'question', 'options' (array of 4 strings), 'correctAnswer' (the full text of the correct option), and 'explanation'.
  Ensure the facts are accurate. Use Google Search to verify recent or obscure facts if needed.
  Do not use markdown formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      // Per guidelines, do not use responseMimeType or responseSchema with googleSearch
    }
  });

  // Extract grounding metadata
  const sources: string[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
  if (chunks) {
    chunks.forEach(chunk => {
      if (chunk.web?.uri) {
        sources.push(chunk.web.uri);
      }
    });
  }

  // Parse JSON
  let text = response.text;
  if (!text) throw new Error("No content generated");
  
  // Sanitize potential markdown wrapping
  text = text.replace(/^```json/gm, '').replace(/^```/gm, '').trim();
  
  let questions: TriviaQuestion[] = [];
  try {
    questions = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse trivia JSON", e);
    throw new Error("Failed to generate valid trivia data.");
  }

  return { questions, sources };
};

/**
 * Text-to-Speech using Gemini 2.5 Flash TTS
 */
export const speakText = async (text: string, personality: Personality): Promise<ArrayBuffer> => {
  const ai = getClient();
  
  // Map personality to voice names
  let voiceName = 'Kore'; // Default
  switch (personality) {
    case Personality.SASSY: voiceName = 'Puck'; break;
    case Personality.PROFESSOR: voiceName = 'Fenrir'; break;
    case Personality.ROBOT: voiceName = 'Charon'; break; // Deeper, flatter
    case Personality.HYPE: voiceName = 'Aoede'; break; // Energetic (if available, else Kore)
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: {
      parts: [{ text }]
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio data returned");
  }

  return base64ToArrayBuffer(base64Audio);
};