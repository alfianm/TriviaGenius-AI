/**
 * Audio processing utilities for Gemini Live API and TTS.
 */

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  // PCM data from Gemini is often Int16 (16-bit signed integer)
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Convert Int16 to Float32 [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export function createPCM16Blob(float32Data: Float32Array, sampleRate: number = 16000): { blob: Blob, base64: string } {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values
    let s = Math.max(-1, Math.min(1, float32Data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8 = new Uint8Array(int16.buffer);
  const base64 = arrayBufferToBase64(uint8.buffer);
  
  // Typically we just need the base64 for the API, but here is a blob if needed
  const blob = new Blob([int16], { type: 'audio/pcm' }); 
  
  return { blob, base64 };
}

/**
 * Resamples audio buffer to target sample rate.
 * Simple linear interpolation for downsampling (sufficient for speech).
 */
export async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<Float32Array> {
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    (audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}
