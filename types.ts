export enum Personality {
  SASSY = 'Sassy & Sarcastic',
  PROFESSOR = 'Formal Professor',
  ROBOT = 'Hyper-Logical Robot',
  HYPE = 'High Energy Hype-Man'
}

export enum GameMode {
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  STANDARD = 'STANDARD',
  LIVE = 'LIVE',
  RESULTS = 'RESULTS'
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctAnswer: string; // letter 'A', 'B', 'C', 'D' or the text
  explanation: string;
}

export interface GameConfig {
  topic: string;
  personality: Personality;
  mode: 'standard' | 'live';
}

// Helper type for Google Search grounding chunks
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}
