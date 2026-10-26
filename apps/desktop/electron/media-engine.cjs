/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Motorul media al launcher-ului (proces principal Electron):
//  - detectarea encoderelor hardware (NVENC / AMF / QuickSync), testate efectiv, nu doar listate;
//  - multi-stream: o singura codare trimisa simultan pe mai multe RTMP (muxer-ul "tee" din FFmpeg);
//  - replay buffer ("ultimele 30 de secunde"), salvat cu o tasta, stil ShadowPlay;
//  - diagnostic retea (ping / jitter) si sistem.
// Nimic nu se injecteaza in jocuri: captura e a desktop-ului (gdigrab), ca in OBS.
const { app, screen } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

function ffmpegPath() {
  // In aplicatia impachetata binarul sta in app.asar.unpacked (vezi "asarUnpack" din package.json).
  const bundled = require('ffmpeg-static');
  return String(bundled || 'ffmpeg').replace('app.asar', 'app.asar.unpacked');
}

function run(args, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    execFile(ffmpegPath(), args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

// ─── Encodere si dispozitive ────────────────────────────────────────────────
const ENCODERS = [
  { id: 'h264_nvenc', label: 'NVIDIA NVENC', args: ['-preset', 'p4', '-tune', 'll', '-rc', 'cbr'] },
  { id: 'h264_amf', label: 'AMD AMF', args: ['-quality', 'speed', '-rc', 'cbr'] },
  { id: 'h264_qsv', label: 'Intel QuickSync', args: ['-preset', 'veryfast'] },
  { id: 'libx264', label: 'Procesor (x264)', args: ['-preset', 'veryfast', '-tune', 'zerolatency'] },
];
let encoderCache = null;

/** Testeaza fiecare encoder cu o codare reala de o secunda; primul care merge e recomandat. */
async function detectEncoders() {
  if (encoderCache) return encoderCache;
  const results = [];
  for (const encoder of ENCODERS) {
    const test = await run(['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=1280x720:d=1', '-c:v', encoder.id, '-f', 'null', '-'], 15_000);
    results.push({ id: encoder.id, label: encoder.label, available: test.ok });
  }
  encoderCache = { encoders: results, recommended: results.find((item) => item.available)?.id || 'libx264' };
  return encoderCache;
}

async function listAudioDevices() {
  if (process.platform !== 'win32') return [];
  const { stderr } = await run(['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], 10_000);
  return [...stderr.matchAll(/"([^"]+)" \(audio\)/g)].map((match) => match[1]).filter((name, index, all) => all.indexOf(name) === index);
}

function cleanDevice(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  if (/[";\r\n]/.test(value) || value.length > 120) throw new Error('Dispozitiv audio invalid.');
  return value;
}

/** Monitorul principal in pixeli fizici (gdigrab lucreaza in pixeli reali, Electron in DIP). */
function primaryRegion() {
  const display = screen.getPrimaryDisplay();
  const factor = display.scaleFactor || 1;
  const even = (value) => Math.max(2, Math.round((value * factor) / 2) * 2);
  return { x: Math.round(display.bounds.x * factor), y: Math.round(display.bounds.y * factor), width: even(display.bounds.width), height: even(display.bounds.height) };
}

/**
 * Argumentele de captura: doar monitorul principal (desktopul cu mai multe monitoare depaseste
 * limita de 4096 px a encoderelor hardware) + pana la doua surse audio (desktop si microfon), mixate.
 */
function captureArgs({ fps = 60, audio = [] }) {
  const devices = audio.map(cleanDevice).filter(Boolean).slice(0, 2);
  const args = ['-hide_banner', '-loglevel', 'warning', '-thread_queue_size', '1024'];
  if (process.platform === 'win32') {
    const region = primaryRegion();
    args.push('-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', '1',
      '-offset_x', String(region.x), '-offset_y', String(region.y), '-video_size', `${region.width}x${region.height}`, '-i', 'desktop');
  } else {
    args.push('-f', 'x11grab', '-framerate', String(fps), '-i', process.env.DISPLAY || ':0.0');
  }
  for (const device of devices) args.push('-thread_queue_size', '1024', '-f', 'dshow', '-i', `audio=${device}`);
  const mix = devices.length === 2 ? ['-filter_complex', '[1:a][2:a]amix=inputs=2:duration=longest[aout]', '-map', '0:v', '-map', '[aout]'] : devices.length === 1 ? ['-map', '0:v', '-map', '1:a'] : ['-map', '0:v'];
  return { args, mix, hasAudio: devices.length > 0 };
}

function encodeArgs(encoderId, { bitrateKbps, fps, height }) {
  const encoder = ENCODERS.find((item) => item.id === encoderId) || ENCODERS[ENCODERS.length - 1];
  const kbps = Math.min(Math.max(Number(bitrateKbps) || 6000, 1000), 20000);
  // Mereu redimensionat (implicit 1080p), cu latimea para: encoderele hardware refuza altfel.
  const target = Number(height) >= 360 && Number(height) <= 2160 ? Number(height) : 1080;
  const scale = ['-vf', `scale=-2:${target}:flags=bicubic`];
  return [
    ...scale,
    '-c:v', encoder.id, ...encoder.args,
    '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`,
    '-g', String(Math.max(1, Math.round(Number(fps) || 60) * 2)), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  ];
}

// ─── Multi-stream ───────────────────────────────────────────────────────────
// Server RTMP + cheie; "?=&%" apar in cheile unor platforme (TikTok). "|" si "[]" raman interzise (tee).
const RTMP = /^rtmps?:\/\/[a-z0-9.-]+(:\d{2,5})?\/[\w./?=&%-]{1,300}$/i;
let streamProc = null;
let streamState = { live: false, startedAt: null, destinations: [], log: [] };

function remember(state, line) {
  const text = String(line || '').trim();
  if (!text) return;
  state.log.push(`${new Date().toLocaleTimeString('ro-RO')} ${text.slice(0, 300)}`);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

/**
 * Porneste FFmpeg si asteapta 4 secunde: daca procesul moare (encoder indisponibil, placa video
 * dedicata adormita pe laptop), reincearca automat cu urmatorul encoder care a trecut testul.
 */
async function spawnWithFallback(buildArgs, preferred, state) {
  const { encoders, recommended } = await detectEncoders();
  const order = [preferred || recommended, ...encoders.filter((item) => item.available).map((item) => item.id), 'libx264']
    .filter((id, index, all) => id && all.indexOf(id) === index);
  for (const encoder of order) {
    const proc = spawn(ffmpegPath(), buildArgs(encoder), { windowsHide: true });
    proc.stderr.on('data', (chunk) => String(chunk).split(/\r?\n/).forEach((line) => remember(state, line)));
    const died = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 4000);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!died) return { proc, encoder };
    remember(state, `Encoderul ${encoder} nu a pornit; incerc urmatorul.`);
  }
  throw new Error('Niciun encoder video nu a putut porni (vezi jurnalul).');
}

/**
 * Porneste transmisia pe toate destinatiile (YouTube, Twitch, Kick, TikTok...) cu o singura codare.
 * "onfail=ignore": daca o platforma cade, celelalte continua.
 */
async function startStream(options) {
  if (streamProc) throw new Error('Transmisia ruleaza deja.');
  const destinations = (options.destinations || []).filter((item) => item && item.enabled !== false).slice(0, 6);
  if (!destinations.length) throw new Error('Adauga cel putin o destinatie.');
  const outputs = destinations.map((item) => {
    const url = `${String(item.url || '').replace(/\/+$/, '')}/${String(item.key || '').trim()}`;
    if (!RTMP.test(url) || /[|[\]]/.test(url)) throw new Error(`Adresa RTMP invalida pentru ${item.name || 'destinatie'}.`);
    return `[f=flv:onfail=ignore]${url}`;
  });
  const capture = captureArgs({ fps: options.fps, audio: options.audio || [] });
  const build = (encoder) => {
    const args = [...capture.args, ...capture.mix, ...encodeArgs(encoder, options), '-f', 'tee', '-flags', '+global_header', outputs.join('|')];
    if (!capture.hasAudio) args.splice(args.indexOf('-c:a'), 6, '-an');
    return args;
  };

  streamState = { live: true, startedAt: Date.now(), destinations: destinations.map((item) => item.name || 'RTMP'), encoder: null, log: [] };
  try {
    const started = await spawnWithFallback(build, options.encoder, streamState);
    streamProc = started.proc;
    streamState.encoder = started.encoder;
  } catch (error) {
    streamState.live = false;
    throw error;
  }
  streamProc.on('exit', (code) => {
    remember(streamState, code === 0 || code === 255 ? 'Transmisie oprita.' : `FFmpeg s-a oprit (cod ${code}).`);
    streamState.live = false;
    streamProc = null;
  });
  return streamStatus();
}

function stopProcess(proc) {
  if (!proc) return;
  try {
    proc.stdin.write('q');
  } catch {
    /* procesul s-a inchis deja */
  }
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch { /* deja oprit */ }
  }, 4000).unref();
}

function stopStream() {
  stopProcess(streamProc);
  return streamStatus();
}

function streamStatus() {
  return { ...streamState, uptimeSec: streamState.live && streamState.startedAt ? Math.round((Date.now() - streamState.startedAt) / 1000) : 0, log: streamState.log.slice(-25) };
}

// ─── Replay buffer (clipuri) ────────────────────────────────────────────────
const SEGMENT_SEC = 5;
let replayProc = null;
let replayState = { active: false, seconds: 30, dir: null, log: [], lastClip: null };

function clipsDir() {
  const dir = path.join(app.getPath('videos'), 'DominosLand Clips');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Inregistreaza continuu in segmente de 5 s rotite in folderul temporar (nu umple discul). */
async function startReplay(options = {}) {
  if (replayProc) return replayStatus();
  const seconds = Math.min(Math.max(Number(options.seconds) || 30, 10), 120);
  const segments = Math.ceil(seconds / SEGMENT_SEC) + 1;
  const dir = path.join(app.getPath('temp'), 'dominos-replay');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const capture = captureArgs({ fps: options.fps || 60, audio: options.audio || [] });
  const build = (encoder) => {
    const args = [...capture.args, ...capture.mix, ...encodeArgs(encoder, { bitrateKbps: options.bitrateKbps || 12000, fps: options.fps || 60, height: options.height }),
      '-f', 'segment', '-segment_time', String(SEGMENT_SEC), '-segment_wrap', String(segments), '-reset_timestamps', '1', path.join(dir, 'seg%03d.ts')];
    if (!capture.hasAudio) args.splice(args.indexOf('-c:a'), 6, '-an');
    return args;
  };
  replayState = { active: true, seconds, dir, log: [], lastClip: replayState.lastClip };
  try {
    replayProc = (await spawnWithFallback(build, options.encoder, replayState)).proc;
  } catch (error) {
    replayState.active = false;
    throw error;
  }
  replayProc.on('exit', () => {
    replayState.active = false;
    replayProc = null;
  });
  return replayStatus();
}

function stopReplay() {
  stopProcess(replayProc);
  return replayStatus();
}

/** Lipeste ultimele segmente complete intr-un .mp4 (fara recodare) in Videos/DominosLand Clips. */
async function saveClip() {
  if (!replayState.dir || !fs.existsSync(replayState.dir)) throw new Error('Replay buffer-ul nu ruleaza.');
  const files = fs.readdirSync(replayState.dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, time: fs.statSync(path.join(replayState.dir, name)).mtimeMs }))
    .sort((a, b) => a.time - b.time);
  // Ultimul segment e inca in scriere: il sarim.
  const ready = files.slice(0, -1).slice(-Math.ceil(replayState.seconds / SEGMENT_SEC));
  if (!ready.length) throw new Error('Inca nu exista destule secunde inregistrate.');
  const list = path.join(replayState.dir, 'concat.txt');
  fs.writeFileSync(list, ready.map((item) => `file '${path.join(replayState.dir, item.name).replace(/\\/g, '/')}'`).join('\n'));
  const target = path.join(clipsDir(), `clip-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`);
  const result = await run(['-hide_banner', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', target], 60_000);
  if (!result.ok) throw new Error(`Clipul nu a putut fi salvat: ${result.stderr.slice(-200)}`);
  replayState.lastClip = target;
  return { path: target, seconds: ready.length * SEGMENT_SEC };
}

function listClips() {
  const dir = clipsDir();
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.mp4'))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, path: path.join(dir, name), size: stat.size, createdAt: stat.mtimeMs };
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

function replayStatus() {
  return { active: replayState.active, seconds: replayState.seconds, lastClip: replayState.lastClip, log: replayState.log.slice(-10), clipsDir: clipsDir() };
}

// ─── Diagnostic ─────────────────────────────────────────────────────────────
function tcpPing(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const socket = net.connect({ host, port, timeout: timeoutMs });
    const done = (ok) => {
      socket.destroy();
      resolve(ok ? Number(process.hrtime.bigint() - started) / 1e6 : null);
    };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** 10 conexiuni TCP catre server: ping mediu, jitter (variatia) si pierderi. */
async function networkTest(rawHost) {
  const host = String(rawHost || '').trim();
  if (!/^[a-z0-9.-]{3,253}$/i.test(host)) throw new Error('Host invalid.');
  const samples = [];
  for (let index = 0; index < 10; index += 1) samples.push(await tcpPing(host, 443));
  const ok = samples.filter((value) => value !== null);
  const avg = ok.length ? ok.reduce((sum, value) => sum + value, 0) / ok.length : null;
  const jitter = ok.length > 1 ? ok.slice(1).reduce((sum, value, index) => sum + Math.abs(value - ok[index]), 0) / (ok.length - 1) : null;
  return {
    host,
    pingMs: avg === null ? null : Math.round(avg),
    jitterMs: jitter === null ? null : Math.round(jitter * 10) / 10,
    lossPercent: Math.round(((samples.length - ok.length) / samples.length) * 100),
    samples: samples.map((value) => (value === null ? null : Math.round(value))),
  };
}

function gpuNames() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController).Name'], { windowsHide: true, timeout: 10_000 }, (error, stdout) => {
      resolve(error ? [] : String(stdout).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    });
  });
}

async function systemInfo() {
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model?.trim() || 'necunoscut',
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    freeMemoryGb: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
    gpus: await gpuNames(),
    encoders: await detectEncoders(),
  };
}

function shutdown() {
  stopProcess(streamProc);
  stopProcess(replayProc);
}

module.exports = {
  detectEncoders, listAudioDevices, startStream, stopStream, streamStatus,
  startReplay, stopReplay, saveClip, listClips, replayStatus, networkTest, systemInfo, shutdown,
};
