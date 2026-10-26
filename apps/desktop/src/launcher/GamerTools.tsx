/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Performanta, Streaming si Clipuri: interfata pentru motorul media din procesul Electron.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Camera, Cpu, Film, FolderOpen, Gauge, Layers, MonitorPlay, Plus, Radio, Rocket, Save, Square, Trash2, Wifi, Zap,
} from 'lucide-react';
import { API_BASE } from '../api';
import './launcher.css';

const desktop = () => window.dominosDesktop;

function DesktopOnly() {
  return <p className="launcher-muted">Functia merge doar in aplicatia DominosLand pentru Windows (nu in browser).</p>;
}

function useCapabilities() {
  const [caps, setCaps] = useState<{ encoders: { encoders: EncoderInfo[]; recommended: string }; audio: string[] } | null>(null);
  useEffect(() => {
    desktop()?.media?.capabilities().then(setCaps).catch(() => setCaps(null));
  }, []);
  return caps;
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: typeof Cpu; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="launcher-card tool-card">
      <header className="tool-card-head">
        <span className="tool-icon"><Icon size={18} /></span>
        <h2>{title}</h2>
        {action && <div className="tool-card-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Performanta ─────────────────────────────────────────────────────────────
export function PerformanceView() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [network, setNetwork] = useState<NetworkTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [power, setPower] = useState<{ supported: boolean; active: boolean; reason?: string } | null>(null);
  const [boosted, setBoosted] = useState<string[] | null>(null);
  const [message, setMessage] = useState('');
  const host = useMemo(() => {
    try { return new URL(API_BASE).hostname; } catch { return 'api.dominosland.com'; }
  }, []);

  useEffect(() => {
    desktop()?.diagnostics?.system().then(setSystem).catch(() => {});
    desktop()?.launcher?.power('status').then(setPower).catch(() => {});
  }, []);

  if (!desktop()?.diagnostics) return <div className="launcher"><DesktopOnly /></div>;

  const runNetwork = async () => {
    setTesting(true);
    try {
      setNetwork(await desktop()!.diagnostics!.network(host));
    } catch (error: any) {
      setMessage(error?.message || 'Testul de retea a esuat.');
    } finally {
      setTesting(false);
    }
  };

  const boost = async (on: boolean) => {
    setMessage('');
    const result = await desktop()!.launcher!.power(on ? 'boost' : 'restore');
    setPower(result);
    const priority = await desktop()!.booster!.priority(on ? 'high' : 'normal');
    setBoosted(priority.boosted);
    if (result.reason) setMessage(result.reason);
  };

  const encoders = system?.encoders.encoders || [];
  const quality = network ? (network.lossPercent > 0 || (network.jitterMs ?? 0) > 15 ? 'instabila' : (network.pingMs ?? 999) < 40 ? 'excelenta' : (network.pingMs ?? 999) < 90 ? 'buna' : 'slaba') : null;

  return (
    <div className="launcher tools-grid">
      <Card title="Game Booster" icon={Rocket} action={
        <button className={power?.active ? 'launcher-button ghost' : 'launcher-button'} onClick={() => boost(!power?.active)}>
          <Zap size={15} /> {power?.active ? 'Opreste' : 'Activeaza'}
        </button>
      }>
        <p className="launcher-muted">Plan de energie High performance cat joci si prioritate ridicata pentru procesul jocului (CS2, FiveM, GTA, SA-MP, Metin2, Minecraft, Rust). Se revine automat cand inchizi launcher-ul.</p>
        <div className="tool-stats">
          <div><span>Plan energie</span><strong className={power?.active ? 'ok' : ''}>{power?.supported === false ? 'nesuportat' : power?.active ? 'High performance' : 'Normal'}</strong></div>
          <div><span>Jocuri prioritizate</span><strong>{boosted ? (boosted.length ? boosted.join(', ') : 'niciun joc pornit') : '—'}</strong></div>
        </div>
        {message && <p className="launcher-warning">{message}</p>}
      </Card>

      <Card title="Conexiune la DominosLand" icon={Wifi} action={
        <button className="launcher-button ghost" onClick={runNetwork} disabled={testing}><Activity size={15} /> {testing ? 'Se testeaza…' : 'Testeaza'}</button>
      }>
        <p className="launcher-muted">10 conexiuni catre {host}: ping mediu, jitter si pierderi. Util inainte de un meci sau de un live.</p>
        <div className="tool-stats">
          <div><span>Ping</span><strong>{network?.pingMs != null ? `${network.pingMs} ms` : '—'}</strong></div>
          <div><span>Jitter</span><strong>{network?.jitterMs != null ? `${network.jitterMs} ms` : '—'}</strong></div>
          <div><span>Pierderi</span><strong className={network && network.lossPercent > 0 ? 'bad' : ''}>{network ? `${network.lossPercent}%` : '—'}</strong></div>
          <div><span>Calitate</span><strong className={quality === 'excelenta' || quality === 'buna' ? 'ok' : quality ? 'bad' : ''}>{quality || '—'}</strong></div>
        </div>
        {network && (
          <div className="ping-bars" aria-label="Ping pe fiecare incercare">
            {network.samples.map((value, index) => (
              <span key={index} className={value === null ? 'lost' : ''} style={{ height: `${value === null ? 100 : Math.min(100, 12 + value)}%` }} title={value === null ? 'pierdut' : `${value} ms`} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Sistem" icon={Cpu}>
        {system ? (
          <div className="tool-stats">
            <div><span>Procesor</span><strong>{system.cpu} · {system.cores} fire</strong></div>
            <div><span>Memorie</span><strong>{system.memoryGb} GB ({system.freeMemoryGb} GB libera)</strong></div>
            <div><span>Placa video</span><strong>{system.gpus.join(' + ') || 'necunoscuta'}</strong></div>
            <div><span>Sistem</span><strong>{system.os}</strong></div>
          </div>
        ) : <p className="launcher-muted">Se citesc informatiile…</p>}
      </Card>

      <Card title="Encodere video" icon={Gauge}>
        <p className="launcher-muted">Testate cu o codare reala. Streaming-ul si clipurile folosesc automat primul encoder hardware care merge.</p>
        <ul className="encoder-list">
          {encoders.map((encoder) => (
            <li key={encoder.id} className={encoder.available ? 'ok' : ''}>
              <span className="dot" /> {encoder.label}
              {system?.encoders.recommended === encoder.id && <em>recomandat</em>}
              {!encoder.available && <small>indisponibil</small>}
            </li>
          ))}
          {!encoders.length && <li>Se testeaza encoderele…</li>}
        </ul>
      </Card>

      <Card title="Overlay" icon={Layers} action={<button className="launcher-button ghost" onClick={() => desktop()?.overlay?.toggle()}><Layers size={15} /> Arata / ascunde</button>}>
        <p className="launcher-muted">Fereastra mica deasupra jocului cu Jarvis, serverele live si clipuri. Scurtatura: <kbd>Alt</kbd>+<kbd>J</kbd>. Merge peste jocurile in modul borderless / windowed fullscreen; nu se injecteaza nimic in joc (sigur pentru anti-cheat).</p>
      </Card>
    </div>
  );
}

// ─── Streaming ───────────────────────────────────────────────────────────────
const PLATFORMS: Array<{ name: string; url: string }> = [
  { name: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2' },
  { name: 'Twitch', url: 'rtmp://live.twitch.tv/app' },
  { name: 'Kick', url: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app' },
  { name: 'TikTok', url: 'rtmp://push.tiktokcdn.com/live' },
];

const QUALITY = [
  { id: '720p60', label: '720p 60fps · 4500 kbps', height: 720, fps: 60, bitrate: 4500 },
  { id: '1080p30', label: '1080p 30fps · 6000 kbps', height: 1080, fps: 30, bitrate: 6000 },
  { id: '1080p60', label: '1080p 60fps · 8000 kbps', height: 1080, fps: 60, bitrate: 8000 },
];

// Calitatea si sursele audio alese se tin minte (nu sunt secrete), ca live-ul sa poata porni si de pe telefon.
const STREAM_PREFS = 'dominosStreamPrefs';
const REPLAY_PREFS = 'dominosReplayPrefs';

function readPrefs<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return fallback;
  }
}

function writePrefs(key: string, value: object) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Fara localStorage setarile raman doar pentru sesiunea curenta.
  }
}

function cleanError(error: any) {
  return String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

/** Porneste live-ul cu destinatiile si setarile salvate (folosit si de telefon prin Remote Link). */
export async function startSavedStream(): Promise<StreamStatus> {
  const app = desktop();
  if (!app?.media) throw new Error('Streaming-ul merge doar in aplicatia desktop.');
  let destinations: StreamDestination[] = [];
  try {
    destinations = JSON.parse((await app.secureStore.get('streamDestinations')) || '[]');
  } catch {
    destinations = [];
  }
  const active = destinations.filter((item) => item.enabled && item.key);
  if (!active.length) throw new Error('Nu ai nicio destinatie activa cu cheie de stream (Launcher → Streaming).');
  const prefs = readPrefs(STREAM_PREFS, { quality: '1080p60', audio: [] as string[] });
  const preset = QUALITY.find((item) => item.id === prefs.quality) || QUALITY[2];
  return app.media.startStream({ destinations: active, height: preset.height, fps: preset.fps, bitrateKbps: preset.bitrate, audio: prefs.audio.slice(0, 2) });
}

/** Porneste replay buffer-ul cu durata si sunetul salvate. */
export async function startSavedReplay(): Promise<ReplayStatus> {
  const media = desktop()?.media;
  if (!media) throw new Error('Clipurile merg doar in aplicatia desktop.');
  const prefs = readPrefs(REPLAY_PREFS, { seconds: 30, audio: '' });
  return media.startReplay({ seconds: prefs.seconds, audio: prefs.audio ? [prefs.audio] : [] });
}

export function StreamingView() {
  const caps = useCapabilities();
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [quality, setQuality] = useState(() => readPrefs(STREAM_PREFS, { quality: '1080p60', audio: [] as string[] }).quality);
  const [audio, setAudio] = useState<string[]>(() => readPrefs(STREAM_PREFS, { quality: '1080p60', audio: [] as string[] }).audio);
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => writePrefs(STREAM_PREFS, { quality, audio }), [quality, audio]);

  useEffect(() => {
    desktop()?.secureStore.get('streamDestinations').then((raw) => {
      try { setDestinations(raw ? JSON.parse(raw) : []); } catch { setDestinations([]); }
    }).catch(() => {});
    desktop()?.media?.streamStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!status?.live) return;
    const timer = window.setInterval(() => desktop()?.media?.streamStatus().then(setStatus), 2000);
    return () => window.clearInterval(timer);
  }, [status?.live]);

  const persist = useCallback((next: StreamDestination[]) => {
    setDestinations(next);
    // Cheile de stream sunt secrete: salvate criptat (Windows DPAPI), nu in localStorage.
    desktop()?.secureStore.set('streamDestinations', JSON.stringify(next)).catch(() => {});
  }, []);

  if (!desktop()?.media) return <div className="launcher"><DesktopOnly /></div>;

  const update = (id: string, patch: Partial<StreamDestination>) => persist(destinations.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const add = (platform = PLATFORMS[0]) => persist([...destinations, { id: crypto.randomUUID(), name: platform.name, url: platform.url, key: '', enabled: true }]);

  const start = async () => {
    setBusy(true); setError('');
    const preset = QUALITY.find((item) => item.id === quality)!;
    try {
      setStatus(await desktop()!.media!.startStream({ destinations: destinations.filter((item) => item.enabled && item.key), height: preset.height, fps: preset.fps, bitrateKbps: preset.bitrate, audio }));
    } catch (caught: any) {
      setError(cleanError(caught));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => setStatus(await desktop()!.media!.stopStream());

  return (
    <div className="launcher tools-grid">
      <Card title="Multi-stream" icon={Radio} action={
        status?.live
          ? <button className="launcher-button danger" onClick={stop}><Square size={15} /> Opreste live-ul</button>
          : <button className="launcher-button" onClick={start} disabled={busy || !destinations.some((item) => item.enabled && item.key)}><MonitorPlay size={15} /> {busy ? 'Se porneste…' : 'Intra LIVE'}</button>
      }>
        <p className="launcher-muted">O singura codare trimisa simultan pe toate platformele active. Daca una cade, celelalte continua. Se capteaza monitorul principal.</p>
        {status?.live && (
          <div className="live-banner">
            <span className="live-dot" /> LIVE · {formatDuration(status.uptimeSec)} · {status.destinations.join(', ')} · {status.encoder}
          </div>
        )}
        {error && <p className="launcher-warning">{error}</p>}
      </Card>

      <Card title="Destinatii" icon={Plus} action={
        <div className="chip-row">{PLATFORMS.map((platform) => <button key={platform.name} className="launcher-chip" onClick={() => add(platform)}>+ {platform.name}</button>)}</div>
      }>
        {destinations.length ? (
          <ul className="destination-list">
            {destinations.map((item) => (
              <li key={item.id}>
                <label className="switch"><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /><span /></label>
                <input value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} className="dest-name" aria-label="Nume" />
                <input value={item.url} onChange={(event) => update(item.id, { url: event.target.value })} className="dest-url" aria-label="Server RTMP" />
                <input value={item.key} onChange={(event) => update(item.id, { key: event.target.value })} type="password" placeholder="Cheie stream" className="dest-key" aria-label="Cheie stream" />
                <button className="icon-only" onClick={() => persist(destinations.filter((other) => other.id !== item.id))} aria-label="Sterge"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="launcher-muted">Adauga o platforma din butoanele de sus, apoi lipeste cheia de stream din contul tau (YouTube Studio, Twitch Dashboard...).</p>}
      </Card>

      <Card title="Calitate si sunet" icon={Gauge}>
        <label className="tool-field">Calitate
          <select value={quality} onChange={(event) => setQuality(event.target.value)}>{QUALITY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </label>
        <label className="tool-field">Surse audio (maxim 2: sunetul jocului + microfon)
          <select multiple value={audio} onChange={(event) => setAudio([...event.target.selectedOptions].map((option) => option.value).slice(0, 2))} size={Math.min(5, Math.max(2, caps?.audio.length || 2))}>
            {(caps?.audio || []).map((device) => <option key={device} value={device}>{device}</option>)}
          </select>
        </label>
        <p className="launcher-muted small">Pentru sunetul din joc alege „Stereo Mix” sau iesirea Voicemeeter. Encoder: {caps?.encoders.recommended || 'se detecteaza…'}.</p>
      </Card>

      {status?.log?.length ? (
        <Card title="Jurnal FFmpeg" icon={Activity}>
          <pre className="tool-log">{status.log.join('\n')}</pre>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Clipuri ─────────────────────────────────────────────────────────────────
export function ClipsView() {
  const caps = useCapabilities();
  const [status, setStatus] = useState<ReplayStatus | null>(null);
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [seconds, setSeconds] = useState(() => readPrefs(REPLAY_PREFS, { seconds: 30, audio: '' }).seconds);
  const [audio, setAudio] = useState<string>(() => readPrefs(REPLAY_PREFS, { seconds: 30, audio: '' }).audio);
  const [message, setMessage] = useState('');

  useEffect(() => writePrefs(REPLAY_PREFS, { seconds, audio }), [seconds, audio]);

  const refresh = useCallback(() => {
    desktop()?.media?.replayStatus().then(setStatus).catch(() => {});
    desktop()?.media?.listClips().then(setClips).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const off = desktop()?.media?.onClipSaved(() => refresh());
    return () => off?.();
  }, [refresh]);

  if (!desktop()?.media) return <div className="launcher"><DesktopOnly /></div>;

  const toggle = async () => {
    setMessage('');
    try {
      setStatus(status?.active ? await desktop()!.media!.stopReplay() : await desktop()!.media!.startReplay({ seconds, audio: audio ? [audio] : [] }));
    } catch (error: any) {
      setMessage(String(error?.message || error));
    }
  };

  const save = async () => {
    try {
      const clip = await desktop()!.media!.saveClip();
      setMessage(`Clip salvat: ${clip.seconds} secunde.`);
      refresh();
    } catch (error: any) {
      setMessage(cleanError(error));
    }
  };

  return (
    <div className="launcher tools-grid">
      <Card title="Replay buffer" icon={Camera} action={
        <button className={status?.active ? 'launcher-button ghost' : 'launcher-button'} onClick={toggle}>{status?.active ? <><Square size={15} /> Opreste</> : <><Camera size={15} /> Porneste</>}</button>
      }>
        <p className="launcher-muted">Inregistreaza continuu ultimele secunde (fara sa umple discul). Apasa <kbd>Alt</kbd>+<kbd>F10</kbd> oricand, si din joc, ca sa salvezi momentul.</p>
        <div className="tool-row">
          <label className="tool-field">Durata clip
            <select value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} disabled={status?.active}>
              {[15, 30, 60, 90, 120].map((value) => <option key={value} value={value}>{value} secunde</option>)}
            </select>
          </label>
          <label className="tool-field">Sunet
            <select value={audio} onChange={(event) => setAudio(event.target.value)} disabled={status?.active}>
              <option value="">Fara sunet</option>
              {(caps?.audio || []).map((device) => <option key={device} value={device}>{device}</option>)}
            </select>
          </label>
        </div>
        <div className="tool-actions">
          <span className={status?.active ? 'state-pill on' : 'state-pill'}>{status?.active ? `Inregistreaza · ultimele ${status.seconds}s` : 'Oprit'}</span>
          <button className="launcher-button" onClick={save} disabled={!status?.active}><Save size={15} /> Salveaza acum</button>
        </div>
        {message && <p className="launcher-muted small">{message}</p>}
      </Card>

      <Card title="Clipurile tale" icon={FolderOpen} action={<button className="launcher-button ghost" onClick={() => desktop()?.media?.openClipsFolder()}><FolderOpen size={15} /> Deschide folderul</button>}>
        {clips.length ? (
          <ul className="clip-list">
            {clips.map((clip) => (
              <li key={clip.path}>
                <Camera size={16} />
                <span className="clip-name">{clip.name}</span>
                <span className="launcher-muted small">{(clip.size / 1024 / 1024).toFixed(1)} MB · {new Date(clip.createdAt).toLocaleString('ro-RO')}</span>
                <button className="icon-only" onClick={() => desktop()?.media?.showClip(clip.path)} aria-label="Arata in folder"><FolderOpen size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="launcher-muted">Niciun clip inca. Porneste replay buffer-ul si apasa Alt+F10 in joc.</p>}
      </Card>
    </div>
  );
}

// ── Cinema Extractor (Filme & Stream Curat) ──────────────────────────────────
export function CinemaView() {
  const [url, setUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [zoom, setZoom] = useState<'fit' | 'fill' | 'cinema' | 'ultrawide'>('cinema');
  const [shield, setShield] = useState(true);

  const launch = (target?: string) => {
    const toOpen = target || url;
    if (toOpen) setActiveUrl(toOpen);
  };

  const getZoomStyle = (): React.CSSProperties => {
    switch (zoom) {
      case 'cinema':
        return { width: '104%', height: '108%', transform: 'scale(1.04) translateY(-3%)' };
      case 'ultrawide':
        return { width: '115%', height: '115%', transform: 'scale(1.15)' };
      case 'fill':
        return { width: '100%', height: '100%' };
      case 'fit':
      default:
        return { width: '100%', height: '100%' };
    }
  };

  return (
    <section className="launcher-card tool-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <header className="tool-card-head" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="tool-icon"><Film size={18} /></span>
          <h2>Cinema Extractor • Captură Ecran Film</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '600px' }}>
          <input
            type="text"
            placeholder="Lipește link-ul filmului sau stream-ului..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && launch()}
            style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px' }}
          />
          <button className="tool-btn primary" onClick={() => launch()} style={{ padding: '6px 14px' }}>
            Deschide
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className={`tool-btn ${zoom === 'cinema' ? 'primary' : ''}`} onClick={() => setZoom('cinema')} title="Elimină barele de pe site">
            Cinema Crop
          </button>
          <button className={`tool-btn ${zoom === 'fill' ? 'primary' : ''}`} onClick={() => setZoom('fill')}>
            100%
          </button>
          <button className={`tool-btn ${shield ? 'primary' : ''}`} onClick={() => setShield(!shield)} title="Izolează reclamele">
            🛡️ Ad-Shield
          </button>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000', borderRadius: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {activeUrl ? (
          <iframe
            src={activeUrl}
            style={{ border: 0, ...getZoomStyle() }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox={shield ? "allow-scripts allow-same-origin allow-presentation allow-forms" : undefined}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>
            <Film size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Ecran Cinema Curat</h3>
            <p style={{ maxWidth: '420px', margin: '0 auto', fontSize: '13px' }}>
              Introdu un URL de film sau stream pentru a-l viziona fără reclame sau elemente distractive direct în launcher.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
