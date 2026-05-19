# Midisnipe Desktop Roadmap

Midisnipe now has two delivery targets that share the same UI:

- Web: the zero-install QR/link debugger for Chrome/Edge.
- Desktop: an Electron app that can run the same console locally and package per platform.

## Current Desktop Release

- Electron shell with the existing console UI.
- Automatic Electron MIDI and SysEx permission handling.
- Native save dialog for log export.
- GitHub Actions builds for macOS, Windows, and Linux.
- Web download link to the latest GitHub release.

The first desktop build still uses Chromium Web MIDI in the renderer. That already routes through the host OS MIDI stack for connected devices, while keeping the app buildable across macOS, Windows, and Linux.

## Native MIDI Adapter Targets

The `electron/native-midi.cjs` file is the adapter boundary for deeper platform support.

Planned backends:

- macOS: CoreMIDI device metadata, virtual sources/destinations, MIDI thru, and app/output inspection where the OS exposes it.
- Windows: WinMM or WinRT MIDI input/output enumeration, virtual-port support through compatible drivers, and stable device identity.
- Linux: ALSA/JACK enumeration and virtual-port support.

## State Of The Art Feature Checklist

- Input and output monitor modes.
- Timestamped raw bytes plus decoded MIDI labels.
- Note, CC, pitch bend, pressure, program change, bank select, SysEx, MIDI clock, MTC, and transport decoding.
- Per-device colors across device list, log, piano, and channel/value views.
- Full-session export independent of visible UI virtualization/cropping.
- Separate high-volume tabs for MTC/clock so they do not overrun musical events.
- Channel matrix based on musical value, not event count.
- Held-note, velocity, CC, pitch, and modulation visualizers.
- Device diagnostics for stuck notes, release-to-zero controls, suspicious volume/expression/modulation controls, duplicate device names, and stale selected devices.
- Desktop-only persistence: saved sessions, recent files, native log save, and optional background logging.
- Future native-only tooling: virtual MIDI ports, MIDI thru/router, output monitor, and profile presets for live rigs.

## Release Flow

Create a tag to build and attach installers:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or run the `Release Desktop Builds` workflow manually from GitHub Actions.
