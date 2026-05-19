# Midisnipe

A MIDI diagnostic console built with Next.js, Tailwind, shadcn/ui, and Electron.

Use the hosted web app for quick QR/link debugging, or install the desktop app when you need a local utility with native save dialogs and a path toward deeper OS MIDI integration.

## What It Does

- Requests Web MIDI access from the browser.
- Lists MIDI inputs and outputs with connection state.
- Captures live MIDI messages from selected inputs.
- Decodes notes, CC, pitch bend, program change, pressure, system, and SysEx messages.
- Filters by source, message type, channel, CC number, and text search.
- Tracks channel activity, recent CC values, held notes, and diagnostics.
- Flags common live-rig problems such as release-to-zero controls, CC 1 modulation, CC 7 volume, and CC 11 expression.
- Exports or copies visible logs.
- Packages as a desktop app for macOS, Windows, and Linux.

## Browser Support

Use desktop Chrome or Edge. Web MIDI requires `https://` or `localhost`.

Safari, Firefox, and iOS browsers are not reliable targets for this tool.

## Desktop App

Desktop builds are published from GitHub releases:

https://github.com/modplug/midisnipe/releases/latest

The current desktop app runs the same console UI in Electron, grants MIDI/SysEx permission in-app, and uses a native save dialog for exports.

The native MIDI adapter boundary lives in `electron/native-midi.cjs`; see `docs/desktop-roadmap.md` for the planned CoreMIDI, WinMM, ALSA/JACK, virtual-port, and output-monitor work.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run the Electron app against the local dev server:

```bash
npm run dev:electron
```

Build a local desktop package:

```bash
npm run dist
```

## Production

This app is static-friendly and can be deployed to Vercel, Netlify, or any HTTPS host. Users must open the site on the computer where the MIDI device is connected.

GitHub Actions builds macOS, Windows, and Linux desktop installers when a `v*` tag is pushed, or when the release workflow is run manually.
