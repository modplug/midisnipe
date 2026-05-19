"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  Pause,
  Play,
  Plug,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Waves,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type MidiConnectionState = "open" | "closed" | "pending";
type MidiDeviceState = "connected" | "disconnected";
type MidiPortType = "input" | "output";

type MidiMessageEventLike = {
  data: Uint8Array;
  timeStamp: number;
};

type MidiPortLike = {
  id: string;
  name?: string;
  manufacturer?: string;
  state: MidiDeviceState;
  connection: MidiConnectionState;
  type: MidiPortType;
};

type MidiInputLike = MidiPortLike & {
  type: "input";
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
};

type MidiOutputLike = MidiPortLike & {
  type: "output";
  send?: (data: number[] | Uint8Array, timestamp?: number) => void;
};

type MidiStateChangeEventLike = {
  port: MidiPortLike;
};

type MidiPortCollection<T> = {
  values: () => IterableIterator<T>;
};

type MidiAccessLike = {
  inputs: MidiPortCollection<MidiInputLike>;
  outputs: MidiPortCollection<MidiOutputLike>;
  sysexEnabled: boolean;
  onstatechange: ((event: MidiStateChangeEventLike) => void) | null;
};

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: {
    sysex?: boolean;
    software?: boolean;
  }) => Promise<MidiAccessLike>;
};

type MessageKind =
  | "note-on"
  | "note-off"
  | "cc"
  | "pitch-bend"
  | "program"
  | "channel-pressure"
  | "poly-pressure"
  | "system"
  | "sysex"
  | "unknown";

type MidiEvent = {
  id: string;
  sourceId: string;
  sourceName: string;
  manufacturer: string;
  timestamp: number;
  data: number[];
  hex: string;
  kind: MessageKind;
  label: string;
  channel?: number;
  controller?: number;
  note?: number;
  velocity?: number;
  value?: number;
  normalized?: number;
};

type DiagnosticEvent = {
  id: string;
  timestamp: number;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

type PortSnapshot = {
  id: string;
  name: string;
  manufacturer: string;
  state: MidiDeviceState;
  connection: MidiConnectionState;
  type: MidiPortType;
};

type CcMemory = {
  value: number;
  timestamp: number;
};

type BankMemory = {
  msb?: number;
  lsb?: number;
};

type TimecodeState = {
  sourceName: string;
  timestamp: number;
  mode: "MTC quarter-frame" | "MTC full-frame";
  complete: boolean;
  rate?: string;
  hours?: number;
  minutes?: number;
  seconds?: number;
  frames?: number;
  piecesSeen?: number;
};

type RecentKeyHit = {
  id: string;
  velocity: number;
  sourceId: string;
};

const MAX_EVENTS = 1500;
const MAX_DIAGNOSTICS = 100;
const AMBER = "#ffa024";
const SIGNAL_GREEN = "#7dff5a";
const RED = "#ff5a4a";
const FACE = "#15130f";
const TEXT = "#e8e4d8";
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);
const DEVICE_COLORS = [
  "#7dff5a",
  "#47b5ff",
  "#ff5a9e",
  "#b783ff",
  "#ffd15a",
  "#4ee6c6",
  "#ff7a4d",
  "#b9ff4d",
  "#ff6b6b",
  "#4df2ff",
  "#d88cff",
  "#f4ff7a",
] as const;
const MESSAGE_FILTERS = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "cc", label: "CC" },
  { value: "pitch", label: "Pitch" },
  { value: "program", label: "Program" },
  { value: "timecode", label: "Timecode" },
  { value: "system", label: "System" },
] as const;

const CC_NAMES: Record<number, string> = {
  0: "Bank Select MSB",
  1: "Modulation Wheel",
  2: "Breath Controller",
  4: "Foot Controller",
  5: "Portamento Time",
  6: "Data Entry MSB",
  7: "Channel Volume",
  8: "Balance",
  10: "Pan",
  11: "Expression Controller",
  12: "Effect Control 1",
  13: "Effect Control 2",
  16: "General Purpose Controller 1",
  17: "General Purpose Controller 2",
  18: "General Purpose Controller 3",
  19: "General Purpose Controller 4",
  32: "Bank Select LSB",
  33: "Modulation Wheel LSB",
  34: "Breath Controller LSB",
  36: "Foot Controller LSB",
  37: "Portamento Time LSB",
  38: "Data Entry LSB",
  39: "Channel Volume LSB",
  40: "Balance LSB",
  42: "Pan LSB",
  43: "Expression Controller LSB",
  44: "Effect Control 1 LSB",
  45: "Effect Control 2 LSB",
  48: "General Purpose Controller 1 LSB",
  49: "General Purpose Controller 2 LSB",
  50: "General Purpose Controller 3 LSB",
  51: "General Purpose Controller 4 LSB",
  64: "Damper Pedal / Sustain",
  65: "Portamento On/Off",
  66: "Sostenuto",
  67: "Soft Pedal",
  68: "Legato Footswitch",
  69: "Hold 2",
  70: "Sound Controller 1 / Sound Variation",
  71: "Sound Controller 2 / Timbre / Resonance",
  72: "Sound Controller 3 / Release Time",
  73: "Sound Controller 4 / Attack Time",
  74: "Sound Controller 5 / Brightness / Filter Cutoff",
  75: "Sound Controller 6 / Decay Time",
  76: "Sound Controller 7 / Vibrato Rate",
  77: "Sound Controller 8 / Vibrato Depth",
  78: "Sound Controller 9 / Vibrato Delay",
  79: "Sound Controller 10",
  80: "General Purpose Controller 5",
  81: "General Purpose Controller 6",
  82: "General Purpose Controller 7",
  83: "General Purpose Controller 8",
  84: "Portamento Control",
  88: "High Resolution Velocity Prefix",
  91: "Effects 1 Depth / Reverb Send",
  92: "Effects 2 Depth / Tremolo",
  93: "Effects 3 Depth / Chorus Send",
  94: "Effects 4 Depth / Celeste",
  95: "Effects 5 Depth / Phaser",
  96: "Data Increment",
  97: "Data Decrement",
  98: "NRPN LSB",
  99: "NRPN MSB",
  100: "RPN LSB",
  101: "RPN MSB",
  120: "All Sound Off",
  121: "Reset All Controllers",
  122: "Local Control",
  123: "All Notes Off",
  124: "Omni Mode Off",
  125: "Omni Mode On",
  126: "Mono Mode On",
  127: "Poly Mode On",
};

const GM_PROGRAM_NAMES = [
  "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavinet",
  "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
  "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
  "Acoustic Guitar Nylon", "Acoustic Guitar Steel", "Electric Guitar Jazz", "Electric Guitar Clean", "Electric Guitar Muted", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
  "Acoustic Bass", "Electric Bass Finger", "Electric Bass Pick", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
  "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
  "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
  "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
  "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
  "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
  "Lead 1 Square", "Lead 2 Sawtooth", "Lead 3 Calliope", "Lead 4 Chiff", "Lead 5 Charang", "Lead 6 Voice", "Lead 7 Fifths", "Lead 8 Bass + Lead",
  "Pad 1 New Age", "Pad 2 Warm", "Pad 3 Polysynth", "Pad 4 Choir", "Pad 5 Bowed", "Pad 6 Metallic", "Pad 7 Halo", "Pad 8 Sweep",
  "FX 1 Rain", "FX 2 Soundtrack", "FX 3 Crystal", "FX 4 Atmosphere", "FX 5 Brightness", "FX 6", "FX 7 Echoes", "FX 8 Sci-fi",
  "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
  "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
  "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot",
] as const;

function portName(port: MidiPortLike): string {
  return port.name?.trim() || `${port.type} ${port.id.slice(0, 6)}`;
}

function portManufacturer(port: MidiPortLike): string {
  return port.manufacturer?.trim() || "Unknown";
}

function snapshotPort(port: MidiPortLike): PortSnapshot {
  return {
    id: port.id,
    name: portName(port),
    manufacturer: portManufacturer(port),
    state: port.state,
    connection: port.connection,
    type: port.type,
  };
}

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(timestamp);
}

function formatAgo(timestamp: number | undefined, now: number): string {
  if (!timestamp) return "-";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 1) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(seconds % 60).padStart(2, "0")}`;
}

function hex(data: number[]): string {
  return data.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function noteName(note: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

function sourceColor(sourceId: string): string {
  let hash = 0;
  for (let index = 0; index < sourceId.length; index++) {
    hash = (hash * 31 + sourceId.charCodeAt(index)) >>> 0;
  }
  return DEVICE_COLORS[hash % DEVICE_COLORS.length];
}

function ccControllerLabel(controller: number): string {
  return `CC ${controller} · ${CC_NAMES[controller] ?? "Assignable / Undefined"}`;
}

function programChangeLabel(program: number): string {
  return `Program ${program} · GM ${program + 1}: ${GM_PROGRAM_NAMES[program] ?? "Unknown Program"}`;
}

function bankSuffix(bank?: BankMemory): string {
  if (!bank || (bank.msb === undefined && bank.lsb === undefined)) return "";
  const msb = bank.msb === undefined ? "--" : String(bank.msb);
  const lsb = bank.lsb === undefined ? "--" : String(bank.lsb);
  return ` · Bank MSB ${msb} LSB ${lsb}`;
}

function messageLength(status: number): number {
  if (status >= 0xf8) return 1;
  if (status === 0xf0) return 0;
  if (status >= 0xf0) {
    return [0xf1, 0xf3].includes(status) ? 2 : status === 0xf2 ? 3 : 1;
  }

  switch (status & 0xf0) {
    case 0xc0:
    case 0xd0:
      return 2;
    case 0x80:
    case 0x90:
    case 0xa0:
    case 0xb0:
    case 0xe0:
      return 3;
    default:
      return 0;
  }
}

function systemLabel(status: number): string {
  const labels: Record<number, string> = {
    0xf1: "MTC quarter frame",
    0xf2: "Song position",
    0xf3: "Song select",
    0xf6: "Tune request",
    0xf8: "Timing clock",
    0xfa: "Start",
    0xfb: "Continue",
    0xfc: "Stop",
    0xfe: "Active sensing",
    0xff: "System reset",
  };
  return labels[status] ?? "System message";
}

function mtcRateLabel(rateCode: number): string {
  return ["24 fps", "25 fps", "29.97 df", "30 fps"][rateCode] ?? "unknown fps";
}

function formatTimecode(state?: TimecodeState): string {
  if (!state?.complete) return "--:--:--:--";
  return [state.hours, state.minutes, state.seconds, state.frames]
    .map((value) => String(value ?? 0).padStart(2, "0"))
    .join(":");
}

function describeMtcQuarterFrame(dataByte: number): string {
  const piece = (dataByte >> 4) & 0x07;
  const value = dataByte & 0x0f;
  const labels = [
    "frames low",
    "frames high",
    "seconds low",
    "seconds high",
    "minutes low",
    "minutes high",
    "hours low",
    "hours high/rate",
  ];
  return `MTC quarter ${piece + 1}/8 ${labels[piece]} ${value}`;
}

function decodeMtcFullFrame(data: number[]): Omit<TimecodeState, "sourceName" | "timestamp" | "mode" | "complete" | "piecesSeen"> | undefined {
  if (data.length < 10) return undefined;
  const isFullFrame = data[0] === 0xf0 && data[1] === 0x7f && data[3] === 0x01 && data[4] === 0x01;
  if (!isFullFrame) return undefined;

  const hourRate = data[5];
  return {
    rate: mtcRateLabel((hourRate >> 5) & 0x03),
    hours: hourRate & 0x1f,
    minutes: data[6] & 0x3f,
    seconds: data[7] & 0x3f,
    frames: data[8] & 0x1f,
  };
}

function decodeMtcQuarterState(event: MidiEvent, pieces: Array<number | undefined>): TimecodeState | undefined {
  if (event.data[0] !== 0xf1 || event.data.length < 2) return undefined;

  const piece = (event.data[1] >> 4) & 0x07;
  const value = event.data[1] & 0x0f;
  pieces[piece] = value;

  const piecesSeen = pieces.filter((item) => item !== undefined).length;
  if (piecesSeen < 8) {
    return {
      sourceName: event.sourceName,
      timestamp: event.timestamp,
      mode: "MTC quarter-frame",
      complete: false,
      piecesSeen,
    };
  }

  const frames = (pieces[0] ?? 0) | (((pieces[1] ?? 0) & 0x01) << 4);
  const seconds = (pieces[2] ?? 0) | (((pieces[3] ?? 0) & 0x03) << 4);
  const minutes = (pieces[4] ?? 0) | (((pieces[5] ?? 0) & 0x03) << 4);
  const hours = (pieces[6] ?? 0) | (((pieces[7] ?? 0) & 0x01) << 4);
  const rate = mtcRateLabel(((pieces[7] ?? 0) >> 1) & 0x03);

  return {
    sourceName: event.sourceName,
    timestamp: event.timestamp,
    mode: "MTC quarter-frame",
    complete: true,
    rate,
    hours,
    minutes,
    seconds,
    frames,
    piecesSeen,
  };
}

function decodeMessage(data: number[], base: Omit<MidiEvent, "data" | "kind" | "label" | "hex">): MidiEvent {
  const status = data[0] ?? 0;
  const command = status & 0xf0;
  const channel = status < 0xf0 ? (status & 0x0f) + 1 : undefined;
  const common = {
    ...base,
    data,
    hex: hex(data),
    channel,
  };

  if (status === 0xf0) {
    const mtcFullFrame = decodeMtcFullFrame(data);
    return {
      ...common,
      kind: "sysex",
      label: mtcFullFrame
        ? `MTC full-frame ${formatTimecode({ ...mtcFullFrame, sourceName: base.sourceName, timestamp: base.timestamp, mode: "MTC full-frame", complete: true })} ${mtcFullFrame.rate}`
        : `SysEx ${data.length} bytes`,
      normalized: 100,
    };
  }

  if (status >= 0xf0) {
    return {
      ...common,
      kind: "system",
      label: status === 0xf1 && data.length >= 2 ? describeMtcQuarterFrame(data[1]) : systemLabel(status),
      value: data[1],
      normalized: undefined,
    };
  }

  if (command === 0x80 && data.length >= 3) {
    return {
      ...common,
      kind: "note-off",
      note: data[1],
      velocity: data[2],
      value: data[2],
      normalized: Math.round((data[2] / 127) * 100),
      label: `Note off ${noteName(data[1])} velocity ${data[2]}`,
    };
  }

  if (command === 0x90 && data.length >= 3) {
    const isOff = data[2] === 0;
    return {
      ...common,
      kind: isOff ? "note-off" : "note-on",
      note: data[1],
      velocity: data[2],
      value: data[2],
      normalized: Math.round((data[2] / 127) * 100),
      label: `${isOff ? "Note off" : "Note on"} ${noteName(data[1])} velocity ${data[2]}`,
    };
  }

  if (command === 0xa0 && data.length >= 3) {
    return {
      ...common,
      kind: "poly-pressure",
      note: data[1],
      value: data[2],
      normalized: Math.round((data[2] / 127) * 100),
      label: `Poly pressure ${noteName(data[1])} value ${data[2]}`,
    };
  }

  if (command === 0xb0 && data.length >= 3) {
    return {
      ...common,
      kind: "cc",
      controller: data[1],
      value: data[2],
      normalized: Math.round((data[2] / 127) * 100),
      label: `${ccControllerLabel(data[1])} value ${data[2]}`,
    };
  }

  if (command === 0xc0 && data.length >= 2) {
    return {
      ...common,
      kind: "program",
      value: data[1],
      normalized: Math.round((data[1] / 127) * 100),
      label: programChangeLabel(data[1]),
    };
  }

  if (command === 0xd0 && data.length >= 2) {
    return {
      ...common,
      kind: "channel-pressure",
      value: data[1],
      normalized: Math.round((data[1] / 127) * 100),
      label: `Channel pressure ${data[1]}`,
    };
  }

  if (command === 0xe0 && data.length >= 3) {
    const value = data[1] | (data[2] << 7);
    return {
      ...common,
      kind: "pitch-bend",
      value,
      normalized: Math.round((value / 16383) * 100),
      label: `Pitch bend ${value - 8192}`,
    };
  }

  return {
    ...common,
    kind: "unknown",
    label: "Unknown message",
  };
}

function decodePacket(
  bytes: number[],
  base: Omit<MidiEvent, "kind" | "label" | "hex" | "data">
): MidiEvent[] {
  if (bytes[0] === 0xf0) {
    return [decodeMessage(bytes, base)];
  }

  const events: MidiEvent[] = [];
  let index = 0;

  while (index < bytes.length) {
    const length = messageLength(bytes[index]);
    if (length <= 0 || index + length > bytes.length) {
      events.push(decodeMessage(bytes.slice(index), base));
      break;
    }
    events.push(decodeMessage(bytes.slice(index, index + length), base));
    index += length;
  }

  return events;
}

function matchesMessageFilter(event: MidiEvent, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "note") return event.kind === "note-on" || event.kind === "note-off";
  if (filter === "pitch") return event.kind === "pitch-bend";
  if (filter === "program") return event.kind === "program";
  if (filter === "timecode") return isMtcEvent(event);
  if (filter === "system") return event.kind === "system" || event.kind === "sysex";
  return event.kind === filter;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function eventColor(event: MidiEvent): string {
  if (isMtcEvent(event)) return AMBER;
  if (event.kind === "note-on" || event.kind === "cc" || event.kind === "pitch-bend") return AMBER;
  if (event.kind === "note-off") return SIGNAL_GREEN;
  if (event.kind === "sysex" || event.kind === "unknown") return RED;
  return TEXT;
}

function isMtcEvent(event: MidiEvent): boolean {
  return event.data[0] === 0xf1 || Boolean(decodeMtcFullFrame(event.data));
}

function eventTypeLabel(kind: MessageKind): string {
  const labels: Record<MessageKind, string> = {
    "note-on": "note on",
    "note-off": "note off",
    cc: "cc",
    "pitch-bend": "bend",
    program: "program",
    "channel-pressure": "pressure",
    "poly-pressure": "poly",
    system: "system",
    sysex: "sysex",
    unknown: "unknown",
  };
  return labels[kind];
}

function buildScopePath(events: MidiEvent[], offset: number, level: number): string {
  const source = events.slice(0, 24);
  const amplitude = Math.max(3, Math.min(34, 4 + level * 0.3));
  const points = Array.from({ length: 48 }, (_, index) => {
    const event = source[index % Math.max(source.length, 1)];
    const value = event?.value ?? event?.velocity ?? 64;
    const eventBias = source.length > 0 ? ((value / 127) - 0.5) * 10 : 0;
    const y = 40 + Math.sin((index + offset) / 3) * amplitude + eventBias;
    const x = (index / 47) * 400;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${Math.max(6, Math.min(74, y)).toFixed(1)}`;
  });
  return points.join(" ");
}

export function MidiSnipe() {
  const midiAccessRef = React.useRef<MidiAccessLike | null>(null);
  const inputsRef = React.useRef<Map<string, MidiInputLike>>(new Map());
  const eventCounterRef = React.useRef(0);
  const lastCcRef = React.useRef<Map<string, CcMemory>>(new Map());
  const bankSelectRef = React.useRef<Map<string, BankMemory>>(new Map());
  const activeNotesRef = React.useRef<Map<string, MidiEvent>>(new Map());
  const mtcQuarterRef = React.useRef<Array<number | undefined>>(Array(8).fill(undefined));
  const activityTimersRef = React.useRef<Map<string, number>>(new Map());
  const keyHitTimersRef = React.useRef<Map<number, number>>(new Map());
  const pendingEventsRef = React.useRef<MidiEvent[]>([]);
  const exportEventsRef = React.useRef<MidiEvent[]>([]);
  const pendingLastEventAtRef = React.useRef<number | undefined>(undefined);
  const pendingTimecodeRef = React.useRef<TimecodeState | undefined>(undefined);
  const eventFlushTimerRef = React.useRef<number | undefined>(undefined);

  const [inputs, setInputs] = React.useState<PortSnapshot[]>([]);
  const [selectedInputIds, setSelectedInputIds] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState<MidiEvent[]>([]);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticEvent[]>([]);
  const [activeNotes, setActiveNotes] = React.useState<MidiEvent[]>([]);
  const [activeInputIds, setActiveInputIds] = React.useState<Set<string>>(() => new Set());
  const [recentKeyHits, setRecentKeyHits] = React.useState<Record<number, RecentKeyHit>>({});
  const [exportEventCount, setExportEventCount] = React.useState(0);
  const [timecode, setTimecode] = React.useState<TimecodeState | undefined>();
  const [midiEnabled, setMidiEnabled] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [includeSysex, setIncludeSysex] = React.useState(false);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [channelFilter, setChannelFilter] = React.useState("all");
  const [messageFilter, setMessageFilter] = React.useState("all");
  const [ccFilter, setCcFilter] = React.useState("all");
  const [logView, setLogView] = React.useState<"events" | "timecode">("events");
  const [hideClock, setHideClock] = React.useState(true);
  const [lastEventAt, setLastEventAt] = React.useState<number | undefined>();
  const [now, setNow] = React.useState(() => Date.now());
  const [browserCapabilities, setBrowserCapabilities] = React.useState({
    isSecure: false,
    isMidiSupported: false,
  });

  React.useEffect(() => {
    const capabilityTimer = window.setTimeout(() => {
      setBrowserCapabilities({
        isSecure: window.isSecureContext,
        isMidiSupported: Boolean((navigator as unknown as NavigatorWithMidi).requestMIDIAccess),
      });
    }, 0);

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(capabilityTimer);
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    const activityTimers = activityTimersRef.current;
    const keyHitTimers = keyHitTimersRef.current;
    return () => {
      if (eventFlushTimerRef.current) window.clearTimeout(eventFlushTimerRef.current);
      for (const timer of activityTimers.values()) {
        window.clearTimeout(timer);
      }
      for (const timer of keyHitTimers.values()) {
        window.clearTimeout(timer);
      }
      activityTimers.clear();
      keyHitTimers.clear();
    };
  }, []);

  const addDiagnostic = React.useCallback((diagnostic: Omit<DiagnosticEvent, "id" | "timestamp">) => {
    setDiagnostics((current) => [
      {
        ...diagnostic,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: Date.now(),
      },
      ...current,
    ].slice(0, MAX_DIAGNOSTICS));
  }, []);

  const refreshPorts = React.useCallback(() => {
    const access = midiAccessRef.current;
    if (!access) return;

    const inputPorts = Array.from(access.inputs.values());
    const nextInputs = inputPorts.map(snapshotPort);
    inputsRef.current = new Map(inputPorts.map((input) => [input.id, input]));
    setInputs(nextInputs);

    setSelectedInputIds((current) => {
      const validIds = new Set(nextInputs.filter((input) => input.state === "connected").map((input) => input.id));
      const retained = current.filter((id) => validIds.has(id));
      if (retained.length > 0 || current.length > 0) return retained;
      return Array.from(validIds);
    });
  }, []);

  const markInputActive = React.useCallback((sourceId: string) => {
    const previousTimer = activityTimersRef.current.get(sourceId);
    if (previousTimer) window.clearTimeout(previousTimer);

    setActiveInputIds((current) => {
      if (current.has(sourceId)) return current;
      const next = new Set(current);
      next.add(sourceId);
      return next;
    });

    const timer = window.setTimeout(() => {
      activityTimersRef.current.delete(sourceId);
      setActiveInputIds((current) => {
        if (!current.has(sourceId)) return current;
        const next = new Set(current);
        next.delete(sourceId);
        return next;
      });
    }, 80);

    activityTimersRef.current.set(sourceId, timer);
  }, []);

  const triggerKeyHit = React.useCallback((note: number, velocity: number, sourceId: string, duration = 180) => {
    const previousTimer = keyHitTimersRef.current.get(note);
    if (previousTimer) window.clearTimeout(previousTimer);

    const id = `${note}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setRecentKeyHits((current) => ({
      ...current,
      [note]: { id, velocity, sourceId },
    }));

    const timer = window.setTimeout(() => {
      keyHitTimersRef.current.delete(note);
      setRecentKeyHits((current) => {
        if (!current[note] || current[note].id !== id) return current;
        const next = { ...current };
        delete next[note];
        return next;
      });
    }, duration);

    keyHitTimersRef.current.set(note, timer);
  }, []);

  const scheduleEventFlush = React.useCallback(() => {
    if (eventFlushTimerRef.current) return;

    eventFlushTimerRef.current = window.setTimeout(() => {
      eventFlushTimerRef.current = undefined;

      const pendingEvents = pendingEventsRef.current;
      const pendingLastEventAt = pendingLastEventAtRef.current;
      const pendingTimecode = pendingTimecodeRef.current;

      pendingEventsRef.current = [];
      pendingLastEventAtRef.current = undefined;
      pendingTimecodeRef.current = undefined;

      if (pendingEvents.length > 0) {
        setEvents((current) => [...pendingEvents, ...current].slice(0, MAX_EVENTS));
        setExportEventCount(exportEventsRef.current.length);
      }

      if (pendingLastEventAt) {
        setLastEventAt(pendingLastEventAt);
      }

      if (pendingTimecode) {
        setTimecode(pendingTimecode);
      }
    }, 50);
  }, []);

  const handleMidiMessage = React.useCallback(
    (source: MidiInputLike, message: MidiMessageEventLike) => {
      if (isPaused) return;

      markInputActive(source.id);

      const eventNow = Date.now();
      const bytes = Array.from(message.data);
      const base = {
        id: "",
        sourceId: source.id,
        sourceName: portName(source),
        manufacturer: portManufacturer(source),
        timestamp: eventNow,
      };
      const decoded = decodePacket(bytes, base).map((event) => ({
        ...event,
        id: `${eventNow}-${eventCounterRef.current++}`,
      }));
      let notesChanged = false;

      for (const event of decoded) {
        const bankKey = event.channel ? `${event.sourceId}:${event.channel}` : undefined;

        if (event.kind === "cc" && event.channel && event.controller !== undefined && event.value !== undefined) {
          const key = `${event.sourceId}:${event.channel}:${event.controller}`;
          const last = lastCcRef.current.get(key);

          if (bankKey && (event.controller === 0 || event.controller === 32)) {
            const bank = bankSelectRef.current.get(bankKey) ?? {};
            if (event.controller === 0) bank.msb = event.value;
            if (event.controller === 32) bank.lsb = event.value;
            bankSelectRef.current.set(bankKey, bank);
            event.label = `${ccControllerLabel(event.controller)} value ${event.value}${bankSuffix(bank)}`;
          }

          if (last && last.value > 0 && event.value === 0 && eventNow - last.timestamp < 1500) {
            addDiagnostic({
              level: "info",
              title: "Release-to-zero control",
              detail: `${event.sourceName} sent Ch ${event.channel} CC ${event.controller} back to 0 after ${eventNow - last.timestamp} ms.`,
            });
          }

          if (event.controller === 1) {
            addDiagnostic({
              level: "info",
              title: "CC 1 is modulation wheel",
              detail: `${event.sourceName} sent CC 1 on Ch ${event.channel}. Some synths map this to filter or amplitude changes.`,
            });
          }

          if (event.controller === 7 || event.controller === 11) {
            addDiagnostic({
              level: "warning",
              title: "Volume-class controller",
              detail: `${event.sourceName} sent CC ${event.controller} on Ch ${event.channel}. Instruments may treat this as volume or expression.`,
            });
          }

          lastCcRef.current.set(key, { value: event.value, timestamp: eventNow });
        }

        if (event.kind === "program" && event.value !== undefined) {
          event.label = `${programChangeLabel(event.value)}${bankSuffix(bankKey ? bankSelectRef.current.get(bankKey) : undefined)}`;
        }

        if (event.kind === "note-on" && event.note !== undefined && event.velocity !== 0) {
          activeNotesRef.current.set(`${event.sourceId}:${event.channel}:${event.note}`, event);
          triggerKeyHit(event.note, event.velocity ?? 96, event.sourceId, 110);
          notesChanged = true;
        }

        if (event.kind === "note-off" && event.note !== undefined) {
          const activeKey = `${event.sourceId}:${event.channel}:${event.note}`;
          const previousNote = activeNotesRef.current.get(activeKey);
          activeNotesRef.current.delete(activeKey);
          if (previousNote) {
            triggerKeyHit(event.note, previousNote.velocity ?? event.velocity ?? 72, event.sourceId, 180);
          }
          notesChanged = true;
        }

        const mtcQuarter = decodeMtcQuarterState(event, mtcQuarterRef.current);
        if (mtcQuarter) {
          pendingTimecodeRef.current = mtcQuarter;
        }

        const mtcFullFrame = event.kind === "sysex" ? decodeMtcFullFrame(event.data) : undefined;
        if (mtcFullFrame) {
          pendingTimecodeRef.current = {
            ...mtcFullFrame,
            sourceName: event.sourceName,
            timestamp: event.timestamp,
            mode: "MTC full-frame",
            complete: true,
          };
        }
      }

      if (notesChanged) {
        setActiveNotes(Array.from(activeNotesRef.current.values()));
      }
      pendingEventsRef.current.unshift(...decoded);
      exportEventsRef.current.push(...decoded);
      pendingLastEventAtRef.current = eventNow;
      scheduleEventFlush();
    },
    [addDiagnostic, isPaused, markInputActive, scheduleEventFlush, triggerKeyHit]
  );

  React.useEffect(() => {
    for (const input of inputsRef.current.values()) {
      input.onmidimessage = selectedInputIds.includes(input.id)
        ? (message) => handleMidiMessage(input, message)
        : null;
    }
  }, [handleMidiMessage, inputs, selectedInputIds]);

  const requestMidi = React.useCallback(async () => {
    const midiNavigator = navigator as unknown as NavigatorWithMidi;
    const midiRequest = midiNavigator.requestMIDIAccess;

    if (!midiRequest) {
      addDiagnostic({
        level: "critical",
        title: "Web MIDI is not available",
        detail: "Use desktop Chrome or Edge. Safari and most iOS browsers cannot access MIDI devices.",
      });
      return;
    }

    setRequesting(true);
    try {
      const access = (await midiRequest.call(midiNavigator, { sysex: includeSysex })) as MidiAccessLike;
      midiAccessRef.current = access;
      setMidiEnabled(true);
      access.onstatechange = (event) => {
        refreshPorts();
        addDiagnostic({
          level: event.port.state === "connected" ? "info" : "warning",
          title: `${portName(event.port)} ${event.port.state}`,
          detail: `${event.port.type} ${event.port.connection}; manufacturer ${portManufacturer(event.port)}.`,
        });
      };
      refreshPorts();
      toast.success("MIDI access enabled");
    } catch (error) {
      addDiagnostic({
        level: "critical",
        title: "MIDI permission failed",
        detail: error instanceof Error ? error.message : "The browser rejected MIDI access.",
      });
      toast.error("Could not enable MIDI");
    } finally {
      setRequesting(false);
    }
  }, [addDiagnostic, includeSysex, refreshPorts]);

  const toggleInput = React.useCallback((id: string, checked: boolean) => {
    setSelectedInputIds((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  }, []);

  const eventMatchesCurrentLog = React.useCallback((event: MidiEvent) => {
    const ccNumber = ccFilter === "all" ? undefined : Number(ccFilter);
    const timecodeEvent = isMtcEvent(event);

    if (logView === "events" && (timecodeEvent || event.hex === "F8")) return false;
    if (logView === "timecode" && !timecodeEvent) return false;
    if (hideClock && event.hex === "F8") return false;
    if (sourceFilter !== "all" && event.sourceId !== sourceFilter) return false;
    if (logView === "timecode") return true;
    if (channelFilter !== "all" && event.channel !== Number(channelFilter)) return false;
    if (!matchesMessageFilter(event, messageFilter)) return false;
    if (ccNumber !== undefined && event.controller !== ccNumber) return false;
    return true;
  }, [ccFilter, channelFilter, hideClock, logView, messageFilter, sourceFilter]);

  const visibleEvents = React.useMemo(() => events.filter(eventMatchesCurrentLog), [eventMatchesCurrentLog, events]);

  const mainLogCount = React.useMemo(() => events.filter((event) => !isMtcEvent(event) && event.hex !== "F8").length, [events]);
  const timecodeLogCount = React.useMemo(() => events.filter(isMtcEvent).length, [events]);

  const connectedInputs = inputs.filter((input) => input.state === "connected");
  const selectedConnectedInputs = connectedInputs.filter((input) => selectedInputIds.includes(input.id));
  const sourceColorById = React.useMemo(() => {
    const map = new Map<string, string>();
    inputs.forEach((input, index) => {
      map.set(input.id, DEVICE_COLORS[index % DEVICE_COLORS.length]);
    });
    return map;
  }, [inputs]);
  const getSourceColor = React.useCallback((sourceId: string) => sourceColorById.get(sourceId) ?? sourceColor(sourceId), [sourceColorById]);
  const duplicateNames = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const input of inputs) counts.set(input.name, (counts.get(input.name) ?? 0) + 1);
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name);
  }, [inputs]);

  const inputRates = React.useMemo(() => {
    const cutoff = now - 60_000;
    const map = new Map<string, number>();
    for (const event of events) {
      if (event.timestamp >= cutoff) {
        map.set(event.sourceId, (map.get(event.sourceId) ?? 0) + 1);
      }
    }
    return map;
  }, [events, now]);

  const channelActivity = React.useMemo(() => {
    return Array.from({ length: 16 }, (_, index) => {
      const channel = index + 1;
      const channelEvents = events.filter((event) => event.channel === channel);
      const cutoff = now - 60_000;
      const rate = channelEvents.filter((event) => event.timestamp >= cutoff).length;
      const last = channelEvents[0];
      return {
        channel,
        count: channelEvents.length,
        rate,
        last,
        level: Math.min(100, Math.max(last?.normalized ?? 0, rate * 2)),
      };
    });
  }, [events, now]);

  const latestNote = React.useMemo(
    () => events.find((event) => event.note !== undefined && (event.kind === "note-on" || event.kind === "note-off")),
    [events]
  );
  const nowPlayingNotes = activeNotes.length > 0 ? activeNotes.slice(0, 5) : latestNote ? [latestNote] : [];
  const activeNoteInputIds = React.useMemo(() => new Set(activeNotes.map((event) => event.sourceId)), [activeNotes]);
  const eventRate = React.useMemo(() => {
    const cutoff = now - 10_000;
    return Math.round((events.filter((event) => event.timestamp >= cutoff).length / 10) * 60);
  }, [events, now]);
  const supportIssue = !browserCapabilities.isSecure || !browserCapabilities.isMidiSupported;
  const staleDevice = selectedConnectedInputs.length > 0 && lastEventAt && now - lastEventAt > 5000;
  const systemReady = midiEnabled && selectedConnectedInputs.length > 0 && Boolean(lastEventAt);
  const lastSource = latestNote?.sourceName ?? selectedConnectedInputs[0]?.name ?? "No source selected";

  const exportLog = React.useCallback(() => {
    const exportedEvents = exportEventsRef.current.filter(eventMatchesCurrentLog);
    const text = exportedEvents
      .map((event) => {
        const channel = event.channel ? `ch ${event.channel}` : "system";
        return `${formatClock(event.timestamp)}\t${event.sourceName}\t${event.hex}\t${channel}\t${event.label}`;
      })
      .join("\n");

    downloadText(`midisnipe-${new Date().toISOString().replaceAll(":", "-")}.txt`, text);
  }, [eventMatchesCurrentLog]);

  const copyLog = React.useCallback(async () => {
    const text = visibleEvents
      .slice(0, 200)
      .map((event) => `${formatClock(event.timestamp)}  ${event.sourceName}  ${event.hex}  ${event.label}`)
      .join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Copied visible MIDI log");
  }, [visibleEvents]);

  const clearLog = React.useCallback(() => {
    pendingEventsRef.current = [];
    exportEventsRef.current = [];
    setExportEventCount(0);
    setEvents([]);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0f0e0c] text-[#e8e4d8] min-[1180px]:h-screen min-[1180px]:overflow-hidden">
      <style>{`
        @keyframes piano-release-bloom {
          0% { opacity: 1; transform: translateY(0) scaleX(1) scaleY(1); filter: blur(0); }
          100% { opacity: 0; transform: translateY(-10px) scaleX(1.25) scaleY(.74); filter: blur(6px); }
        }
        @keyframes piano-held-pulse {
          0%, 100% { opacity: .72; transform: translateY(0) scaleY(.96); }
          50% { opacity: 1; transform: translateY(-2px) scaleY(1.04); }
        }
        @keyframes piano-spark-rise {
          0% { opacity: .95; transform: translateY(0) scale(.8); }
          100% { opacity: 0; transform: translateY(-28px) scale(.28); }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.012)_0px,rgba(255,255,255,.012)_1px,transparent_1px,transparent_3px)]" />
      <div className="relative flex min-h-screen flex-col gap-3 p-3 min-[1180px]:h-screen">
        <Panel screws className="flex flex-col gap-4 px-7 py-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md border border-[#6e3a00] bg-[linear-gradient(180deg,#ffaa3a_0%,#c46000_100%)] shadow-[0_2px_6px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.3)]">
              <Waves className="text-[#1a0f00]" />
            </div>
            <div>
              <div className="font-mono text-lg font-bold tracking-[0.04em] text-white">MIDISNIPE</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#7a7567]">
                MIDI Inspector · MK1
              </div>
            </div>
          </div>

          <Divider />

          <div className="flex flex-wrap items-center gap-4">
            <LedLabel color={SIGNAL_GREEN} label="Power" on={browserCapabilities.isSecure} />
            <LedLabel color={SIGNAL_GREEN} label="Listen" on={midiEnabled} />
            <LedLabel color={AMBER} label="Data" on={Boolean(lastEventAt && now - lastEventAt < 650)} />
            <LedLabel color={AMBER} label="Sysex" on={includeSysex} />
          </div>

          <div className="flex-1" />

          <div className="flex gap-4">
            <Reading label="Events" value={events.length.toLocaleString()} />
            <Reading label="Rate/m" value={`${eventRate}`} />
            <Reading label="Last" value={formatAgo(lastEventAt, now)} />
          </div>

          <Divider />

          <div className="flex flex-wrap gap-2">
            <ConsoleButton onClick={() => setIsPaused((value) => !value)} icon={isPaused ? <Play /> : <Pause />}>
              {isPaused ? "Resume" : "Pause"}
            </ConsoleButton>
            <ConsoleButton onClick={refreshPorts} disabled={!midiEnabled} icon={<RefreshCw />}>
              Rescan
            </ConsoleButton>
            <ConsoleButton onClick={requestMidi} disabled={requesting || supportIssue} primary icon={<Plug />}>
              {requesting ? "Connecting" : midiEnabled ? "Reconnect" : "Connect"}
            </ConsoleButton>
          </div>
        </Panel>

        {supportIssue ? (
          <Panel className="border-[#4d1f18] px-4 py-3 text-[#ffb0a7]">
            <div className="flex items-center gap-3 font-mono text-xs">
              <ShieldAlert />
              <span>
                Web MIDI needs desktop Chrome or Edge on HTTPS/localhost. Safari, iOS, and some embedded browsers cannot open MIDI devices.
              </span>
            </div>
          </Panel>
        ) : null}

        {duplicateNames.length > 0 || staleDevice ? (
          <Panel className="border-[#4d3114] px-4 py-3 text-[#ffd08a]">
            <div className="font-mono text-xs">
              {duplicateNames.length > 0 ? `Duplicate MIDI names: ${duplicateNames.join(", ")}. ` : null}
              {staleDevice ? "Selected input is connected but has stopped sending data." : null}
            </div>
          </Panel>
        ) : null}

        <section className="grid min-h-0 flex-1 gap-3 min-[1180px]:grid-cols-[300px_minmax(520px,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-3">
            <Panel label={`Inputs · ${inputs.length}`} className="pb-1 pt-3">
              {inputs.length === 0 ? (
                <div className="px-3 py-8 font-mono text-xs uppercase tracking-[.12em] text-[#7a7567]">
                  Connect to list MIDI inputs.
                </div>
              ) : (
                inputs.map((input) => (
                  <ConsoleDevice
                    key={input.id}
                    device={input}
                    selected={selectedInputIds.includes(input.id)}
                    rate={inputRates.get(input.id) ?? 0}
                    recentlyActive={activeInputIds.has(input.id)}
                    holdingNote={activeNoteInputIds.has(input.id)}
                    sourceColor={getSourceColor(input.id)}
                    onToggle={(checked) => toggleInput(input.id, checked)}
                  />
                ))
              )}
            </Panel>

            <Panel label="Filters" className="px-3 pb-3 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <ConsoleSelect label="Source" value={sourceFilter} onChange={setSourceFilter}>
                  <option value="all">ALL</option>
                  {inputs.map((input) => (
                    <option key={input.id} value={input.id}>
                      {input.name}
                    </option>
                  ))}
                </ConsoleSelect>
                <ConsoleSelect label="Channel" value={channelFilter} onChange={setChannelFilter}>
                  <option value="all">ALL</option>
                  {Array.from({ length: 16 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      CH {String(index + 1).padStart(2, "0")}
                    </option>
                  ))}
                </ConsoleSelect>
                <ConsoleSelect label="Message" value={messageFilter} onChange={setMessageFilter}>
                  {MESSAGE_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label.toUpperCase()}
                    </option>
                  ))}
                </ConsoleSelect>
                <ConsoleSelect label="CC #" value={ccFilter} onChange={setCcFilter}>
                  <option value="all">ANY</option>
                  {Array.from({ length: 128 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </ConsoleSelect>
              </div>
              <div className="mt-3 flex items-center justify-between py-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a4a094]">Hide MIDI clock</span>
                <ConsoleSwitch checked={hideClock} onChange={setHideClock} />
              </div>
              <div className="mt-1 flex items-center justify-between py-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#a4a094]">Request SysEx</span>
                <ConsoleSwitch checked={includeSysex} onChange={setIncludeSysex} />
              </div>
            </Panel>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <Panel label="Now Playing" className="flex flex-col gap-4 px-5 py-4 min-[760px]:flex-row min-[760px]:items-center">
              <div className="min-w-[220px]">
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7a7567]">Held</div>
                <div className="mt-2 flex min-h-9 flex-wrap gap-2">
                  {nowPlayingNotes.length === 0 ? (
                    <span className="font-mono text-sm uppercase tracking-[.12em] text-[#5a5547]">No notes</span>
                  ) : (
                    nowPlayingNotes.map((event) => (
                      <span
                        key={event.id}
                        className="rounded border border-[#6e3a00] bg-[linear-gradient(180deg,#ffa024_0%,#c46000_100%)] px-3 py-1 font-mono text-base font-bold text-[#1a0f00] shadow-[0_0_12px_rgba(255,160,36,.18),inset_0_1px_0_rgba(255,255,255,.3)]"
                      >
                        {noteName(event.note ?? 60)}
                      </span>
                    ))
                  )}
                </div>
                <div className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[#a4a094]">
                  CH {String(nowPlayingNotes[0]?.channel ?? latestNote?.channel ?? 1).padStart(2, "0")} · {lastSource}
                </div>
              </div>

              <Divider vertical />

              <div className="flex gap-2">
                {(nowPlayingNotes.length > 0 ? nowPlayingNotes : [undefined, undefined, undefined]).slice(0, 3).map((event, index) => (
                  <Vu key={event?.id ?? index} value={event?.velocity ?? event?.value ?? 0} label={event?.note ? noteName(event.note) : "--"} />
                ))}
              </div>

              <Divider vertical />

              <Scope events={events} activeNotes={activeNotes} lastEventAt={lastEventAt} now={now} />
            </Panel>

            <Panel label="Live Log" className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col gap-3 border-b border-[#232019] px-4 py-3 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex rounded border border-[#2a2620] bg-[#0a0908] p-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <button
                      type="button"
                      onClick={() => setLogView("events")}
                      className={`rounded px-2 py-1 ${logView === "events" ? "bg-[#28251f] text-[#ffa024]" : "text-[#888278]"}`}
                    >
                      Events {mainLogCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogView("timecode")}
                      className={`rounded px-2 py-1 ${logView === "timecode" ? "bg-[#28251f] text-[#ffa024]" : "text-[#888278]"}`}
                    >
                      Timecode {timecodeLogCount}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#888278]">
                    Showing {visibleEvents.length} · auto-scroll <Led color={SIGNAL_GREEN} size={6} on />
                  </div>
                </div>
                <div className="flex gap-1">
                  <ConsoleButton small onClick={copyLog} disabled={visibleEvents.length === 0} icon={<Clipboard />}>
                    Copy
                  </ConsoleButton>
                  <ConsoleButton small onClick={exportLog} disabled={exportEventCount === 0} icon={<Download />}>
                    Export
                  </ConsoleButton>
                  <ConsoleButton small danger onClick={clearLog} disabled={events.length === 0 && exportEventCount === 0} icon={<Trash2 />}>
                    Clear
                  </ConsoleButton>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid min-w-[680px] grid-cols-[76px_112px_74px_30px_68px_minmax(150px,1fr)_34px] gap-2 border-b border-[#232019] px-4 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7a7567]">
                  <span>Time</span>
                  <span>Source</span>
                  <span>Type</span>
                  <span>Ch</span>
                  <span>Bytes</span>
                  <span>Decoded</span>
                  <span className="text-right">Val</span>
                </div>
                {visibleEvents.length === 0 ? (
                  <div className="flex h-[360px] min-w-[680px] flex-col items-center justify-center gap-3 font-mono text-xs text-[#888278]">
                    <Waves />
                    <span>No {logView === "timecode" ? "MTC" : "MIDI"} messages visible</span>
                    <span>{logView === "timecode" ? "Timecode tab only shows MTC quarter-frame and full-frame messages." : "MTC and MIDI clock are kept out of this tab."}</span>
                  </div>
                ) : (
                  visibleEvents.slice(0, 40).map((event, index) => (
                    <div
                      key={event.id}
                      className="grid min-w-[680px] grid-cols-[76px_112px_74px_30px_68px_minmax(150px,1fr)_34px] items-center gap-2 border-b border-[rgba(35,32,25,.5)] px-4 py-1.5 font-mono text-[11px]"
                      style={{ background: index % 2 === 0 ? "rgba(255,255,255,.008)" : "transparent" }}
                    >
                      <span className="text-[#a4a094]">{formatClock(event.timestamp).slice(-12)}</span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[#d4cfc0]">
                        <span
                          className="size-1.5 shrink-0 rounded-full shadow-[0_0_7px_currentColor]"
                          style={{ color: getSourceColor(event.sourceId), backgroundColor: getSourceColor(event.sourceId) }}
                        />
                        <span className="truncate">{event.sourceName}</span>
                      </span>
                      <span className="font-semibold uppercase" style={{ color: eventColor(event) }}>
                        <Led color={eventColor(event)} size={6} on /> {eventTypeLabel(event.kind)}
                      </span>
                      <span>{event.channel ? String(event.channel).padStart(2, "0") : "--"}</span>
                      <span>{event.hex}</span>
                      <span className="truncate text-white">{event.label}</span>
                      <span className="text-right font-semibold text-white">{event.value ?? event.velocity ?? "-"}</span>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <Panel label="Ch Matrix · 1-16" className="px-4 pb-4 pt-5">
              <div className="grid grid-cols-4 gap-2">
                {channelActivity.map((channel) => (
                  <ChannelCell key={channel.channel} channel={channel} />
                ))}
              </div>
            </Panel>

            <Panel label="Timecode" className="px-3 pb-3 pt-4">
              <TimecodePanel timecode={timecode} now={now} />
            </Panel>

            <Panel label="Diagnostics" className="px-3 pb-3 pt-4">
              <div className="flex max-h-[120px] flex-col gap-1 overflow-auto">
                {diagnostics.length === 0 ? (
                  <ConsoleMessage text="Diagnostics will appear when devices connect, disconnect, or send suspicious controls." />
                ) : (
                  diagnostics.slice(0, 6).map((diagnostic) => (
                    <div key={diagnostic.id} className="flex items-center gap-2 py-1 font-mono text-[10.5px]">
                      <Led color={diagnostic.level === "critical" ? RED : diagnostic.level === "warning" ? AMBER : SIGNAL_GREEN} size={6} on />
                      <span className="min-w-0 flex-1 truncate text-[#d4cfc0]">{diagnostic.title}</span>
                      <span className="text-[#7a7567]">{formatClock(diagnostic.timestamp).slice(0, 8)}</span>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel label="Live-Rig Checks" className="min-h-[220px] flex-1 px-3 pb-3 pt-4">
              <div className="flex flex-col gap-2">
                <CheckRow active={midiEnabled} text="Browser has MIDI permission." />
                <CheckRow active={selectedConnectedInputs.length > 0} text="At least one connected input is selected." />
                <CheckRow active={Boolean(lastEventAt)} text="MIDI data has arrived during this session." />
                <CheckRow active={Boolean(timecode && now - timecode.timestamp < 2000)} text="MTC/LTC timecode activity detected." />
                <CheckRow active={diagnostics.every((item) => item.level !== "critical")} text="No critical browser/device diagnostic is active." />
              </div>
              <div className="mt-4 rounded border border-[#232019] bg-[#0a0908] p-3 font-mono text-[10px] leading-relaxed text-[#888278]">
                If log keeps moving while Ableton stops responding, inspect Track/Remote mappings and USB hub power.
              </div>
              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#888278]">
                {systemReady ? <CheckCircle2 className="text-[#7dff5a]" /> : <XCircle className="text-[#5a5547]" />}
                {systemReady ? "Monitor online" : "Waiting for signal"}
              </div>
            </Panel>
          </div>
        </section>

        <Panel screws className="shrink-0 px-7 py-4">
          <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-end">
            <div className="min-w-[100px]">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#888278]">Keyboard</div>
              <div className="mt-1 font-mono text-2xl font-bold leading-none text-white">
                {activeNotes.length}
                <span className="ml-2 text-[11px] text-[#7a7567]">NOTES</span>
              </div>
              <div className="mt-1 font-mono text-[9px] text-[#7a7567]">C2 - C7</div>
            </div>
            <VirtualPiano from={36} to={96} held={activeNotes} recentHits={recentKeyHits} sourceColorFor={getSourceColor} />
            <Divider vertical />
            <div className="flex min-w-[105px] flex-row gap-3 min-[900px]:flex-col min-[900px]:items-end">
              <LedLabel color={AMBER} label="Active" on={activeNotes.length > 0} />
              <LedLabel color={SIGNAL_GREEN} label="Monitor" on={midiEnabled} />
              <LedLabel color={AMBER} label="Latch" on={false} />
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Panel({
  children,
  className = "",
  label,
  screws = false,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  screws?: boolean;
}) {
  return (
    <div
      className={`relative rounded-lg border border-[#2a2823] bg-[linear-gradient(180deg,#1c1a17_0%,#131210_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_0_0_1px_#0a0908] ${className}`}
    >
      {label ? (
        <div className="absolute -top-[7px] left-4 z-10 bg-[#0f0e0c] px-2 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-[#888278]">
          {label}
        </div>
      ) : null}
      {screws ? (
        <>
          <Screw className="left-2 top-2" />
          <Screw className="right-2 top-2" />
          <Screw className="bottom-2 left-2" />
          <Screw className="bottom-2 right-2" />
        </>
      ) : null}
      {children}
    </div>
  );
}

function Screw({ className }: { className: string }) {
  return (
    <div
      className={`absolute size-2.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#4a4640_0%,#1c1916_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_1px_1px_rgba(0,0,0,.5)] ${className}`}
    >
      <div className="absolute left-0.5 right-0.5 top-1/2 h-px -translate-y-1/2 rotate-[35deg] bg-black/60" />
    </div>
  );
}

function Led({ color = SIGNAL_GREEN, on = true, size = 8 }: { color?: string; on?: boolean; size?: number }) {
  return (
    <span
      className="inline-block rounded-full align-middle"
      style={{
        width: size,
        height: size,
        background: on ? color : "#2a2620",
        boxShadow: on ? `0 0 ${size}px ${color}, inset 0 0 2px rgba(255,255,255,.5)` : "inset 0 0 2px rgba(0,0,0,.6)",
      }}
    />
  );
}

function LedLabel({ color, label, on = true }: { color: string; label: string; on?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Led color={color} size={7} on={on} />
      <span
        className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: on ? "#d4cfc0" : "#5a5547" }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      className={vertical ? "hidden h-[70px] w-px bg-[#2a2620] min-[760px]:block" : "hidden h-9 w-px bg-[linear-gradient(180deg,transparent,#2a2620,transparent)] lg:block"}
    />
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7a7567]">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold leading-none tracking-[0.02em] text-[#ffa024] [text-shadow:0_0_8px_rgba(255,160,36,.18)]">
        {value}
      </div>
    </div>
  );
}

function ConsoleButton({
  children,
  icon,
  primary = false,
  danger = false,
  disabled = false,
  small = false,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  const colors = primary
    ? "border-[#8a4d00] bg-[linear-gradient(180deg,#ffaa3a_0%,#d97700_100%)] text-[#1a0f00] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_2px_4px_rgba(0,0,0,.4)]"
    : danger
      ? "border-[#3a1c18] bg-[linear-gradient(180deg,#2a1614_0%,#1a0d0c_100%)] text-[#ff8a7a]"
      : "border-[#383530] bg-[linear-gradient(180deg,#28251f_0%,#1a1815_100%)] text-[#d4cfc0] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded border font-mono font-semibold uppercase tracking-[0.08em] transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${colors} ${small ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-[11px]"}`}
    >
      {icon ? <span className="[&_svg]:size-3">{icon}</span> : null}
      {children}
    </button>
  );
}

function ConsoleDevice({
  device,
  selected,
  rate,
  recentlyActive,
  holdingNote,
  sourceColor,
  onToggle,
}: {
  device: PortSnapshot;
  selected: boolean;
  rate: number;
  recentlyActive: boolean;
  holdingNote: boolean;
  sourceColor: string;
  onToggle: (checked: boolean) => void;
}) {
  const connected = device.state === "connected";
  const hasData = rate > 0;
  const ledColor = holdingNote || recentlyActive ? AMBER : selected && connected ? SIGNAL_GREEN : connected ? "#5a5547" : RED;
  const ledOn = holdingNote || recentlyActive || (selected && connected);
  const borderClass = selected && connected
    ? "border-[#343025] border-l-[#343025] bg-[linear-gradient(180deg,#1d1b16_0%,#14120f_100%)]"
    : connected
      ? "border-[#2f2b24] border-l-[#2f2b24] hover:bg-[#1a1815]"
      : "border-[#3a1c18] border-l-[#3a1c18] opacity-60";

  return (
    <button
      type="button"
      onClick={() => onToggle(!selected)}
      disabled={!connected}
      className={`flex w-full items-center gap-2 border px-3 py-2.5 text-left transition disabled:cursor-not-allowed ${borderClass} border-l-[3px]`}
    >
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: sourceColor, boxShadow: `0 0 10px ${sourceColor}` }} />
      <Led color={ledColor} size={8} on={ledOn} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs font-semibold" style={{ color: selected ? "#fff" : "#d4cfc0" }}>
          {device.name}
        </span>
        <span className="mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.1em] text-[#7a7567]">
          {selected ? "Monitoring" : connected ? "Available" : "Disconnected"} · {device.manufacturer}
        </span>
      </span>
      {selected ? (
        <span className="text-right">
          <span className="flex items-center justify-end gap-1 font-mono text-[10px] font-bold" style={{ color: hasData ? AMBER : SIGNAL_GREEN }}>
            {hasData ? <Led color={AMBER} size={5} on /> : null}
            {rate}
          </span>
          <span className="block font-mono text-[8px] uppercase text-[#7a7567]">msg/min</span>
        </span>
      ) : null}
    </button>
  );
}

function ConsoleSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-[#7a7567]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-[3px] border border-[#2a2620] bg-[#0a0908] px-2 font-mono text-[11px] uppercase text-[#d4cfc0] shadow-[inset_0_1px_2px_rgba(0,0,0,.5)] outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function ConsoleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative flex h-4 w-8 items-center rounded-sm border border-[#383530] bg-[#1a1815] px-0.5"
      aria-pressed={checked}
    >
      <span
        className="size-2 bg-[#ffa024] shadow-[0_0_4px_#ffa024] transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
      />
    </button>
  );
}

function Vu({ value = 0, label }: { value?: number; label: string }) {
  const segs = 18;
  const lit = Math.round((value / 127) * segs);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-[70px] flex-col-reverse gap-0.5">
        {Array.from({ length: segs }, (_, index) => {
          const on = index < lit;
          const color = index > segs - 3 ? RED : index > segs - 7 ? AMBER : SIGNAL_GREEN;
          return (
            <div
              key={index}
              className="w-2"
              style={{
                height: 2.5,
                background: on ? color : "#1a1815",
                boxShadow: on ? `0 0 4px ${color}` : "none",
                opacity: on ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>
      <div className="font-mono text-[8px] uppercase text-[#888278]">{label}</div>
    </div>
  );
}

function Scope({
  events,
  activeNotes,
  lastEventAt,
  now,
}: {
  events: MidiEvent[];
  activeNotes: MidiEvent[];
  lastEventAt?: number;
  now: number;
}) {
  const heldLevel = activeNotes.length > 0
    ? Math.max(...activeNotes.map((event) => event.normalized ?? Math.round(((event.velocity ?? event.value ?? 127) / 127) * 100)))
    : 0;
  const recentLevel = lastEventAt ? Math.max(0, 80 - ((now - lastEventAt) / 1200) * 80) : 0;
  const level = activeNotes.length > 0 ? Math.max(95, heldLevel) : recentLevel;

  return (
    <div className="relative h-[86px] min-w-[260px] flex-1 overflow-hidden rounded border border-[#2a2620] bg-[#0a0908]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,160,36,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,160,36,.08)_1px,transparent_1px)] bg-[length:12px_12px]" />
      <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path
          d={buildScopePath(events, 0, level)}
          stroke={level > 70 ? AMBER : "#6c5630"}
          strokeWidth="1.5"
          fill="none"
          style={{ filter: level > 20 ? `drop-shadow(0 0 4px ${AMBER})` : "none" }}
        />
        <path d={buildScopePath(events, 9, level * 0.8)} stroke={SIGNAL_GREEN} strokeWidth="1" fill="none" opacity={level > 0 ? 0.7 : 0.25} />
      </svg>
      <div className="absolute bottom-2 right-2 top-2 w-2 border border-[#2a2620] bg-[#050505]">
        <div
          className="absolute bottom-0 left-0 right-0 bg-[linear-gradient(0deg,#7dff5a_0%,#ffa024_72%,#ff5a4a_100%)] shadow-[0_0_8px_rgba(255,160,36,.45)]"
          style={{ height: `${Math.min(100, level)}%` }}
        />
      </div>
      <div className="absolute left-1.5 top-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#888278]">OSC · MIDI activity</div>
      <div className="absolute bottom-1.5 left-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#888278]">
        {activeNotes.length > 0 ? "held · peak" : level > 0 ? "decay" : "idle"}
      </div>
    </div>
  );
}

function ChannelCell({ channel }: { channel: { channel: number; count: number; rate: number; level: number; last?: MidiEvent } }) {
  const active = Boolean(channel.last && channel.rate > 0);
  return (
    <div
      className="flex flex-col gap-1 rounded border p-1.5"
      style={{
        background: active ? "linear-gradient(180deg, #2a1d0a 0%, #1a1408 100%)" : FACE,
        borderColor: active ? AMBER : "#2a2620",
      }}
    >
      <div className="flex items-center gap-1">
        <Led color={active ? AMBER : "#2a2620"} size={5} on={active} />
        <span className="font-mono text-[9px] font-bold" style={{ color: active ? AMBER : "#7a7567" }}>
          CH{String(channel.channel).padStart(2, "0")}
        </span>
      </div>
      <div className="relative h-1 w-full border border-[#2a2620] bg-[#0a0908]">
        <div
          className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#7dff5a_0%,#ffa024_80%,#ff5a4a_100%)]"
          style={{ width: `${active ? channel.level : 0}%` }}
        />
      </div>
      <span className="font-mono text-[8.5px]" style={{ color: active ? "#fff" : "#5a5547" }}>
        {active ? channel.rate : "-"}
      </span>
    </div>
  );
}

function TimecodePanel({ timecode, now }: { timecode?: TimecodeState; now: number }) {
  const recent = Boolean(timecode && now - timecode.timestamp < 2000);
  const status = timecode
    ? timecode.complete
      ? `${timecode.mode} · ${timecode.rate ?? "unknown fps"}`
      : `${timecode.mode} · acquiring ${timecode.piecesSeen ?? 0}/8`
    : "MTC: no signal";

  return (
    <div className="space-y-2 font-mono">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-bold leading-none tracking-[0.04em] text-white">
          {formatTimecode(timecode)}
        </div>
        <Led color={recent ? AMBER : "#444"} size={8} on={recent} />
      </div>
      <div className="truncate text-[10px] uppercase tracking-[0.12em] text-[#a4a094]">{status}</div>
      <div className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.12em] text-[#7a7567]">
        <span className="truncate">{timecode?.sourceName ?? "No MTC source"}</span>
        <span>{formatAgo(timecode?.timestamp, now)}</span>
      </div>
      <div className="rounded border border-[#232019] bg-[#0a0908] px-2 py-1.5 text-[9px] leading-relaxed text-[#888278]">
        MTC is decoded from MIDI quarter-frame and full-frame SysEx. LTC needs audio input decoding.
      </div>
    </div>
  );
}

function ConsoleMessage({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-[#2a2620] px-3 py-4 font-mono text-[10.5px] leading-relaxed text-[#888278]">
      {text}
    </div>
  );
}

function CheckRow({ active, text }: { active: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10.5px]">
      <Led color={active ? SIGNAL_GREEN : "#444"} size={6} on={active} />
      <span className={active ? "text-[#d4cfc0]" : "text-[#777065]"}>{text}</span>
    </div>
  );
}

function VirtualPiano({
  from,
  to,
  held,
  recentHits,
  sourceColorFor,
}: {
  from: number;
  to: number;
  held: MidiEvent[];
  recentHits: Record<number, RecentKeyHit>;
  sourceColorFor: (sourceId: string) => string;
}) {
  const activeEventByNote = new Map<number, MidiEvent>();
  for (const event of held) {
    if (event.note !== undefined && !activeEventByNote.has(event.note)) {
      activeEventByNote.set(event.note, event);
    }
  }
  const heldNotes = new Set(activeEventByNote.keys());
  const whiteNotes = Array.from({ length: to - from + 1 }, (_, index) => from + index).filter((note) => !BLACK_NOTES.has(note % 12));
  const whiteIndexByNote = new Map<number, number>();
  whiteNotes.forEach((note, index) => whiteIndexByNote.set(note, index));
  const blackNotes = Array.from({ length: to - from + 1 }, (_, index) => from + index).filter((note) => BLACK_NOTES.has(note % 12));
  const activeVisualNotes = Array.from(heldNotes).filter((note) => note >= from && note <= to);

  const noteGeometry = (note: number) => {
    const isBlack = BLACK_NOTES.has(note % 12);
    if (!isBlack) {
      const index = whiteIndexByNote.get(note) ?? 0;
      return {
        left: (index / whiteNotes.length) * 100,
        width: 100 / whiteNotes.length,
        black: false,
      };
    }

    const previousWhite = [...whiteNotes].reverse().find((white) => white < note);
    const previousIndex = previousWhite === undefined ? 0 : whiteIndexByNote.get(previousWhite) ?? 0;
    return {
      left: ((previousIndex + 0.72) / whiteNotes.length) * 100,
      width: 62 / whiteNotes.length,
      black: true,
    };
  };

  return (
    <div className="relative h-[90px] min-w-[620px] flex-1 overflow-hidden rounded-md bg-[#090807]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-[linear-gradient(180deg,rgba(255,160,36,.08),transparent_70%)] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 z-20">
        {activeVisualNotes.map((note) => {
          const active = heldNotes.has(note);
          const noteSourceColor = sourceColorFor(activeEventByNote.get(note)?.sourceId ?? "");
          const geometry = noteGeometry(note);
          const center = geometry.left + geometry.width / 2;
          return (
            <div key={`held-${note}`} className="absolute inset-y-0" style={{ left: `${geometry.left}%`, width: `${geometry.width}%` }}>
              <div
                className="absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-full blur-sm"
                style={{
                  width: geometry.black ? "140%" : "88%",
                  background: `linear-gradient(180deg, ${noteSourceColor}88 0%, ${noteSourceColor}55 42%, ${noteSourceColor}16 72%, transparent 100%)`,
                  opacity: active ? 0.9 : 0.65,
                  animation: active ? "piano-held-pulse 760ms ease-in-out infinite" : "piano-release-bloom 300ms ease-out forwards",
                }}
              />
              {active ? [0, 1, 2].map((spark) => (
                <span
                  key={spark}
                  className="absolute bottom-7 size-1 rounded-full bg-[#ffd28a] shadow-[0_0_8px_rgba(255,160,36,.95)]"
                  style={{
                    backgroundColor: noteSourceColor,
                    boxShadow: `0 0 8px ${noteSourceColor}`,
                    left: `calc(${center - geometry.left}% + ${(spark - 1) * 9}px)`,
                    animation: `piano-spark-rise ${420 + spark * 70}ms ease-out infinite`,
                  }}
                />
              )) : null}
            </div>
          );
        })}
      </div>
      <div className="flex h-full">
        {whiteNotes.map((note) => {
          const active = heldNotes.has(note);
          const hit = recentHits[note];
          const noteSourceColor = sourceColorFor(activeEventByNote.get(note)?.sourceId ?? hit?.sourceId ?? "");
          const glow = Math.max(0.45, ((hit?.velocity ?? 96) / 127) * 0.9);
          return (
            <div
              key={note}
              className="relative flex flex-1 items-end justify-center border-r border-[#8b877d] pb-1 font-mono text-[8px]"
              style={{
                background: active
                  ? `linear-gradient(180deg,#fff4cf 0%,${noteSourceColor} 100%)`
                  : "linear-gradient(180deg,#f2f0ea 0%,#c7c4b8 100%)",
                color: active ? "#1a0f00" : "#5b574e",
                boxShadow: active
                  ? `0 0 ${24 + glow * 24}px ${noteSourceColor}aa, inset 0 0 ${14 + glow * 14}px rgba(255,255,255,.52), inset 0 -18px 22px rgba(0,0,0,.18)`
                  : "inset 0 -3px 4px rgba(0,0,0,.2)",
                transition: active ? "none" : "background 50ms linear, box-shadow 160ms ease-out",
              }}
            >
              {hit && !active ? (
                <span
                  key={hit.id}
                  className="pointer-events-none absolute inset-x-0 bottom-[-4px] top-[-8px]"
                  style={{
                    animation: "piano-release-bloom 260ms ease-out forwards",
                    background: `radial-gradient(circle at 50% 72%, rgba(255,255,255,.92), ${noteSourceColor}99 28%, ${noteSourceColor}33 56%, transparent 76%)`,
                  }}
                />
              ) : null}
              {note % 12 === 0 || active ? <span className="relative z-10">{noteName(note)}</span> : ""}
              {active ? <span className="absolute right-1 top-1 z-10 size-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: noteSourceColor, backgroundColor: noteSourceColor }} /> : null}
            </div>
          );
        })}
      </div>
      {blackNotes.map((note) => {
        const previousWhite = [...whiteNotes].reverse().find((white) => white < note);
        const previousIndex = previousWhite === undefined ? 0 : whiteIndexByNote.get(previousWhite) ?? 0;
        const leftPercent = ((previousIndex + 0.72) / whiteNotes.length) * 100;
        const active = heldNotes.has(note);
        const hit = recentHits[note];
        const noteSourceColor = sourceColorFor(activeEventByNote.get(note)?.sourceId ?? hit?.sourceId ?? "");
        const glow = Math.max(0.45, ((hit?.velocity ?? 96) / 127) * 0.9);
        return (
          <div
            key={note}
            className="absolute top-0 z-10 flex h-[64%] items-end justify-center rounded-b-sm border border-black pb-1 font-mono text-[7px] font-bold"
            style={{
              left: `${leftPercent}%`,
              width: `${62 / whiteNotes.length}%`,
              background: active ? `linear-gradient(180deg,${noteSourceColor} 0%,#050505 100%)` : "linear-gradient(180deg,#1a1815 0%,#050505 100%)",
              boxShadow: active ? `0 0 ${22 + glow * 22}px ${noteSourceColor}cc, inset 0 -10px 16px rgba(255,255,255,.2), 0 3px 5px rgba(0,0,0,.65)` : "0 3px 5px rgba(0,0,0,.65)",
              color: active ? "#1a0f00" : "transparent",
              transition: active ? "none" : "background 50ms linear, box-shadow 160ms ease-out",
            }}
            title={noteName(note)}
          >
            {hit && !active ? (
              <span
                key={hit.id}
                className="pointer-events-none absolute inset-x-[-2px] bottom-[-14px] top-[-10px] rounded-b-full"
                style={{
                  animation: "piano-release-bloom 260ms ease-out forwards",
                  background: `radial-gradient(circle at 50% 62%, rgba(255,255,255,.92), ${noteSourceColor}aa 26%, ${noteSourceColor}38 56%, transparent 76%)`,
                }}
              />
            ) : null}
            {active ? <span className="absolute right-1 top-1 z-10 size-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: noteSourceColor, backgroundColor: noteSourceColor }} /> : null}
            {active ? <span className="relative z-10">{noteName(note)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
