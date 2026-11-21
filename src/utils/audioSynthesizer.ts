import { Beat } from '../types/choreo';

export class AudioEngineCore {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isSynthetic = true;
  private currentAudioBlob: Blob | null = null;
  private loadVersion = 0;
  private audioUrl: string | null = null;
  private currentAudioFileName = '';

  constructor() {
    // AudioContext se inicializa en la primera interacción del usuario para cumplir políticas del navegador
  }

  public getCurrentAudioBlob(): Blob | null {
    return this.currentAudioBlob;
  }

  public getCurrentAudioFileName(): string {
    return this.currentAudioFileName;
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Reproduce el sonido de clic de metrónomo sintetizado en tiempo real
   * countNumber 1: Tono agudo y penetrante (1650 Hz) + Sub Kick
   * countNumber 2..8: Tono regular (1000 Hz)
   */
  public playBeatClick(countNumber: number, volume = 0.35) {
    try {
      const ctx = this.getContext();
      const t = ctx.currentTime;

      // Oscilador de clic primario
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const isFirstBeat = countNumber === 1;
      osc.type = isFirstBeat ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFirstBeat ? 1650 : 1050, t);

      gain.gain.setValueAtTime(volume * (isFirstBeat ? 1.0 : 0.6), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);

      // Si es el tiempo 1 o 5, agregamos un golpe de bombo sintético (Kick) para afianzar el ritmo
      if (isFirstBeat || countNumber === 5) {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();

        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(isFirstBeat ? 150 : 120, t);
        kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

        kickGain.gain.setValueAtTime(volume * 0.7, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);

        kickOsc.start(t);
        kickOsc.stop(t + 0.16);
      }
    } catch {
      // AudioContext aún bloqueado por el navegador
    }
  }

  /**
   * Configura un archivo de audio real cargado por el usuario
   */
  public async loadAudioFile(file: File | Blob, customName?: string): Promise<{
    durationMs: number;
    peaks: number[];
    audioUrl: string;
  }> {
    const version = ++this.loadVersion;
    const ctx = this.getContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    if (version !== this.loadVersion) throw new DOMException('Carga de audio reemplazada', 'AbortError');
    this.releaseAudio();
    const durationMs = Math.round(audioBuffer.duration * 1000);
    const peaks = this.extractWaveformPeaks(audioBuffer, 1200);
    const audioUrl = URL.createObjectURL(file);

    this.isSynthetic = false;
    this.currentAudioBlob = file;
    this.currentAudioFileName = customName || (file instanceof File ? file.name : 'audio_cargado.mp3');

    this.audioUrl = audioUrl;
    this.audioElement = new Audio(audioUrl);
    this.audioElement.preload = 'auto';

    return {
      durationMs,
      peaks,
      audioUrl,
    };
  }

  /**
   * Extrae los picos de amplitud normalizados para dibujar la onda en el canvas
   */
  public extractWaveformPeaks(buffer: AudioBuffer, numPeaks = 1000): number[] {
    const channelData = buffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / numPeaks) || 1;
    const peaks: number[] = [];
    let max = 0.001;

    for (let i = 0; i < numPeaks; i++) {
      const start = i * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      let localMax = 0;
      for (let j = start; j < end; j += 4) {
        const val = Math.abs(channelData[j]);
        if (val > localMax) localMax = val;
      }
      peaks.push(localMax);
      if (localMax > max) max = localMax;
    }

    // Normalizar a rango 0.0 - 1.0
    return peaks.map((p) => Math.min(1, p / max));
  }

  /**
   * Genera picos de onda sintéticos para una pista de demostración a 120 BPM
   */
  public generateSyntheticPeaks(durationMs: number, beats: Beat[], numPeaks = 1000): number[] {
    const peaks: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      const t = (i / numPeaks) * durationMs;
      let amp = 0.08 + 0.04 * Math.sin(i * 0.15);

      for (const b of beats) {
        const diff = t - b.timestampMs;
        if (diff >= 0 && diff < 220) {
          const mult = b.countNumber === 1 ? 1.0 : b.countNumber % 2 === 1 ? 0.75 : 0.5;
          const decay = Math.exp(-diff / 65);
          amp = Math.max(amp, mult * decay);
        }
      }
      peaks.push(Math.min(1, amp));
    }
    return peaks;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  public isUsingSyntheticAudio(): boolean {
    return this.isSynthetic;
  }

  public setSyntheticMode(synthetic: boolean) {
    this.isSynthetic = synthetic;
    if (synthetic) {
      this.loadVersion++;
      this.releaseAudio();
      this.currentAudioBlob = null;
      this.currentAudioFileName = '';
    }
  }

  private releaseAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
      this.audioElement = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }
}

/**
 * Generador automático de conteos de 8 tiempos a partir de un BPM dado
 */
export function generateBeatsForDuration(durationMs: number, bpm = 120): Beat[] {
  const msPerBeat = (60 / bpm) * 1000;
  const beats: Beat[] = [];
  const totalBeats = Math.floor(durationMs / msPerBeat);

  for (let i = 0; i < totalBeats; i++) {
    const phraseIndex = Math.floor(i / 8) + 1;
    const countNumber = (i % 8) + 1;
    beats.push({
      id: 'beat_' + i + '_' + Math.random().toString(36).slice(2, 6),
      timestampMs: Math.round(i * msPerBeat),
      phraseIndex,
      countNumber,
    });
  }

  return beats;
}

export const globalAudioEngine = new AudioEngineCore();
