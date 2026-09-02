'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { compensatedGain, FLAT_PROFILE } from '@/lib/eq';
import { EQ_BANDS, type EqProfile } from '@/lib/types';

type Output = 'A' | 'B' | 'Original';

interface EqChain {
  filters: BiquadFilterNode[];
  headroomGain: GainNode;
  outputGain: GainNode;
}

function createDemoBuffer(context: AudioContext): AudioBuffer {
  const duration = 16;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(2, duration * sampleRate, sampleRate);
  let seed = 94721;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const chords = [
    [110, 164.81, 220, 329.63],
    [98, 146.83, 196, 293.66],
    [130.81, 196, 261.63, 392],
    [87.31, 130.81, 174.61, 261.63],
  ];
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const time = index / sampleRate;
      const chord = chords[Math.floor(time / 4) % chords.length];
      const beat = time % 0.5;
      const kick = Math.sin(2 * Math.PI * (56 - beat * 30) * beat) * Math.exp(-beat * 16);
      const hatPhase = time % 0.25;
      const hat = (random() * 2 - 1) * Math.exp(-hatPhase * 42);
      const pad = chord.reduce((sum, frequency, voice) => {
        const panPhase = channel === 0 ? voice * 0.17 : voice * 0.17 + 0.23;
        return sum + Math.sin(2 * Math.PI * frequency * time + panPhase) / chord.length;
      }, 0);
      const melodyFrequency = [440, 493.88, 523.25, 392][Math.floor(time * 2) % 4];
      const melody = Math.sin(2 * Math.PI * melodyFrequency * time + channel * 0.2) * 0.07;
      data[index] = Math.tanh(pad * 0.28 + kick * 0.26 + hat * 0.025 + melody) * 0.68;
    }
  }
  return buffer;
}

export function useAudioEngine() {
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chainsRef = useRef<Record<Output, EqChain> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<Output>('A');
  const [error, setError] = useState<string | null>(null);

  const setChainProfile = useCallback((chain: EqChain, profile: EqProfile) => {
    const context = contextRef.current;
    if (!context) return;
    EQ_BANDS.forEach((band, index) => {
      chain.filters[index].gain.setTargetAtTime(profile[band.key], context.currentTime, 0.02);
    });
    chain.headroomGain.gain.setTargetAtTime(compensatedGain(profile), context.currentTime, 0.025);
  }, []);

  const ensureContext = useCallback(() => {
    if (contextRef.current && chainsRef.current) return contextRef.current;
    const context = new AudioContext({ latencyHint: 'interactive' });
    contextRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    analyser.connect(context.destination);
    const createChain = (): EqChain => {
      const filters = EQ_BANDS.map((band) => {
        const filter = context.createBiquadFilter();
        filter.type = band.filter;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.filter === 'peaking' ? 0.9 : 0.7;
        return filter;
      });
      const headroomGain = context.createGain();
      const outputGain = context.createGain();
      filters.forEach((filter, index) => {
        if (index < filters.length - 1) filter.connect(filters[index + 1]);
      });
      filters.at(-1)?.connect(headroomGain);
      headroomGain.connect(outputGain);
      outputGain.connect(analyser);
      setChainProfile({ filters, headroomGain, outputGain }, FLAT_PROFILE);
      return { filters, headroomGain, outputGain };
    };
    const chains = { A: createChain(), B: createChain(), Original: createChain() };
    chains.A.outputGain.gain.value = 1;
    chains.B.outputGain.gain.value = 0;
    chains.Original.outputGain.gain.value = 0;
    chainsRef.current = chains;
    analyserRef.current = analyser;
    return context;
  }, [setChainProfile]);

  const attachBuffer = useCallback(
    (buffer: AudioBuffer) => {
      const context = ensureContext();
      const chains = chainsRef.current;
      if (!chains) return;
      sourceRef.current?.stop();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(chains.A.filters[0]);
      source.connect(chains.B.filters[0]);
      source.connect(chains.Original.filters[0]);
      source.start(0);
      sourceRef.current = source;
      setError(null);
    },
    [ensureContext],
  );

  const loadDemo = useCallback(() => {
    try {
      const context = ensureContext();
      attachBuffer(createDemoBuffer(context));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create demo audio');
      throw caught;
    }
  }, [attachBuffer, ensureContext]);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        const context = ensureContext();
        const decoded = await context.decodeAudioData(await file.arrayBuffer());
        attachBuffer(decoded);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'This audio file could not be decoded';
        setError(message);
        throw new Error(message);
      }
    },
    [attachBuffer, ensureContext],
  );

  const unlock = useCallback(async () => {
    const context = ensureContext();
    await context.resume();
    setIsUnlocked(true);
    setIsPlaying(true);
  }, [ensureContext]);

  const togglePlayback = useCallback(async () => {
    const context = ensureContext();
    if (context.state === 'running') {
      await context.suspend();
      setIsPlaying(false);
    } else {
      await context.resume();
      setIsUnlocked(true);
      setIsPlaying(true);
    }
  }, [ensureContext]);

  const selectOutput = useCallback(
    (output: Output) => {
      const context = ensureContext();
      const chains = chainsRef.current;
      if (!chains) return;
      (Object.keys(chains) as Output[]).forEach((name) => {
        const target = name === output ? 1 : 0;
        chains[name].outputGain.gain.setTargetAtTime(target, context.currentTime, 0.025);
      });
      setSelectedOutput(output);
    },
    [ensureContext],
  );

  const applyProfiles = useCallback(
    (profileA: EqProfile, profileB: EqProfile) => {
      const chains = chainsRef.current;
      if (!chains) return;
      setChainProfile(chains.A, profileA);
      setChainProfile(chains.B, profileB);
      setChainProfile(chains.Original, FLAT_PROFILE);
      selectOutput('A');
    },
    [selectOutput, setChainProfile],
  );

  const applyFinalProfile = useCallback(
    (profile: EqProfile) => {
      const chains = chainsRef.current;
      if (!chains) return;
      setChainProfile(chains.A, profile);
      setChainProfile(chains.Original, FLAT_PROFILE);
      selectOutput('A');
    },
    [selectOutput, setChainProfile],
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (canvas && analyser) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const values = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(values);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#c7ff4a';
          const barWidth = width / values.length;
          values.forEach((value, index) => {
            const barHeight = Math.max(2 * ratio, (value / 255) * height * 0.9);
            ctx.globalAlpha = 0.3 + (value / 255) * 0.7;
            ctx.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - ratio), barHeight);
          });
          ctx.globalAlpha = 1;
        }
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    if (!prefersReducedMotion) animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      try {
        sourceRef.current?.stop();
      } catch {
        // A source can already be stopped during hot-reload cleanup.
      }
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
    };
  }, []);

  return {
    canvasRef,
    isPlaying,
    isUnlocked,
    selectedOutput,
    error,
    loadDemo,
    loadFile,
    unlock,
    togglePlayback,
    selectOutput,
    applyProfiles,
    applyFinalProfile,
  };
}
