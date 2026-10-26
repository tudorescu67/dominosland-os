/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Canalele IPC pentru streaming, clipuri, diagnostic, Game Booster si overlay.
const { BrowserWindow, globalShortcut, ipcMain, Notification, screen, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const media = require('./media-engine.cjs');

/** Executabilele jocurilor pe care Game Booster le poate prioritiza (fara alte procese). */
const GAME_PROCESSES = ['cs2', 'hl', 'hl2', 'FiveM', 'FiveM_GTAProcess', 'GTA5', 'gta_sa', 'samp', 'metin2client', 'javaw', 'RustClient', 'Minecraft.Windows'];

let overlayWindow = null;

function boostGames(priority) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ supported: false, boosted: [] });
    const level = priority === 'normal' ? 'Normal' : 'High';
    // Doar procesele din lista de jocuri; prioritate "High" (nu "RealTime", care poate bloca sistemul).
    const script = `$n=@(${GAME_PROCESSES.map((name) => `'${name}'`).join(',')}); Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object { try { $_.PriorityClass='${level}'; $_.ProcessName } catch {} }`;
    execFile('powershell', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15_000 }, (error, stdout) => {
      resolve({ supported: true, boosted: String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean) });
    });
  });
}

function toggleOverlay(loadUrl) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.showInactive();
    return overlayWindow.isVisible();
  }
  // Fereastra separata, mereu deasupra (nu se injecteaza nimic in joc). Merge peste jocurile in
  // modul "borderless / windowed fullscreen"; in fullscreen exclusiv Windows nu permite ferestre deasupra.
  const area = screen.getPrimaryDisplay().workArea;
  overlayWindow = new BrowserWindow({
    width: 380,
    height: 540,
    x: area.x + area.width - 400,
    y: area.y + 40,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true);
  loadUrl(overlayWindow, '#/overlay');
  overlayWindow.once('ready-to-show', () => overlayWindow && overlayWindow.showInactive());
  overlayWindow.on('closed', () => { overlayWindow = null; });
  return true;
}

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
}

/**
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 * @param {(event: Electron.IpcMainInvokeEvent) => void} assertSender verifica fereastra care cere
 * @param {(win: Electron.BrowserWindow, hash: string) => void} loadUrl
 */
function registerMediaIpc(getMainWindow, assertSender, loadUrl) {
  const handle = (channel, fn) => ipcMain.handle(channel, async (event, ...args) => {
    assertSender(event);
    return fn(...args);
  });

  handle('media:capabilities', async () => ({ encoders: await media.detectEncoders(), audio: await media.listAudioDevices() }));
  handle('stream:start', (options) => media.startStream(options || {}));
  handle('stream:stop', () => media.stopStream());
  handle('stream:status', () => media.streamStatus());
  handle('replay:start', (options) => media.startReplay(options || {}));
  handle('replay:stop', () => media.stopReplay());
  handle('replay:status', () => media.replayStatus());
  handle('replay:save', () => media.saveClip());
  handle('clips:list', () => media.listClips());
  handle('clips:open-folder', () => shell.openPath(media.replayStatus().clipsDir));
  handle('clips:show', (file) => {
    const clip = media.listClips().find((item) => item.path === file);
    if (!clip) throw new Error('Clip necunoscut.');
    shell.showItemInFolder(clip.path);
    return true;
  });
  handle('diag:network', (host) => media.networkTest(host));
  handle('diag:system', () => media.systemInfo());
  handle('booster:priority', (level) => boostGames(level === 'normal' ? 'normal' : 'high'));
  handle('overlay:toggle', () => toggleOverlay(loadUrl));

  // Scurtaturi globale (functioneaza si cand jocul are focus): Alt+F10 = clip, Alt+J = overlay.
  globalShortcut.register('Alt+F10', async () => {
    try {
      const clip = await media.saveClip();
      notify('Clip salvat', `${clip.seconds} secunde · ${path.basename(clip.path)}`);
      getMainWindow()?.webContents.send('clips:saved', clip);
    } catch (error) {
      notify('Clip nesalvat', String(error.message || error));
    }
  });
  globalShortcut.register('Alt+J', () => toggleOverlay(loadUrl));
}

function shutdownMedia() {
  globalShortcut.unregisterAll();
  media.shutdown();
  boostGames('normal');
}

module.exports = { registerMediaIpc, shutdownMedia, isOverlayWindow: (event) => Boolean(overlayWindow && !overlayWindow.isDestroyed() && event.sender.id === overlayWindow.webContents.id) };
