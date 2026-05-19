const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("midisnipeDesktop", {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke("midisnipe:desktop-info"),
  listNativeInputs: () => ipcRenderer.invoke("midisnipe:list-native-inputs"),
  saveLog: (text) => ipcRenderer.invoke("midisnipe:save-log", { text }),
});
