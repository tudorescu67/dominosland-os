/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Overlay-ul: fereastra mica deasupra jocului (Alt+J). Nu se injecteaza nimic in joc.
import { FormEvent, useEffect, useState } from 'react';
import { Bot, Camera, Radio, Send, Users, X } from 'lucide-react';
import { api, getAuthToken } from '../api';
import './shell.css';

interface LiveServer {
  id: string;
  name: string;
  gameType: string;
  players: number;
  maxPlayers: number;
}

export default function Overlay() {
  const [servers, setServers] = useState<LiveServer[]>([]);
  const [stream, setStream] = useState<StreamStatus | null>(null);
  const [replay, setReplay] = useState<ReplayStatus | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('overlay-mode');
    const load = () => {
      api.get('/api/site/stats').then(({ data }) => setServers((data?.servers?.list || []).slice(0, 5))).catch(() => {});
      window.dominosDesktop?.media?.streamStatus().then(setStream).catch(() => {});
      window.dominosDesktop?.media?.replayStatus().then(setReplay).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (!getAuthToken()) {
      setAnswer('Intra in cont in launcher ca sa vorbesti cu Jarvis.');
      return;
    }
    setAsking(true);
    try {
      const { data } = await api.post('/api/control/jarvis/ask', { question });
      setAnswer(data.answer);
      setQuestion('');
    } catch (error: any) {
      setAnswer(error?.response?.data?.message || 'Jarvis nu a raspuns.');
    } finally {
      setAsking(false);
    }
  };

  const clip = async () => {
    try {
      const saved = await window.dominosDesktop!.media!.saveClip();
      setNote(`Clip salvat (${saved.seconds}s)`);
    } catch (error: any) {
      setNote(String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  };

  return (
    <div className="overlay-root">
      <div className="overlay-head">
        <img src="./logo-dominos.svg" alt="" width={22} height={22} />
        DominosLand
        <button className="icon-only" onClick={() => window.dominosDesktop?.overlay?.toggle()} aria-label="Ascunde overlay"><X size={16} /></button>
      </div>

      <div className="overlay-section">
        <h3><Bot size={12} /> Jarvis</h3>
        {answer && <div className="overlay-answer">{answer}</div>}
        <form className="overlay-ask" onSubmit={ask}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={asking ? 'Jarvis se gandeste…' : 'Intreaba ceva…'} disabled={asking} maxLength={800} />
          <button className="launcher-button" type="submit" disabled={asking} aria-label="Trimite"><Send size={14} /></button>
        </form>
      </div>

      <div className="overlay-section">
        <h3><Users size={12} /> Servere live</h3>
        {servers.length ? servers.map((server) => (
          <div key={server.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</span>
            <span style={{ color: 'var(--dl-muted)' }}>{server.players}/{server.maxPlayers}</span>
          </div>
        )) : <span style={{ color: 'var(--dl-muted)' }}>Niciun server online.</span>}
      </div>

      <div className="overlay-section" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {stream?.live && <span className="state-pill on"><Radio size={12} /> LIVE {stream.destinations.join(', ')}</span>}
        <button className="launcher-button ghost" onClick={clip} disabled={!replay?.active}><Camera size={14} /> Salveaza clip</button>
        {note && <span style={{ color: 'var(--dl-muted)', fontSize: 12 }}>{note}</span>}
      </div>
    </div>
  );
}
