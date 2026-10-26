/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import { Bot, Coins, Gamepad2, Link2, Rocket, ShieldCheck, Smartphone, Users, Zap } from 'lucide-react';
import { API_BASE, api, getAuthToken } from '../api';
import { startSavedReplay, startSavedStream } from './GamerTools';
import './launcher.css';

interface SiteStats {
  servers: { total: number; online: number; players: number; slots: number; byGame: Record<string, { servers: number; online: number; players: number }> };
  games: { supported: number };
  plans: { active: number; currency: string };
  creators: { live: number };
  partners: number;
  jarvis: { online: boolean; localConnected: boolean; providers: Array<{ id: string; keys: number; available: number }> };
}

interface Wallet {
  balance: number;
  membership?: { planId: string; expiresAt?: string | null; plan?: { name: string; limits?: Record<string, any> } };
}

interface GameServer {
  id: string;
  name: string;
  gameType: string;
  ip: string;
  port: number;
  status: string;
  onlinePlayers: number;
  maxPlayers: number;
}

interface SteamGame {
  appId: number;
  name: string;
  hours: number;
  icon: string | null;
  launchUrl: string;
}

interface Provider {
  id: string;
  label: string;
  configured: boolean;
}

interface Linked {
  provider: string;
  displayName: string | null;
}

interface Partner {
  id: string;
  name: string;
  game: string | null;
  connect: string | null;
  discord_invite: string | null;
  subdomain: string | null;
  accent_color: string | null;
}

const PROVIDER_LABELS: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude', github: 'GitHub Models' };
const STEAM_GAMES = new Set(['cs2', 'cs16', 'csgo', 'rust', 'ark', 'valheim', 'project-zomboid']);

/** Link-ul de conectare direct in joc; null = doar copiem adresa (Minecraft, Metin2). */
export function connectUrl(server: Pick<GameServer, 'gameType' | 'ip' | 'port'>) {
  const address = `${server.ip}:${server.port}`;
  if (!/^[\w.-]+:\d{2,5}$/.test(address)) return null;
  if (server.gameType === 'fivem') return `fivem://connect/${address}`;
  if (server.gameType === 'samp') return `samp://${address}`;
  if (STEAM_GAMES.has(server.gameType)) return `steam://connect/${address}`;
  return null;
}

function openExternal(url: string) {
  if (window.dominosDesktop?.launcher) return window.dominosDesktop.launcher.open(url);
  window.open(url, '_blank', 'noopener');
  return Promise.resolve(true);
}

function errorText(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function LauncherHome() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [games, setGames] = useState<SteamGame[] | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [linked, setLinked] = useState<Linked[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accent, setAccent] = useState('#7c5cff');
  const [boost, setBoost] = useState<{ supported: boolean; active: boolean; reason?: string }>({ supported: false, active: false });
  const [pairing, setPairing] = useState<{ code: string; qr: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get('/api/site/stats'),
      api.get('/api/wallet'),
      api.get('/api/servers'),
      api.get('/api/accounts/providers'),
      api.get('/api/accounts/linked'),
      api.get('/api/site/settings'),
    ]);
    const [statsRes, walletRes, serversRes, providersRes, linkedRes, settingsRes] = results;
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data);
    if (serversRes.status === 'fulfilled') {
      const data = serversRes.value.data;
      setServers(Array.isArray(data) ? data : data?.items || data?.servers || []);
    }
    if (providersRes.status === 'fulfilled') setProviders(providersRes.value.data.providers || []);
    if (linkedRes.status === 'fulfilled') setLinked(linkedRes.value.data.accounts || []);
    if (settingsRes.status === 'fulfilled') {
      const settings = settingsRes.value.data;
      if (/^#[0-9a-f]{6}$/i.test(settings?.theme?.accent_color || '')) setAccent(settings.theme.accent_color);
      setPartners(settings?.partners || []);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    window.dominosDesktop?.launcher?.power('status').then(setBoost).catch(() => {});
    return () => window.clearInterval(timer);
  }, [load]);

  const limits = wallet?.membership?.plan?.limits || {};

  // Remote Link: launcher-ul asculta comenzile telefonului imperecheat (namespace /remote)
  // si ii trimite inapoi starea reala a PC-ului (live, replay, boost).
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem('dominosRemoteDevice'));
  const remoteState = useRef({ boost: false, plan: 'free' });
  remoteState.current = { boost: boost.active, plan: wallet?.membership?.planId || 'free' };

  useEffect(() => {
    if (!deviceId) return undefined;
    const base = String(api.defaults.baseURL || API_BASE).replace(/\/$/, '');
    const socket = io(`${base}/remote`, { auth: { token: getAuthToken(), role: 'desktop', deviceId }, transports: ['websocket', 'polling'] });
    const media = window.dominosDesktop?.media;

    const snapshot = async (extra: Record<string, unknown> = {}) => {
      const [stream, replay] = await Promise.all([
        media?.streamStatus().catch(() => null),
        media?.replayStatus().catch(() => null),
      ]);
      return {
        ...extra,
        media: Boolean(media),
        stream: stream ? { live: stream.live, uptimeSec: stream.uptimeSec, destinations: stream.destinations, encoder: stream.encoder || null } : null,
        replay: replay ? { active: replay.active, seconds: replay.seconds } : null,
        boost: remoteState.current.boost,
        plan: remoteState.current.plan,
      };
    };

    const run = async (action: string, args: Record<string, any>) => {
      if (action === 'game.launch' && typeof args?.url === 'string') {
        await openExternal(args.url);
        return 'Jocul porneste pe PC.';
      }
      if (action === 'status.refresh') {
        await load();
        return '';
      }
      if (!media) throw new Error('Comanda merge doar in aplicatia desktop.');
      if (action === 'stream.start') return (await startSavedStream(), 'Live pornit.');
      if (action === 'stream.stop') return (await media.stopStream(), 'Live oprit.');
      if (action === 'replay.start') return (await startSavedReplay(), 'Replay buffer pornit.');
      if (action === 'replay.stop') return (await media.stopReplay(), 'Replay buffer oprit.');
      if (action === 'clip.save') return `Clip salvat (${(await media.saveClip()).seconds} secunde).`;
      throw new Error(`Comanda ${action} nu e disponibila pe acest PC.`);
    };

    socket.on('connect', () => {
      void snapshot().then((status) => socket.emit('remote:status', status));
    });
    socket.on('remote:paired', ({ deviceName }) => {
      setPairing(null);
      setMessage(`Telefon conectat la ${deviceName}.`);
      void snapshot().then((status) => socket.emit('remote:status', status));
    });
    socket.on('remote:unpaired', () => {
      localStorage.removeItem('dominosRemoteDevice');
      setDeviceId(null);
      setMessage('Telefonul a fost deconectat de la acest PC.');
    });
    socket.on('remote:command', async ({ action, args }: { action: string; args: Record<string, any> }) => {
      let ok = true;
      let result = '';
      try {
        result = await run(action, args || {});
      } catch (error) {
        ok = false;
        result = errorText(error, 'Comanda a esuat.').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      }
      if (result) setMessage(`Telefon: ${result}`);
      socket.emit('remote:status', await snapshot({ action, ok, message: result }));
    });
    return () => {
      socket.disconnect();
    };
  }, [deviceId, load]);
  const steamLinked = linked.some((item) => item.provider === 'steam');

  useEffect(() => {
    if (!steamLinked || games) return;
    api.get('/api/accounts/steam/games').then(({ data }) => setGames(data.games || [])).catch(() => setGames([]));
  }, [steamLinked, games]);

  const onlineServers = useMemo(() => servers.filter((server) => server.status === 'online'), [servers]);

  async function play(server: GameServer) {
    const url = connectUrl(server);
    if (url) {
      await openExternal(url).catch((error) => setMessage(errorText(error, 'Nu am putut porni jocul.')));
      return;
    }
    await navigator.clipboard.writeText(`${server.ip}:${server.port}`).catch(() => {});
    setMessage(`Adresa ${server.ip}:${server.port} a fost copiata. Lipeste-o in joc (Multiplayer → Direct connect).`);
  }

  async function toggleBoost() {
    if (!window.dominosDesktop?.launcher) return setMessage('Game Booster functioneaza doar in aplicatia desktop.');
    if (!limits.network_optimizer) return setMessage('Game Booster este inclus in planurile cu Network Optimizer. Vezi planurile pe site.');
    setBusy('boost');
    try {
      const next = await window.dominosDesktop.launcher.power(boost.active ? 'restore' : 'boost');
      setBoost(next);
      setMessage(next.reason || (next.active ? 'Game Booster activ: plan de energie High performance.' : 'Planul de energie anterior a fost restaurat.'));
    } catch (error) {
      setMessage(errorText(error, 'Nu am putut schimba planul de energie.'));
    } finally {
      setBusy('');
    }
  }

  async function downloadVpn() {
    setBusy('vpn');
    try {
      const { data } = await api.post('/api/vpn/profile');
      if (window.dominosDesktop?.launcher) {
        const saved = await window.dominosDesktop.launcher.saveText(data.fileName, data.config);
        setMessage(saved.saved ? `Profil salvat. Importa-l in WireGuard (Import tunnel from file): ${saved.path}` : 'Salvare anulata.');
      } else {
        setMessage('Profilul VPN se descarca doar din aplicatia desktop.');
      }
    } catch (error) {
      setMessage(errorText(error, 'Profilul VPN nu a putut fi generat.'));
    } finally {
      setBusy('');
    }
  }

  async function linkAccount(provider: string) {
    try {
      const { data } = await api.post(`/api/accounts/link/${provider}?return=launcher`);
      await openExternal(data.url);
      setMessage('Termina conectarea in browser; lista se actualizeaza automat.');
    } catch (error) {
      setMessage(errorText(error, 'Conectarea nu a putut porni.'));
    }
  }

  async function startPairing() {
    setBusy('pair');
    try {
      const { data } = await api.post('/api/mobile/remote-link/pair', { deviceName: `${window.dominosDesktop?.platform || 'PC'} launcher` });
      const qr = await QRCode.toDataURL(data.qr, { margin: 1, width: 220, color: { dark: '#0d0f14', light: '#ffffff' } });
      setPairing({ code: data.code, qr, expiresAt: data.expiresAt });
      localStorage.setItem('dominosRemoteDevice', data.deviceId);
      setDeviceId(data.deviceId);
    } catch (error) {
      setMessage(errorText(error, 'Codul Remote Link nu a putut fi generat.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="launcher" style={{ ['--launcher-accent' as any]: accent }}>
      <header className="launcher-hero">
        <div>
          <p className="launcher-eyebrow">DominosLand Launcher</p>
          <h1>Joaca, urmareste si controleaza totul dintr-un loc.</h1>
          <p className="launcher-muted">
            {stats ? `${stats.servers.online} servere online • ${stats.servers.players} jucatori acum • ${stats.games.supported} jocuri suportate` : 'Se incarca statisticile...'}
          </p>
        </div>
        <div className="launcher-plan">
          <span className="launcher-plan-name">{wallet?.membership?.plan?.name || 'Free'}</span>
          <span className="launcher-coins"><Coins size={16} /> {wallet ? wallet.balance.toLocaleString('ro-RO') : '—'} Dominos Coins</span>
          {wallet?.membership?.expiresAt && <small>expira {new Date(wallet.membership.expiresAt).toLocaleDateString('ro-RO')}</small>}
        </div>
      </header>

      {message && <div className="launcher-toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Inchide">×</button></div>}

      <div className="launcher-stats">
        <Stat icon={<Gamepad2 size={18} />} label="Servere online" value={stats ? `${stats.servers.online}/${stats.servers.total}` : '—'} />
        <Stat icon={<Users size={18} />} label="Jucatori" value={stats ? `${stats.servers.players}/${stats.servers.slots}` : '—'} />
        <Stat icon={<Bot size={18} />} label="Jarvis" value={stats ? (stats.jarvis.online ? 'online' : 'offline') : '—'} tone={stats?.jarvis.online ? 'ok' : 'bad'} />
        <Stat icon={<Zap size={18} />} label="Credite AI / luna" value={limits.ai_credits !== undefined ? String(limits.ai_credits) : '—'} />
      </div>

      <div className="launcher-grid">
        <article className="launcher-card span-2">
          <h2><Rocket size={18} /> Servere DominosLand</h2>
          {onlineServers.length ? (
            <ul className="launcher-list">
              {onlineServers.map((server) => (
                <li key={server.id}>
                  <span className="launcher-dot ok" />
                  <div className="launcher-list-main">
                    <strong>{server.name}</strong>
                    <small>{server.gameType.toUpperCase()} • {server.onlinePlayers}/{server.maxPlayers} jucatori</small>
                  </div>
                  <button className="launcher-play" onClick={() => play(server)}>{connectUrl(server) ? 'Joaca' : 'Copiaza IP'}</button>
                </li>
              ))}
            </ul>
          ) : <p className="launcher-muted">Niciun server online acum.</p>}
        </article>

        <article className="launcher-card">
          <h2><Bot size={18} /> Statistici AI</h2>
          {stats?.jarvis.providers.length ? (
            <ul className="launcher-bars">
              {stats.jarvis.providers.map((provider) => {
                const pct = provider.keys ? Math.round((provider.available / provider.keys) * 100) : 0;
                return (
                  <li key={provider.id}>
                    <div><span>{PROVIDER_LABELS[provider.id] || provider.id}</span><small>{provider.available}/{provider.keys} chei libere</small></div>
                    <meter min={0} max={100} low={34} high={67} optimum={100} value={pct} aria-label={`${provider.id} disponibil ${pct}%`} />
                  </li>
                );
              })}
            </ul>
          ) : <p className="launcher-muted">{stats?.jarvis.localConnected ? 'Jarvis ruleaza pe modelul local.' : 'Niciun provider AI configurat.'}</p>}
          <p className="launcher-muted small">Modele de top: {limits.top_ai_models ? 'incluse in planul tau' : 'disponibile in planurile VIP'}.</p>
        </article>

        <article className="launcher-card span-2">
          <h2><Gamepad2 size={18} /> Biblioteca mea</h2>
          {!steamLinked && <p className="launcher-muted">Conecteaza Steam ca sa vezi aici jocurile tale si sa le pornesti direct.</p>}
          {steamLinked && games === null && <p className="launcher-muted">Se incarca jocurile Steam...</p>}
          {games && games.length > 0 && (
            <div className="launcher-games">
              {games.slice(0, 24).map((game) => (
                <button key={game.appId} className="launcher-game" onClick={() => openExternal(game.launchUrl)} title={`${game.name} • ${game.hours} h`}>
                  {game.icon ? <img src={game.icon} alt="" referrerPolicy="no-referrer" /> : <span>🎮</span>}
                  <strong>{game.name}</strong>
                  <small>{game.hours} h</small>
                </button>
              ))}
            </div>
          )}
          {games && games.length === 0 && steamLinked && <p className="launcher-muted">Nu vedem jocuri: seteaza „Game details” pe public in Steam.</p>}
        </article>

        <article className="launcher-card">
          <h2><Link2 size={18} /> Conturi conectate</h2>
          <ul className="launcher-accounts">
            {providers.map((provider) => {
              const account = linked.find((item) => item.provider === provider.id);
              return (
                <li key={provider.id}>
                  <span>{provider.label}</span>
                  {account ? <small className="ok">{account.displayName || 'conectat'}</small>
                    : provider.configured ? <button className="launcher-link" onClick={() => linkAccount(provider.id)}>Conecteaza</button>
                      : <small>indisponibil</small>}
                </li>
              );
            })}
          </ul>
        </article>

        <article className="launcher-card">
          <h2><Zap size={18} /> Game Booster</h2>
          <p className="launcher-muted">Comuta Windows pe planul de energie High performance cat joci; la oprire (sau la inchiderea launcher-ului) revine la planul tau.</p>
          <button className={`launcher-toggle${boost.active ? ' on' : ''}`} onClick={toggleBoost} disabled={busy === 'boost'}>
            {boost.active ? 'Boost activ — opreste' : 'Porneste boost'}
          </button>
          {!limits.network_optimizer && <p className="launcher-muted small">Inclus in planurile Premium si VIP.</p>}
        </article>

        <article className="launcher-card">
          <h2><ShieldCheck size={18} /> Dominos VPN</h2>
          <p className="launcher-muted">Tunel WireGuard prin serverul DominosLand. Primesti un profil personal; cheia privata nu ramane pe server.</p>
          <button className="launcher-play" onClick={downloadVpn} disabled={busy === 'vpn' || !limits.vpn}>Descarca profilul</button>
          {!limits.vpn && <p className="launcher-muted small">VPN-ul este inclus in planul VIP.</p>}
          <button className="launcher-link" onClick={() => openExternal('https://www.wireguard.com/install/')}>Instaleaza WireGuard</button>
        </article>

        <article className="launcher-card">
          <h2><Smartphone size={18} /> Remote Link</h2>
          {pairing ? (
            <div className="launcher-pair">
              <img src={pairing.qr} alt={`Cod de imperechere ${pairing.code}`} />
              <strong>{pairing.code}</strong>
              <small>Scaneaza din aplicatia mobila. Expira la {new Date(pairing.expiresAt).toLocaleTimeString('ro-RO')}.</small>
            </div>
          ) : (
            <>
              <p className="launcher-muted">Controleaza muzica, stream-ul si jocurile de pe telefon.</p>
              <button className="launcher-play" onClick={startPairing} disabled={busy === 'pair'}>Genereaza cod QR</button>
            </>
          )}
        </article>

        {partners.length > 0 && (
          <article className="launcher-card span-3">
            <h2><Users size={18} /> Comunitati partenere</h2>
            <div className="launcher-partners">
              {partners.map((partner) => (
                <div key={partner.id} className="launcher-partner" style={partner.accent_color ? { borderColor: partner.accent_color } : undefined}>
                  <strong>{partner.name}</strong>
                  <small>{partner.game || 'comunitate'}{partner.connect ? ` • ${partner.connect}` : ''}</small>
                  <div>
                    {partner.discord_invite && <button className="launcher-link" onClick={() => openExternal(partner.discord_invite as string)}>Discord</button>}
                    {partner.subdomain && <button className="launcher-link" onClick={() => openExternal(`https://${partner.subdomain}`)}>Site</button>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>
      <footer className="launcher-footer">© 2026-2027 DominosLand by Capitanul Burcea-Alex.</footer>
    </section>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="launcher-stat">
      <span className="launcher-stat-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong className={tone || ''}>{value}</strong>
      </div>
    </div>
  );
}
