/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
const { app, BrowserWindow, dialog, ipcMain, net, safeStorage, shell } = require('electron');
const fs = require('fs');
const { promises: fsPromises } = fs;
const path = require('path');
const { execFile } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { registerMediaIpc, shutdownMedia, isOverlayWindow } = require('./media-ipc.cjs');

// streamDestinations = cheile de stream (RTMP), salvate criptat ca tokenul de login.
const SECURE_KEYS = new Set(['authToken', 'streamDestinations']);
const volatileSecureStore = new Map();
let mainWindow = null;

function secureStorePath() {
  return path.join(app.getPath('userData'), 'secure-store.json');
}

function assertTrustedSender(event) {
  // Fereastra principala sau overlay-ul (acelasi cod al aplicatiei, incarcat local).
  if ((!mainWindow || event.sender.id !== mainWindow.webContents.id) && !isOverlayWindow(event)) {
    throw new Error('IPC sender rejected');
  }
}

function hasSecureStorage() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

async function readSecureStore() {
  try {
    return JSON.parse(await fsPromises.readFile(secureStorePath(), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeSecureStore(store) {
  const target = secureStorePath();
  const temporary = `${target}.${process.pid}.tmp`;
  await fsPromises.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fsPromises.writeFile(temporary, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 });
  await fsPromises.rename(temporary, target);
  await fsPromises.chmod(target, 0o600).catch(() => {});
}

function assertDownloadUrl(rawUrl) {
  const url = new URL(rawUrl);
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  const trustedHost = url.hostname === 'dominosland.com' || url.hostname.endsWith('.dominosland.com');
  if ((!trustedHost && !local) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('Download host rejected');
  }
  if (!/^\/api\/control\/media\/[a-zA-Z0-9_.:-]+\/download$/.test(url.pathname)) {
    throw new Error('Download path rejected');
  }
  return url.toString();
}

function safeFileName(value) {
  const cleaned = String(value || 'dominos-download.bin')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .slice(0, 180);
  return cleaned || 'dominos-download.bin';
}

// Launcher: doar protocoale de jocuri si domenii cunoscute pot fi deschise din renderer.
const GAME_PROTOCOL = /^(steam:\/\/(rungameid|run|connect)\/[\w.:\/-]{1,120}|fivem:\/\/connect\/[\w.:-]{1,120}|samp:\/\/[\w.:-]{1,120}|com\.epicgames\.launcher:\/\/apps\/[\w%.:-]{1,160}\?action=launch&silent=true)$/;
const TRUSTED_WEB_HOSTS = [
  'dominosland.com', 'dominosland.com', 'steamcommunity.com', 'store.steampowered.com', 'epicgames.com', 'twitch.tv',
  'discord.com', 'discord.gg', 'login.microsoftonline.com', 'battle.net', 'wireguard.com',
];
const HIGH_PERFORMANCE_PLAN = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
let previousPowerPlan = null;

function isTrustedLauncherUrl(rawUrl) {
  const value = String(rawUrl || '');
  if (GAME_PROTOCOL.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return TRUSTED_WEB_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function powercfg(args) {
  return new Promise((resolve, reject) => {
    execFile('powercfg', args, { windowsHide: true, timeout: 10_000 }, (error, stdout) => (error ? reject(error) : resolve(String(stdout))));
  });
}

async function activePowerPlan() {
  const output = await powercfg(['/getactivescheme']);
  const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0].toLowerCase() : null;
}

function registerIpcHandlers() {
  ipcMain.handle('launcher:open', async (event, rawUrl) => {
    assertTrustedSender(event);
    if (!isTrustedLauncherUrl(rawUrl)) throw new Error('URL rejected');
    await shell.openExternal(String(rawUrl));
    return true;
  });

  // Game Booster: planul "High performance" cat timp e activ, apoi revenire la planul anterior.
  ipcMain.handle('launcher:power', async (event, action) => {
    assertTrustedSender(event);
    if (process.platform !== 'win32') return { supported: false, active: false };
    const current = await activePowerPlan().catch(() => null);
    if (action === 'status') return { supported: true, active: current === HIGH_PERFORMANCE_PLAN };
    if (action === 'boost') {
      if (current !== HIGH_PERFORMANCE_PLAN) previousPowerPlan = current;
      try {
        await powercfg(['/setactive', HIGH_PERFORMANCE_PLAN]);
      } catch {
        return { supported: false, active: false, reason: 'Planul High performance nu exista pe acest PC.' };
      }
      return { supported: true, active: true };
    }
    if (action === 'restore') {
      if (previousPowerPlan && previousPowerPlan !== HIGH_PERFORMANCE_PLAN) await powercfg(['/setactive', previousPowerPlan]).catch(() => {});
      previousPowerPlan = null;
      return { supported: true, active: (await activePowerPlan().catch(() => null)) === HIGH_PERFORMANCE_PLAN };
    }
    throw new Error('Power action rejected');
  });

  // Salvare profil WireGuard (.conf) primit de la API; continutul nu trece prin disc temporar.
  ipcMain.handle('launcher:save-text', async (event, suggestedName, content) => {
    assertTrustedSender(event);
    if (typeof content !== 'string' || content.length > 65_536 || !/^[\w.-]{1,80}\.conf$/.test(String(suggestedName))) {
      throw new Error('File rejected');
    }
    const selected = await dialog.showSaveDialog(mainWindow, {
      title: 'Salveaza profilul VPN DominosLand',
      defaultPath: path.join(app.getPath('documents'), String(suggestedName)),
      filters: [{ name: 'WireGuard', extensions: ['conf'] }],
    });
    if (selected.canceled || !selected.filePath) return { saved: false };
    await fsPromises.writeFile(selected.filePath, content, { encoding: 'utf8', mode: 0o600 });
    return { saved: true, path: selected.filePath };
  });

  ipcMain.handle('secure-store:get', async (event, key) => {
    assertTrustedSender(event);
    if (!SECURE_KEYS.has(key)) throw new Error('Secure key rejected');
    if (!hasSecureStorage()) return volatileSecureStore.get(key) || null;
    const store = await readSecureStore();
    if (!store[key]) return null;
    return safeStorage.decryptString(Buffer.from(store[key], 'base64'));
  });

  ipcMain.handle('secure-store:set', async (event, key, value) => {
    assertTrustedSender(event);
    if (!SECURE_KEYS.has(key) || typeof value !== 'string' || value.length > 16_384) {
      throw new Error('Secure value rejected');
    }
    if (!hasSecureStorage()) {
      volatileSecureStore.set(key, value);
      return false;
    }
    const store = await readSecureStore();
    store[key] = safeStorage.encryptString(value).toString('base64');
    await writeSecureStore(store);
    return true;
  });

  ipcMain.handle('secure-store:delete', async (event, key) => {
    assertTrustedSender(event);
    if (!SECURE_KEYS.has(key)) throw new Error('Secure key rejected');
    volatileSecureStore.delete(key);
    if (!hasSecureStorage()) return true;
    const store = await readSecureStore();
    delete store[key];
    await writeSecureStore(store);
    return true;
  });

  ipcMain.handle('download:api', async (event, rawUrl, suggestedName) => {
    assertTrustedSender(event);
    const url = assertDownloadUrl(rawUrl);
    let token = volatileSecureStore.get('authToken') || null;
    if (hasSecureStorage()) {
      const store = await readSecureStore();
      if (store.authToken) {
        token = safeStorage.decryptString(Buffer.from(store.authToken, 'base64'));
      }
    }
    if (!token) throw new Error('Authentication token unavailable');
    const selected = await dialog.showSaveDialog(mainWindow, {
      title: 'Salveaza fisierul DominosLand',
      defaultPath: path.join(app.getPath('downloads'), safeFileName(suggestedName)),
    });
    if (selected.canceled || !selected.filePath) return { saved: false };

    const temporary = `${selected.filePath}.${process.pid}.part`;
    try {
      const response = await net.fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with HTTP ${response.status}`);
      }
      await pipeline(
        Readable.fromWeb(response.body),
        fs.createWriteStream(temporary, { flags: 'w', mode: 0o600 }),
      );
      await fsPromises.rename(temporary, selected.filePath);
      return { saved: true, path: selected.filePath };
    } catch (error) {
      await fsPromises.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  });
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(__dirname, '..', 'dist', 'icon.png')
    : path.join(__dirname, '..', 'public', 'icon.png');

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'DominosLand Launcher',
    icon: iconPath,
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadApp(win, '');
}

/** Incarca interfata (build-ul local sau serverul Vite in dezvoltare), optional cu o ruta #/... */
function loadApp(win, hash) {
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash: hash.replace(/^#/, '') } : undefined);
  } else {
    win.loadURL(`${process.env.DESKTOP_DEV_URL || 'http://127.0.0.1:5178'}/${hash || ''}`);
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  registerMediaIpc(() => mainWindow, assertTrustedSender, loadApp);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  shutdownMedia();
  // Nu lasam PC-ul blocat pe High performance daca launcher-ul se inchide cu boost activ.
  if (process.platform === 'win32' && previousPowerPlan) execFile('powercfg', ['/setactive', previousPowerPlan], { windowsHide: true }, () => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
