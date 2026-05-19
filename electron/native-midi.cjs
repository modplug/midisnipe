function createNativeMidiService() {
  return {
    describe() {
      return {
        id: "electron-web-midi",
        label: "Electron Web MIDI",
        status: "active",
        notes: [
          "Chromium Web MIDI is enabled with automatic MIDI and SysEx permission.",
          "The native adapter boundary is here for future CoreMIDI, WinMM, ALSA, or virtual-port support.",
        ],
      };
    },

    async listInputs() {
      return {
        backend: "electron-web-midi",
        inputs: [],
        note: "Renderer Web MIDI owns live input enumeration in this release.",
      };
    },
  };
}

module.exports = { createNativeMidiService };
