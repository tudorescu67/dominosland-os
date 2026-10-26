/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dominosDesktop', {
  platform: process.platform,
  versions: process.versions,
  secureStore: {
    get: (key) => ipcRenderer.invoke('secure-store:get', key),
    set: (key, value) => ipcRenderer.invoke('secure-store:set', key, value),
    delete: (key) => ipcRenderer.invoke('secure-store:delete', key),
  },
  launcher: {
    open: (url) => ipcRenderer.invoke('launcher:open', url),
    power: (action) => ipcRenderer.invoke('launcher:power', action),
    saveText: (name, content) => ipcRenderer.invoke('launcher:save-text', name, content),
  },
  media: {
    capabilities: () => ipcRenderer.invoke('media:capabilities'),
    startStream: (options) => ipcRenderer.invoke('stream:start', options),
    stopStream: () => ipcRenderer.invoke('stream:stop'),
    streamStatus: () => ipcRenderer.invoke('stream:status'),
    startReplay: (options) => ipcRenderer.invoke('replay:start', options),
    stopReplay: () => ipcRenderer.invoke('replay:stop'),
    replayStatus: () => ipcRenderer.invoke('replay:status'),
    saveClip: () => ipcRenderer.invoke('replay:save'),
    listClips: () => ipcRenderer.invoke('clips:list'),
    openClipsFolder: () => ipcRenderer.invoke('clips:open-folder'),
    showClip: (file) => ipcRenderer.invoke('clips:show', file),
    onClipSaved: (callback) => {
      const listener = (_event, clip) => callback(clip);
      ipcRenderer.on('clips:saved', listener);
      return () => ipcRenderer.removeListener('clips:saved', listener);
    },
  },
  diagnostics: {
    network: (host) => ipcRenderer.invoke('diag:network', host),
    system: () => ipcRenderer.invoke('diag:system'),
  },
  booster: {
    priority: (level) => ipcRenderer.invoke('booster:priority', level),
  },
  overlay: {
    toggle: () => ipcRenderer.invoke('overlay:toggle'),
  },
  downloads: {
    saveFromApi: (url, suggestedName) => ipcRenderer.invoke('download:api', url, suggestedName),
  },
});
