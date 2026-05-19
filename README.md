# MIDI Debugger

A browser-based MIDI diagnostic console built with Next.js, Tailwind, and shadcn/ui.

## What It Does

- Requests Web MIDI access from the browser.
- Lists MIDI inputs and outputs with connection state.
- Captures live MIDI messages from selected inputs.
- Decodes notes, CC, pitch bend, program change, pressure, system, and SysEx messages.
- Filters by source, message type, channel, CC number, and text search.
- Tracks channel activity, recent CC values, held notes, and diagnostics.
- Flags common live-rig problems such as release-to-zero controls, CC 1 modulation, CC 7 volume, and CC 11 expression.
- Exports or copies visible logs.

## Browser Support

Use desktop Chrome or Edge. Web MIDI requires `https://` or `localhost`.

Safari, Firefox, and iOS browsers are not reliable targets for this tool.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production

This app is static-friendly and can be deployed to Vercel, Netlify, or any HTTPS host. Users must open the site on the computer where the MIDI device is connected.
