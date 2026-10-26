/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  Film,
  Gauge,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Music,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Square,
  TerminalSquare,
  Volume2,
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import LauncherHome from './launcher/LauncherHome';
import { CinemaView, ClipsView, PerformanceView, StreamingView } from './launcher/GamerTools';
import QRCode from 'qrcode';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { api, API_TARGETS, connectSocket, downloadMediaToDevice, findAvailableApiUrl, getSavedUser, login, loginWithToken, logout, setApiBase as saveApiBase } from './api';
import { detectLanguage, languageOptions, Language, saveLanguage, translate } from './i18n';

type View = 'launcher' | 'performance' | 'streaming' | 'clips' | 'cinema' | 'overview' | 'hub' | 'services' | 'discord' | 'games' | 'logs' | 'terminal' | 'jarvis' | 'metrics' | 'domains' | 'audit';

interface ServiceStatus {
  id: string;
  name: string;
  pm2Name: string;
  group: string;
  description: string;
  critical: boolean;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
  uptimeMs: number;
}

interface Snapshot {
  timestamp: string;
  host: {
    hostname: string;
    platform: string;
    arch: string;
    release: string;
    uptime: number;
  };
  metrics: any;
  services: ServiceStatus[];
  alerts: Array<{ level: string; message: string; target: string }>;
  domains: Array<{ host: string; target: string; status: string }>;
  security: {
    rootTerminal: boolean;
    require2fa: boolean;
    auditEntries: number;
  };
}

// Meniul pe grupuri, in stilul NVIDIA App: "Joc" pentru toti, "Administrare" doar pentru staff.
const viewGroups: Array<{ label: string; staff?: boolean; items: Array<{ id: View; label: string; icon: any }> }> = [
  {
    label: 'Joc',
    items: [
      { id: 'launcher', label: 'Acasa', icon: Rocket },
      { id: 'cinema', label: 'Cinema Curat', icon: Film },
      { id: 'performance', label: 'Performanta', icon: Gauge },
      { id: 'streaming', label: 'Streaming', icon: Radio },
      { id: 'clips', label: 'Clipuri', icon: Camera },
      { id: 'jarvis', label: 'Jarvis', icon: MessageSquare },
    ],
  },
  {
    label: 'Administrare',
    staff: true,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'hub', label: 'DominosLand Hub', icon: ShieldCheck },
      { id: 'services', label: 'Servicii', icon: Bot },
      { id: 'discord', label: 'Discord', icon: ShieldCheck },
      { id: 'games', label: 'Game Panel', icon: Gauge },
      { id: 'logs', label: 'Live Logs', icon: Activity },
      { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
      { id: 'metrics', label: 'VPS Metrics', icon: Gauge },
      { id: 'domains', label: 'Domains', icon: Globe2 },
      { id: 'audit', label: 'Security', icon: ShieldCheck },
    ],
  },
];
const views = viewGroups.flatMap((group) => group.items);
const STAFF_ROLES = ['moderator', 'admin', 'super_admin', 'cofounder', 'founder'];

export default function App() {
  const [user, setUser] = useState(getSavedUser());
  const [view, setView] = useState<View>('launcher');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<Language>(detectLanguage);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    if (oauthToken && !user) {
      loginWithToken(oauthToken).then((oauthUser) => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setUser(oauthUser);
      }).catch(() => {});
      return;
    }

    if (!user) {
      return;
    }

    const ws = connectSocket();
    setSocket(ws);
    ws.on('connect', () => {
      ws.emit('control:subscribe');
      setError('');
    });
    ws.on('vps:metrics', (data: Snapshot) => setSnapshot(data));
    ws.on('control:error', (payload: any) => setError(payload?.message || 'Control error'));
    ws.on('error', (payload: any) => setError(payload?.message || 'Socket error'));

    api.get('/api/control/snapshot')
      .then((res) => setSnapshot(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message));

    return () => {
      ws.disconnect();
      setSocket(null);
    };
  }, [user]);

  if (!user) {
    return <LoginScreen language={language} onLanguageChange={changeLanguage} onLogin={setUser} />;
  }

  const ActiveIcon = views.find((item) => item.id === view)?.icon || LayoutDashboard;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><img src="/logo-dominos.svg" alt="DominosLand" /></div>
          <div className="login-brand-copy">
            <strong>DominosLand</strong>
            <span>LAUNCHER</span>
          </div>
        </div>

        <nav>
          {viewGroups.filter((group) => !group.staff || STAFF_ROLES.includes(String(user.role))).map((group) => (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}>
                    <Icon size={18} />
                    <span>{translate(language, item.label)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <ShieldCheck size={16} />
            <span>{user.username}</span>
            <small>{user.role}</small>
          </div>
          <button
            className="icon-button"
            title="Logout"
            onClick={() => {
              logout();
              setUser(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">DominosLand</p>
            <h1><ActiveIcon size={24} /> {translate(language, views.find((item) => item.id === view)?.label || '')}</h1>
          </div>
          <div className="topbar-actions">
            <span className="system-led">{translate(language, 'ALL SYSTEMS')}</span>
            <span className="status-chip">{new Date().toLocaleDateString(language)}</span>
            {snapshot?.security?.require2fa && <span className="status-chip warn"><KeyRound size={15} /> {translate(language, '2FA required')}</span>}
            <span className="status-chip"><Activity size={15} /> {translate(language, socket?.connected ? 'Live' : 'Offline')}</span>
            <label className="language-picker">
              <span className="sr-only">{translate(language, 'Language')}</span>
              <select value={language} onChange={(event) => changeLanguage(event.target.value as Language)}>
                {languageOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <button className="command-button" onClick={() => api.get('/api/control/snapshot').then((res) => setSnapshot(res.data))}>
              <RefreshCw size={16} />
              {translate(language, 'Refresh')}
            </button>
          </div>
        </header>

        {error && <div className="banner danger">{error}</div>}

        {view === 'launcher' && <LauncherHome />}
        {view === 'cinema' && <CinemaView />}
        {view === 'performance' && <PerformanceView />}
        {view === 'streaming' && <StreamingView />}
        {view === 'clips' && <ClipsView />}
        {view === 'overview' && <Overview snapshot={snapshot} setView={setView} />}
        {view === 'hub' && <DominosHub />}
        {view === 'services' && <Services snapshot={snapshot} onRefresh={(next) => setSnapshot(next)} />}
        {view === 'discord' && <DiscordProfile />}
        {view === 'games' && <GamePanel />}
        {view === 'logs' && <Logs socket={socket} services={snapshot?.services || []} />}
        {view === 'terminal' && <TerminalView socket={socket} />}
        {view === 'jarvis' && <JarvisView snapshot={snapshot} />}
        {view === 'metrics' && <MetricsView snapshot={snapshot} />}
        {view === 'domains' && <DomainsView snapshot={snapshot} />}
        {view === 'audit' && <AuditView />}
      </main>
    </div>
  );
}

function LoginScreen({ language, onLanguageChange, onLogin }: { language: Language; onLanguageChange: (language: Language) => void; onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const savedApiBase = localStorage.getItem('dominosApiBase') || '';
  const savedTarget = API_TARGETS.find((target) => target.url === savedApiBase)?.id || (savedApiBase ? 'custom' : 'auto');
  const [apiTarget, setApiTarget] = useState(savedTarget);
  const [apiBase, setApiUrl] = useState(savedApiBase);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [loginExpanded, setLoginExpanded] = useState(false);
  const [error, setError] = useState('');

  async function selectApiTarget(targetId: string) {
    setApiTarget(targetId);
    setError('');
    if (targetId === 'custom') return;
    if (targetId === 'auto') {
      setDetecting(true);
      try {
        const detected = await findAvailableApiUrl();
        setApiUrl(detected);
        saveApiBase(detected);
      } catch (detectionError: any) {
        setApiUrl('');
        setError(detectionError.message);
      } finally {
        setDetecting(false);
      }
      return;
    }
    const selected = API_TARGETS.find((target) => target.id === targetId);
    if (selected?.url) {
      setApiUrl(selected.url);
      saveApiBase(selected.url);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    saveApiBase(apiBase);

    try {
      const result = await login(username, password);
      onLogin(result.user);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form
        className={`login-panel ${loginExpanded ? 'expanded' : ''}`}
        onSubmit={submit}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (!['INPUT', 'SELECT', 'BUTTON', 'OPTION', 'LABEL'].includes(target.tagName)) {
            setLoginExpanded((current) => !current);
          }
        }}
        aria-label="AlexPanel login"
      >
          <div className="brand big">
          <div className="login-logo" aria-label="AlexPanel DMNSLX">
            <div className="alex-mark" aria-hidden="true">
              <div className="alex-mark-inner">ALEX</div>
            </div>
            <div className="alex-wordmark" aria-hidden="true">
              <span className="wordmark-green">D</span>
              <span className="wordmark-blue">M</span>
              <span className="wordmark-aqua">N</span>
              <span className="wordmark-blue">S</span>
              <span className="wordmark-aqua">L</span>
              <span className="wordmark-blue">X</span>
            </div>
          </div>
          <div className="login-brand-copy">
            <strong>AlexPanel</strong>
            <span>Discord, games, bots, VPS and Jarvis</span>
          </div>
        </div>
        <div className="login-content">
        <label className="language-picker login-language">
          <span>{translate(language, 'Language')}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
            {languageOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        {error && <div className="banner danger">{error}</div>}
        <label>
          {translate(language, 'API URL')}
          <select value={apiTarget} onChange={(event) => void selectApiTarget(event.target.value)}>
            {API_TARGETS.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            <option value="custom">Custom URL</option>
          </select>
          {apiTarget === 'custom' ? <input value={apiBase} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://api.example.com" /> : <span className="api-detection-status">{detecting ? 'Se cauta API accesibil...' : apiBase || 'Selecteaza Auto-detect'}</span>}
        </label>
        <label>
          Username or email
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          {translate(language, 'Password')}
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <button className="primary-button" disabled={loading}>
          <Lock size={17} />
          {loading ? 'Connecting...' : detecting ? 'Detecting API...' : translate(language, 'Login')}
        </button>
        <button
          className="command-button full-width"
          type="button"
          onClick={() => {
            saveApiBase(apiBase);
            window.location.href = `${apiBase.replace(/\/$/, '')}/api/auth/discord/login`;
          }}
        >
          <ShieldCheck size={17} />
          Login with Discord
        </button>
        </div>
      </form>
    </div>
  );
}

function DiscordProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('Main Discord Bot Token');
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [profileRes, secretsRes] = await Promise.allSettled([
      api.get('/api/control/profile/discord'),
      api.get('/api/control/secrets'),
    ]);
    if (profileRes.status === 'fulfilled') {
      setProfile(profileRes.value.data);
    }
    if (secretsRes.status === 'fulfilled') {
      setSecrets(secretsRes.value.data);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  async function saveSecret() {
    setError('');
    try {
      await api.post('/api/control/secrets', { type: 'discord_bot_token', label, value, code });
      setValue('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function revealSecret(secret: any) {
    setError('');
    setRevealing(secret.id);
    try {
      const { data } = await api.post(`/api/control/secrets/${secret.id}/reveal`, { code });
      setRevealed((current) => ({ ...current, [secret.id]: data.value }));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setRevealing('');
    }
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-header">
          <h2>Discord Profile</h2>
          <button className="ghost-button" onClick={load}>Refresh</button>
        </div>
        {error && <div className="banner danger">{error}</div>}
        <div className="profile-row">
          <img src={profile?.user?.discordAvatar || profile?.user?.avatar || '/icon.svg'} alt="" />
          <div>
            <strong>{profile?.user?.displayName || profile?.user?.username || 'Discord profile'}</strong>
            <small>{profile?.message || 'Roles fetched from DominosLand Discord when bot token is configured.'}</small>
          </div>
        </div>
        <div className="role-grid">
          {(profile?.roles || []).map((role: any) => (
            <span className="role-chip" style={{ borderColor: role.color, color: role.color }} key={role.id}>{role.name}</span>
          ))}
          {profile?.roles?.length === 0 && <span className="muted">No Discord roles loaded yet.</span>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Secret Vault</h2></div>
        <div className="stack">
          <div className="inline-field"><KeyRound size={16} /><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="2FA code" /></div>
          <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label" />
          <input className="field" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste token / API key" type="password" />
          <button className="primary-button" onClick={saveSecret}>Save hidden key</button>
          {secrets.map((secret) => (
            <div className="secret-row" key={secret.id}>
              <div>
                <strong>{secret.label}</strong>
                <small>{secret.type} - ****{secret.last4}</small>
                {revealed[secret.id] && <code>{revealed[secret.id]}</code>}
              </div>
              {secret.canReveal && (
                <button className="ghost-button" type="button" onClick={() => revealSecret(secret)} disabled={revealing === secret.id || !code}>
                  <Eye size={15} /> Reveal
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GamePanel() {
  const [games, setGames] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [installPath, setInstallPath] = useState('');
  const [serverName, setServerName] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/control/games/catalog').then((res) => {
      setGames(res.data);
      setSelected(res.data[0]);
      setInstallPath(res.data[0]?.defaultPath || '');
    }).catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  async function install() {
    setError('');
    setResult('');
    try {
      const { data } = await api.post('/api/control/games/install', {
        gameId: selected.id,
        installPath,
        serverName,
        code,
      });
      setResult(data.output || `Installed ${data.game.name}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-header"><h2>Game Installer</h2><span className="muted">LinuxGSM sources</span></div>
        {error && <div className="banner danger">{error}</div>}
        <div className="game-grid">
          {games.map((game) => (
            <button
              className={selected?.id === game.id ? 'game-card active' : 'game-card'}
              key={game.id}
              onClick={() => {
                setSelected(game);
                setInstallPath(game.defaultPath);
                setServerName(game.name);
              }}
            >
              <strong>{game.name}</strong>
              <small>{game.source}</small>
              <span>{game.ports}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Install</h2></div>
        <div className="stack">
          <input className="field" value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="Server name" />
          <input className="field" value={installPath} onChange={(event) => setInstallPath(event.target.value)} placeholder="/home/linuxgsm/games/..." />
          <div className="inline-field"><KeyRound size={16} /><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="2FA code" /></div>
          <button className="primary-button" onClick={install}>Install selected game</button>
        </div>
      </div>

      {result && <pre className="panel wide log-output">{result}</pre>}
    </section>
  );
}

function DominosHub() {
  const [status, setStatus] = useState<any>(null);
  const [backup, setBackup] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [marketplace, setMarketplace] = useState<any>(null);
  const [events, setEvents] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [media, setMedia] = useState<any>(null);
  const [compileJobs, setCompileJobs] = useState<any>(null);
  const [personality, setPersonality] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [opsQuestion, setOpsQuestion] = useState('Diagnose current DominosLand platform status and suggest the next safe action.');
  const [opsCode, setOpsCode] = useState('');
  const [mediaKind, setMediaKind] = useState('music');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [compilePrompt, setCompilePrompt] = useState('Creeaza un draft DominosLand armonios din fisierele selectate.');

  async function load() {
    const [statusRes, backupRes, profileRes, marketplaceRes, eventsRes, opsRes, mediaRes, compileRes, personalityRes] = await Promise.all([
      api.get('/api/hub/status'),
      api.get('/api/hub/backup'),
      api.get('/api/hub/profile/me'),
      api.get('/api/hub/marketplace'),
      api.get('/api/hub/events'),
      api.get('/api/hub/ops/context'),
      api.get('/api/control/media/library'),
      api.get('/api/control/compile/jobs'),
      api.get('/api/control/jarvis/personality'),
    ]);
    setStatus(statusRes.data);
    setBackup(backupRes.data);
    setProfile(profileRes.data);
    setMarketplace(marketplaceRes.data);
    setEvents(eventsRes.data);
    setOps(opsRes.data);
    setMedia(mediaRes.data);
    setCompileJobs(compileRes.data);
    setPersonality(personalityRes.data);
  }

  async function run(key: string, action: () => Promise<any>) {
    setBusy(key);
    setMessage('');
    try {
      const { data } = await action();
      setMessage(data?.message || data?.status || data?.summary || data?.entry?.actionId || 'Done.');
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.response?.data?.message || err.message));
  }, []);

  const components = status?.components || [];
  const down = components.filter((item: any) => item.state === 'down');
  const degraded = components.filter((item: any) => item.state === 'degraded' || item.state === 'unknown');
  const selectedMediaIds = (media?.items || []).slice(0, 8).map((item: any) => item.id);

  async function uploadMedia() {
    if (!mediaFile) {
      setMessage('Alege un fisier media.');
      return;
    }
    const form = new FormData();
    form.append('file', mediaFile);
    form.append('kind', mediaKind);
    if (mediaTitle) form.append('title', mediaTitle);
    form.append('source', 'desktop');
    await run('media-upload', () => api.post('/api/control/media/upload', form));
    setMediaFile(null);
    setMediaTitle('');
  }

  async function downloadMedia(item: any) {
    try {
      await downloadMediaToDevice(
        item.id,
        item.originalName || item.fileName || `${item.id}.bin`,
      );
    } catch (err: any) {
      setMessage(err.response?.data?.message || err.message || 'Download failed.');
    }
  }

  return (
    <section className="content-grid">
      <MetricCard label="DominosLand status" value={status?.status || 'loading'} detail={status?.publicUrl || 'dominosland.com'} />
      <MetricCard label="Down" value={String(down.length)} detail="components" />
      <MetricCard label="Warnings" value={String(degraded.length)} detail="degraded/unknown" />
      <MetricCard label="Credits" value={String(profile?.credits ?? 0)} detail={profile?.username || 'DominosLand profile'} />

      {message && <div className="banner wide">{String(message)}</div>}

      <div className="panel wide">
        <div className="panel-header">
          <h2>Status public</h2>
          <div className="quick-actions">
            <button onClick={() => run('refresh-status', () => api.get('/api/hub/status'))} disabled={Boolean(busy)}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={() => run('status-check', () => api.post('/api/hub/status/check'))} disabled={Boolean(busy)}>
              <Activity size={16} /> Notify check
            </button>
          </div>
        </div>
        <div className="table-list">
          {components.slice(0, 14).map((component: any) => (
            <div className="dominos-row" key={component.id}>
              <div>
                <strong>{component.name}</strong>
                <small>{component.group} - {component.detail}</small>
              </div>
              <span className={`status-pill ${component.state === 'online' ? 'playing' : component.state === 'degraded' ? 'saved' : 'danger'}`}>
                {component.state}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Backup</h2>
          <span className="muted">{backup?.latest?.status || 'no ledger'}</span>
        </div>
        <div className="quick-actions vertical">
          <button onClick={() => run('backup-run', () => api.post('/api/hub/backup/run'))} disabled={Boolean(busy)}>Backup acum</button>
          <button onClick={() => run('backup-verify', () => api.post('/api/hub/backup/verify'))} disabled={Boolean(busy)}>Verifica backup</button>
          <button onClick={() => run('restore-test', () => api.post('/api/hub/backup/test-restore'))} disabled={Boolean(busy)}>Test restore</button>
        </div>
        <pre className="jarvis-answer compact">{JSON.stringify((backup?.recent || []).slice(0, 6), null, 2)}</pre>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>DominosLand Account</h2>
          <span className="muted">{profile?.discordId || 'discord'}</span>
        </div>
        <div className="stack">
          <div className="dominos-profile">
            {profile?.discordAvatar ? <img src={profile.discordAvatar} alt="" /> : <div>DominosLand</div>}
            <strong>{profile?.username || 'User'}</strong>
            <small>{(profile?.badges || []).join(' / ') || 'member'}</small>
          </div>
          <div className="billing-strip">
            <span>Invites {profile?.invites?.total ?? 0}</span>
            <span>Roles {profile?.roles?.length ?? 0}</span>
            <span>Beats {profile?.creations?.beats ?? 0}</span>
            <span>Art {profile?.creations?.fanArt ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-header">
          <h2>Marketplace</h2>
          <span className="muted">{marketplace?.checkoutReady ? 'payments ready' : 'credits/free mode'}</span>
        </div>
        <div className="asset-grid">
          {(marketplace?.assets || []).map((asset: any) => (
            <div className="asset-card" key={asset.id}>
              <strong>{asset.name}</strong>
              <small>{asset.type} - {asset.tier} - {asset.credits} credits</small>
              <span>{(asset.tags || []).join(', ')}</span>
              <div className="asset-actions">
                <button onClick={() => run(`asset-${asset.id}`, () => api.post('/api/hub/marketplace/download', { assetId: asset.id }))} disabled={Boolean(busy)}>
                  <Download size={15} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Events</h2>
          <span className="muted">Discord/game/music/art</span>
        </div>
        <div className="table-list">
          {(events?.events || []).map((event: any) => (
            <div className="dominos-row compact" key={event.id}>
              <div>
                <strong>{event.title}</strong>
                <small>{event.category} - {event.server} - {event.registrations?.length || 0}/{event.capacity || 30}</small>
              </div>
              <button className="ghost-button" onClick={() => run(`event-${event.id}`, () => api.post(`/api/hub/events/${event.id}/register`))} disabled={Boolean(busy)}>
                Join
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-header">
          <h2>Media Library</h2>
          <span className="muted">{media?.total ?? 0} files</span>
        </div>
        <div className="media-upload-grid">
          <select value={mediaKind} onChange={(event) => setMediaKind(event.target.value)}>
            <option value="music">music</option>
            <option value="photo">photo</option>
            <option value="art">art</option>
            <option value="voice">voice</option>
            <option value="video">video</option>
          </select>
          <input className="field" value={mediaTitle} onChange={(event) => setMediaTitle(event.target.value)} placeholder="Titlu fisier" />
          <input className="field" type="file" onChange={(event) => setMediaFile(event.target.files?.[0] || null)} />
          <button className="command-button" onClick={uploadMedia} disabled={busy === 'media-upload' || !mediaFile}>
            <Music size={16} /> Upload
          </button>
        </div>
        <div className="table-list">
          {(media?.items || []).slice(0, 8).map((item: any) => (
            <div className="dominos-row compact" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.kind} - {Math.round((item.size || 0) / 1024)} KB - {item.source}</small>
              </div>
              <button className="ghost-button" onClick={() => downloadMedia(item)}>
                <Download size={15} /> Download
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Compiler</h2>
          <span className="muted">{compileJobs?.total ?? 0} jobs</span>
        </div>
        <div className="stack">
          <textarea value={compilePrompt} onChange={(event) => setCompilePrompt(event.target.value)} />
          <div className="quick-actions vertical">
            <button onClick={() => run('compile-music', () => api.post('/api/control/compile', { type: 'music', mediaIds: selectedMediaIds, prompt: compilePrompt, outputFormat: 'mp3', mode: 'auto' }))} disabled={Boolean(busy)}>
              Compile music
            </button>
            <button onClick={() => run('compile-photo', () => api.post('/api/control/compile', { type: 'photo', mediaIds: selectedMediaIds, prompt: compilePrompt, outputFormat: 'png', mode: 'auto' }))} disabled={Boolean(busy)}>
              Compile photo
            </button>
          </div>
          <pre className="jarvis-answer compact">{JSON.stringify((compileJobs?.jobs || []).slice(0, 5), null, 2)}</pre>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Jarvis Personality</h2>
          <span className="muted">{personality?.editable ? 'editable' : 'view only'}</span>
        </div>
        <div className="stack">
          <input className="field" value={personality?.name || ''} onChange={(event) => setPersonality({ ...personality, name: event.target.value })} placeholder="Name" />
          <input className="field" value={personality?.tone || ''} onChange={(event) => setPersonality({ ...personality, tone: event.target.value })} placeholder="Tone" />
          <input className="field" value={personality?.teasing || ''} onChange={(event) => setPersonality({ ...personality, teasing: event.target.value })} placeholder="Friendly teasing" />
          <textarea value={personality?.harmonyRules || ''} onChange={(event) => setPersonality({ ...personality, harmonyRules: event.target.value })} />
          <button className="primary-button" onClick={() => run('personality', () => api.post('/api/control/jarvis/personality', personality))} disabled={!personality?.editable || Boolean(busy)}>
            Save Jarvis style
          </button>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-header">
          <h2>Jarvis Ops Mode</h2>
          <span className="muted">confirm before execute</span>
        </div>
        <textarea value={opsQuestion} onChange={(event) => setOpsQuestion(event.target.value)} />
        <div className="quick-actions">
          <button onClick={() => run('ops-plan', () => api.post('/api/hub/ops/plan', { question: opsQuestion }))} disabled={Boolean(busy)}>
            <MessageSquare size={16} /> Propune fix
          </button>
          <div className="inline-field">
            <KeyRound size={16} />
            <input value={opsCode} onChange={(event) => setOpsCode(event.target.value)} placeholder="2FA code" />
          </div>
          {(ops?.safeCommands || []).map((action: string) => (
            <button key={action} onClick={() => run(action, () => api.post('/api/hub/ops/confirm', { actionId: action, code: opsCode }))} disabled={Boolean(busy)}>
              {action}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Overview({ snapshot, setView }: { snapshot: Snapshot | null; setView: (view: View) => void }) {
  const services = snapshot?.services || [];
  const online = services.filter((item) => item.status === 'online').length;

  return (
    <section className="content-grid">
      <MetricCard label="Services online" value={`${online}/${services.length}`} detail="PM2 managed" />
      <MetricCard label="CPU" value={`${snapshot?.metrics?.cpu?.usagePercent ?? 0}%`} detail={snapshot?.host?.hostname || 'waiting'} />
      <MetricCard label="RAM" value={`${snapshot?.metrics?.memory?.usagePercent ?? 0}%`} detail={formatBytes(snapshot?.metrics?.memory?.used || 0)} />
      <MetricCard label="Disk" value={`${snapshot?.metrics?.disk?.usagePercent ?? 0}%`} detail={formatBytes(snapshot?.metrics?.disk?.used || 0)} />

      <div className="panel wide">
        <div className="panel-header">
          <h2>Critical services</h2>
          <button className="ghost-button" onClick={() => setView('services')}>Open services</button>
        </div>
        <div className="service-strip">
          {services.map((service) => <ServiceRow key={service.id} service={service} compact />)}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Alerts</h2>
          <span className="muted">{snapshot?.alerts?.length || 0}</span>
        </div>
        <div className="stack">
          {snapshot?.alerts?.length ? snapshot.alerts.map((alert, index) => (
            <div className={`alert ${alert.level}`} key={`${alert.target}-${index}`}>{alert.message}</div>
          )) : <div className="empty-state"><CheckCircle2 size={20} /> No active alerts</div>}
        </div>
      </div>
    </section>
  );
}

function Services({ snapshot, onRefresh }: { snapshot: Snapshot | null; onRefresh: (snapshot: Snapshot) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function action(service: ServiceStatus, verb: 'start' | 'stop' | 'restart' | 'reload') {
    setBusy(`${service.id}:${verb}`);
    setError('');
    try {
      await api.post(`/api/control/services/${service.id}/${verb}`, { code });
      const next = await api.get('/api/control/snapshot');
      onRefresh(next.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="panel full">
      <div className="panel-header">
        <h2>PM2 Services</h2>
        <div className="inline-field">
          <KeyRound size={16} />
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="2FA code" />
        </div>
      </div>
      {error && <div className="banner danger">{error}</div>}
      <div className="table-list">
        {(snapshot?.services || []).map((service) => (
          <div className="service-row" key={service.id}>
            <ServiceRow service={service} />
            <div className="row-actions">
              <button title="Start" onClick={() => action(service, 'start')} disabled={Boolean(busy)}><Play size={16} /></button>
              <button title="Restart" onClick={() => action(service, 'restart')} disabled={Boolean(busy)}><RotateCcw size={16} /></button>
              <button title="Stop" onClick={() => action(service, 'stop')} disabled={Boolean(busy)}><Square size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Logs({ socket, services }: { socket: Socket | null; services: ServiceStatus[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [lines, setLines] = useState('');

  useEffect(() => {
    if (!services.find((service) => service.id === serviceId)) {
      setServiceId(services[0]?.id || '');
    }
  }, [services, serviceId]);

  useEffect(() => {
    if (!socket || !serviceId) {
      return;
    }
    const handler = (payload: any) => {
      if (payload.serviceId === serviceId) {
        setLines((current) => `${current}${payload.output}`.slice(-24000));
      }
    };
    socket.on('services:logs', handler);
    socket.emit('services:logs', { serviceId });
    return () => {
      socket.off('services:logs', handler);
      socket.emit('services:logs:stop');
    };
  }, [socket, serviceId]);

  return (
    <section className="panel full logs-panel">
      <div className="panel-header">
        <h2>Live PM2 Logs</h2>
        <select value={serviceId} onChange={(event) => { setLines(''); setServiceId(event.target.value); }}>
          {services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
        </select>
      </div>
      <pre className="log-output">{lines || 'Waiting for log stream...'}</pre>
    </section>
  );
}

function TerminalView({ socket }: { socket: Socket | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('locked');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) {
      return;
    }
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, monospace',
      fontSize: 13,
      theme: { background: '#070b10', foreground: '#d8f3ff', cursor: '#4dd4ff' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    terminalRef.current = term;
    const resize = () => fit.fit();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!socket || !terminalRef.current || !sessionId) {
      return;
    }
    const term = terminalRef.current;
    const outputHandler = (payload: any) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.output);
      }
    };
    const exitHandler = (payload: any) => {
      if (payload.sessionId === sessionId) {
        term.writeln(`\r\n[session exited: ${payload.code}]`);
        setStatus('closed');
      }
    };
    const errorHandler = (payload: any) => {
      setError(payload?.message || 'Terminal error');
    };
    socket.on('terminal:output', outputHandler);
    socket.on('terminal:exit', exitHandler);
    socket.on('terminal:error', errorHandler);
    socket.emit('terminal:attach', { sessionId });
    const disposable = term.onData((input) => socket.emit('terminal:input', { sessionId, input }));
    return () => {
      disposable.dispose();
      socket.off('terminal:output', outputHandler);
      socket.off('terminal:exit', exitHandler);
      socket.off('terminal:error', errorHandler);
    };
  }, [socket, sessionId]);

  async function startSession() {
    setError('');
    const cols = terminalRef.current?.cols || 120;
    const rows = terminalRef.current?.rows || 32;
    try {
      const { data } = await api.post('/api/control/terminal/session', { code, cols, rows });
      setSessionId(data.id);
      setStatus('root');
      terminalRef.current?.clear();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }

  function killSession() {
    if (socket && sessionId) {
      socket.emit('terminal:kill', { sessionId });
    }
  }

  return (
    <section className="panel full terminal-panel">
      <div className="panel-header">
        <h2>Root Terminal</h2>
        <div className="terminal-actions">
          <span className={`status-chip ${status === 'root' ? 'danger-chip' : ''}`}>{status === 'root' ? 'ROOT MODE' : status}</span>
          <div className="inline-field">
            <KeyRound size={16} />
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="2FA code" />
          </div>
          <button className="command-button" onClick={startSession}><TerminalSquare size={16} /> Start</button>
          <button className="ghost-button" onClick={killSession}>Kill</button>
        </div>
      </div>
      {error && <div className="banner danger">{error}</div>}
      <div className="terminal-box" ref={containerRef} />
    </section>
  );
}

function JarvisView({ snapshot }: { snapshot: Snapshot | null }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState('Voice assistant ready.');
  const recognitionRef = useRef<any>(null);

  function speakJarvis(text: string) {
    if (!voiceReply || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const spokenText = text.replace(/[{}[\]"`*_#]/g, ' ').slice(0, 1300);
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'ro-RO';
    utterance.rate = 0.98;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  async function askJarvis(text = question, speak = false) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion) {
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/control/jarvis/action-plan', {
        question: cleanQuestion,
        context: {
          alerts: snapshot?.alerts,
          services: snapshot?.services?.map((item) => ({ id: item.id, status: item.status, restarts: item.restarts })),
        },
      });
      setAnswer(data.answer);
      if (speak) {
        speakJarvis(data.answer);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Jarvis nu a raspuns.';
      setAnswer(message);
      setVoiceStatus(message);
    } finally {
      setLoading(false);
    }
  }

  function startVoiceAssistant() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus('Speech recognition nu este disponibil in browserul curent.');
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ro-RO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus('Ascult...');
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      setVoiceStatus(`Voice error: ${event.error || 'unknown'}`);
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript.trim()) {
        setVoiceStatus('Nu am prins comanda, mai incearca o data.');
        return;
      }
      setQuestion(transcript);
      setVoiceStatus(`Ai spus: ${transcript}`);
      askJarvis(transcript, true);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopVoiceAssistant() {
    recognitionRef.current?.stop();
    setListening(false);
    setVoiceStatus('Voice assistant stopped.');
  }

  return (
    <section className="panel full jarvis-panel">
      <div className="voice-assistant">
        <div>
          <p className="eyebrow">Jarvis Voice Assistant</p>
          <h2>Control vocal pentru panel</h2>
          <span className={`status-pill ${listening ? 'playing' : 'draft'}`}>{listening ? 'LISTENING' : 'READY'}</span>
        </div>
        <div className="voice-actions">
          <button className="command-button" onClick={startVoiceAssistant} disabled={listening || loading}>
            <Mic size={17} /> Start voice
          </button>
          <button className="ghost-button" onClick={stopVoiceAssistant}>
            <MicOff size={17} /> Stop
          </button>
          <button className="ghost-button" onClick={() => setVoiceReply((current) => !current)}>
            <Volume2 size={17} /> {voiceReply ? 'Voice on' : 'Voice off'}
          </button>
        </div>
        <small>{voiceStatus}</small>
      </div>
      <div className="quick-actions">
        <button onClick={() => askJarvis('Diagnosticheaza erorile curente din servicii si spune ce ar trebui verificat prima data.')}>Diagnose current errors</button>
        <button onClick={() => askJarvis('Ce servicii par riscante acum si ce actiune recomanzi?')}>Suggest fix</button>
        <button onClick={() => askJarvis('Pregateste un plan de verificare pentru VPS, PM2, Nginx si Jarvis.')}>VPS checklist</button>
      </div>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Intreaba-l pe Jarvis despre VPS, boturi, PM2, loguri..." />
      <button className="primary-button" onClick={() => askJarvis()} disabled={loading || !question.trim()}>
        <MessageSquare size={17} />
        {loading ? 'Jarvis thinking...' : 'Ask Jarvis'}
      </button>
      <pre className="jarvis-answer">{answer || 'Jarvis responses will appear here.'}</pre>
    </section>
  );
}

function MetricsView({ snapshot }: { snapshot: Snapshot | null }) {
  const metrics = snapshot?.metrics;
  const processes = metrics?.processes || [];
  return (
    <section className="content-grid">
      <MetricCard label="Host" value={snapshot?.host?.hostname || '-'} detail={`${snapshot?.host?.platform || '-'} ${snapshot?.host?.release || ''}`} />
      <MetricCard label="Load" value={metrics?.cpu?.loadAverage?.map((item: number) => item.toFixed(2)).join(' / ') || '0'} detail={`${metrics?.cpu?.cores || 0} cores`} />
      <MetricCard label="RAM" value={`${metrics?.memory?.usagePercent || 0}%`} detail={`${formatBytes(metrics?.memory?.used || 0)} used`} />
      <MetricCard label="Disk" value={`${metrics?.disk?.usagePercent || 0}%`} detail={`${formatBytes(metrics?.disk?.free || 0)} free`} />
      <div className="panel wide">
        <div className="panel-header"><h2>Top processes</h2></div>
        <div className="table-list">
          {processes.map((process: any) => (
            <div className="process-row" key={`${process.pid}-${process.name}`}>
              <span>{process.pid}</span>
              <strong>{process.name}</strong>
              <span>{process.cpu}% CPU</span>
              <span>{process.memory}% RAM</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DomainsView({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <section className="content-grid">
      {(snapshot?.domains || []).map((domain) => (
        <div className="panel domain-card" key={domain.host}>
          <Globe2 size={22} />
          <h2>{domain.host}</h2>
          <p>{domain.target}</p>
          <span className="status-chip">{domain.status}</span>
        </div>
      ))}
    </section>
  );
}

function AuditView() {
  const [entries, setEntries] = useState<any[]>([]);
  const [twoFactor, setTwoFactor] = useState<any>(null);
  const [setup, setSetup] = useState<any>(null);
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/control/audit?limit=120').then((res) => setEntries(res.data));
    api.get('/api/control/2fa/status').then((res) => setTwoFactor(res.data));
  }, []);

  async function refreshTwoFactor() {
    const { data } = await api.get('/api/control/2fa/status');
    setTwoFactor(data);
  }

  async function beginTwoFactorSetup() {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post('/api/control/2fa/setup', {
        currentCode: currentCode || undefined,
      });
      setSetup(data);
      setQrCode(await QRCode.toDataURL(data.otpauthUri, { width: 220, margin: 1 }));
      setCode('');
      await refreshTwoFactor();
    } catch (error: any) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTwoFactor() {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post('/api/control/2fa/confirm', { code });
      setRecoveryCodes(data.recoveryCodes || []);
      setSetup(null);
      setQrCode('');
      setCode('');
      setCurrentCode('');
      await refreshTwoFactor();
    } catch (error: any) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableTwoFactor() {
    setBusy(true);
    setMessage('');
    try {
      await api.post('/api/control/2fa/disable', { code });
      setCode('');
      setRecoveryCodes([]);
      await refreshTwoFactor();
    } catch (error: any) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadRecoveryCodes() {
    const blobUrl = URL.createObjectURL(new Blob([
      `DominosLand Control Center - recovery codes\n\n${recoveryCodes.join('\n')}\n`,
    ], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'dominos-2fa-recovery-codes.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-header"><h2>Audit</h2></div>
        <div className="table-list">
          {entries.map((entry) => (
            <div className="audit-row" key={entry.id}>
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              <strong>{entry.username}</strong>
              <span>{entry.action}</span>
              <span>{entry.target}</span>
              <span className={entry.status === 'ok' ? 'ok-text' : 'danger-text'}>{entry.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel security-stack">
        <div className="panel-header">
          <h2>Two-factor</h2>
          <span className={twoFactor?.enabled ? 'status-chip' : 'status-chip warn'}>
            {twoFactor?.enabled ? 'ACTIVE' : 'OFF'}
          </span>
        </div>
        {message && <div className="banner danger">{message}</div>}
        {setup && qrCode && (
          <>
            <img className="totp-qr" src={qrCode} alt="DominosLand 2FA QR" />
            <code className="totp-secret">{setup.secret}</code>
          </>
        )}
        {twoFactor?.enabled && !setup && (
          <div className="inline-field">
            <KeyRound size={16} />
            <input value={currentCode} onChange={(event) => setCurrentCode(event.target.value)} placeholder="Current 2FA code" />
          </div>
        )}
        {!setup && (
          <button className="command-button" disabled={busy} onClick={beginTwoFactorSetup}>
            <ShieldCheck size={16} />
            {twoFactor?.enabled ? 'Replace authenticator' : 'Set up 2FA'}
          </button>
        )}
        {(setup || twoFactor?.enabled) && (
          <div className="inline-field">
            <KeyRound size={16} />
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit or recovery code" />
          </div>
        )}
        {setup && (
          <button className="command-button" disabled={busy || code.length < 6} onClick={confirmTwoFactor}>
            <CheckCircle2 size={16} /> Confirm
          </button>
        )}
        {twoFactor?.enabled && !setup && (
          <button className="ghost-button" disabled={busy || code.length < 6} onClick={disableTwoFactor}>
            <Lock size={16} /> Disable
          </button>
        )}
        {recoveryCodes.length > 0 && (
          <>
            <div className="recovery-codes">
              {recoveryCodes.map((item) => <code key={item}>{item}</code>)}
            </div>
            <button className="ghost-button" onClick={downloadRecoveryCodes}>
              <Download size={16} /> Recovery codes
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ServiceRow({ service, compact = false }: { service: ServiceStatus; compact?: boolean }) {
  return (
    <div className={compact ? 'service-card' : 'service-info'}>
      <div className={`dot ${service.status === 'online' ? 'online' : service.status === 'missing' ? 'missing' : 'offline'}`} />
      <div>
        <strong>{service.name}</strong>
        <small>{service.pm2Name} - {service.status} - {service.restarts} restarts</small>
      </div>
      {!compact && (
        <div className="service-metrics">
          <span>{service.cpu}% CPU</span>
          <span>{formatBytes(service.memory)}</span>
        </div>
      )}
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
