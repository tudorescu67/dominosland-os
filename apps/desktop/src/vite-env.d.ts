/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
/// <reference types="vite/client" />

type SecureKey = 'authToken' | 'streamDestinations';

interface EncoderInfo {
  id: string;
  label: string;
  available: boolean;
}

interface StreamDestination {
  id: string;
  name: string;
  url: string;
  key: string;
  enabled: boolean;
}

interface CaptureOptions {
  encoder?: string;
  fps?: number;
  height?: number;
  bitrateKbps?: number;
  audio?: string[];
}

interface StreamStatus {
  live: boolean;
  startedAt: number | null;
  uptimeSec: number;
  destinations: string[];
  encoder?: string | null;
  log: string[];
}

interface ReplayStatus {
  active: boolean;
  seconds: number;
  lastClip: string | null;
  log: string[];
  clipsDir: string;
}

interface ClipInfo {
  name: string;
  path: string;
  size: number;
  createdAt: number;
}

interface NetworkTest {
  host: string;
  pingMs: number | null;
  jitterMs: number | null;
  lossPercent: number;
  samples: Array<number | null>;
}

interface SystemInfo {
  os: string;
  cpu: string;
  cores: number;
  memoryGb: number;
  freeMemoryGb: number;
  gpus: string[];
  encoders: { encoders: EncoderInfo[]; recommended: string };
}

interface Window {
  dominosDesktop?: {
    platform: string;
    versions: Record<string, string>;
    secureStore: {
      get(key: SecureKey): Promise<string | null>;
      set(key: SecureKey, value: string): Promise<boolean>;
      delete(key: SecureKey): Promise<boolean>;
    };
    launcher?: {
      open(url: string): Promise<boolean>;
      power(action: 'status' | 'boost' | 'restore'): Promise<{ supported: boolean; active: boolean; reason?: string }>;
      saveText(name: string, content: string): Promise<{ saved: boolean; path?: string }>;
    };
    media?: {
      capabilities(): Promise<{ encoders: { encoders: EncoderInfo[]; recommended: string }; audio: string[] }>;
      startStream(options: CaptureOptions & { destinations: StreamDestination[] }): Promise<StreamStatus>;
      stopStream(): Promise<StreamStatus>;
      streamStatus(): Promise<StreamStatus>;
      startReplay(options: CaptureOptions & { seconds?: number }): Promise<ReplayStatus>;
      stopReplay(): Promise<ReplayStatus>;
      replayStatus(): Promise<ReplayStatus>;
      saveClip(): Promise<{ path: string; seconds: number }>;
      listClips(): Promise<ClipInfo[]>;
      openClipsFolder(): Promise<string>;
      showClip(file: string): Promise<boolean>;
      onClipSaved(callback: (clip: { path: string; seconds: number }) => void): () => void;
    };
    diagnostics?: {
      network(host: string): Promise<NetworkTest>;
      system(): Promise<SystemInfo>;
    };
    booster?: {
      priority(level: 'high' | 'normal'): Promise<{ supported: boolean; boosted: string[] }>;
    };
    overlay?: {
      toggle(): Promise<boolean>;
    };
    downloads: {
      saveFromApi(url: string, suggestedName: string): Promise<{ saved: boolean; path?: string }>;
    };
  };
}
