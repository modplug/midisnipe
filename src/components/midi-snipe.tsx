"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clipboard,
  Download,
  Eraser,
  Filter,
  Keyboard,
  ListRestart,
  Lock,
  Music2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Usb,
  Waves,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
  open?: () => Promise<MidiInputLike>;
  close?: () => Promise<MidiInputLike>;
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

const MAX_EVENTS = 1500;
const MAX_DIAGNOSTICS = 100;
const MESSAGE_FILTERS = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "cc", label: "CC" },
  { value: "pitch", label: "Pitch" },
  { value: "program", label: "Program" },
  { value: "system", label: "System" },
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
  if (!timestamp) return "never";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 1) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s ago`;
}

function hex(data: number[]): string {
  return data.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function noteName(note: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
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
    return {
      ...common,
      kind: "sysex",
      label: `SysEx ${data.length} bytes`,
      normalized: 100,
    };
  }

  if (status >= 0xf0) {
    return {
      ...common,
      kind: "system",
      label: systemLabel(status),
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
      label: `CC ${data[1]} value ${data[2]}`,
    };
  }

  if (command === 0xc0 && data.length >= 2) {
    return {
      ...common,
      kind: "program",
      value: data[1],
      normalized: Math.round((data[1] / 127) * 100),
      label: `Program change ${data[1]}`,
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

function KindBadge({ kind }: { kind: MessageKind }) {
  const label = {
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
  }[kind];

  return (
    <Badge
      variant={
        kind === "unknown" || kind === "sysex"
          ? "destructive"
          : kind === "cc"
            ? "default"
            : "secondary"
      }
      className="font-mono"
    >
      {label}
    </Badge>
  );
}

function StatusBadge({ state }: { state: MidiDeviceState | MidiConnectionState }) {
  const isGood = state === "connected" || state === "open";
  const isPending = state === "pending";

  return (
    <Badge variant={isGood ? "default" : isPending ? "secondary" : "outline"} className="gap-1">
      {isGood ? <CheckCircle2 data-icon="inline-start" /> : <XCircle data-icon="inline-start" />}
      {state}
    </Badge>
  );
}

export function MidiSnipe() {
  const midiAccessRef = React.useRef<MidiAccessLike | null>(null);
  const inputsRef = React.useRef<Map<string, MidiInputLike>>(new Map());
  const eventCounterRef = React.useRef(0);
  const lastCcRef = React.useRef<Map<string, CcMemory>>(new Map());
  const activeNotesRef = React.useRef<Map<string, MidiEvent>>(new Map());

  const [inputs, setInputs] = React.useState<PortSnapshot[]>([]);
  const [outputs, setOutputs] = React.useState<PortSnapshot[]>([]);
  const [selectedInputIds, setSelectedInputIds] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState<MidiEvent[]>([]);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticEvent[]>([]);
  const [activeNotes, setActiveNotes] = React.useState<MidiEvent[]>([]);
  const [midiEnabled, setMidiEnabled] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [includeSysex, setIncludeSysex] = React.useState(false);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [channelFilter, setChannelFilter] = React.useState("all");
  const [messageFilter, setMessageFilter] = React.useState("all");
  const [ccFilter, setCcFilter] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
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
    const outputPorts = Array.from(access.outputs.values());
    const nextInputs = inputPorts.map(snapshotPort);
    const nextOutputs = outputPorts.map(snapshotPort);
    inputsRef.current = new Map(inputPorts.map((input) => [input.id, input]));
    setInputs(nextInputs);
    setOutputs(nextOutputs);

    setSelectedInputIds((current) => {
      const validIds = new Set(nextInputs.filter((input) => input.state === "connected").map((input) => input.id));
      const retained = current.filter((id) => validIds.has(id));
      if (retained.length > 0 || current.length > 0) return retained;
      return Array.from(validIds);
    });
  }, []);

  const handleMidiMessage = React.useCallback(
    (source: MidiInputLike, message: MidiMessageEventLike) => {
      if (isPaused) return;

      const now = Date.now();
      const bytes = Array.from(message.data);
      const base = {
        id: "",
        sourceId: source.id,
        sourceName: portName(source),
        manufacturer: portManufacturer(source),
        timestamp: now,
      };
      const decoded = decodePacket(bytes, base).map((event) => ({
        ...event,
        id: `${now}-${eventCounterRef.current++}`,
      }));

      for (const event of decoded) {
        if (event.kind === "cc" && event.channel && event.controller !== undefined && event.value !== undefined) {
          const key = `${event.sourceId}:${event.channel}:${event.controller}`;
          const last = lastCcRef.current.get(key);

          if (last && last.value > 0 && event.value === 0 && now - last.timestamp < 1500) {
            addDiagnostic({
              level: "info",
              title: "Possible spring or release-to-zero control",
              detail: `${event.sourceName} sent Ch ${event.channel} CC ${event.controller} back to 0 after ${now - last.timestamp} ms.`,
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
              title: "Volume-class controller detected",
              detail: `${event.sourceName} sent CC ${event.controller} on Ch ${event.channel}. Instruments may treat this as volume or expression.`,
            });
          }

          lastCcRef.current.set(key, { value: event.value, timestamp: now });
        }

        if (event.kind === "note-on" && event.note !== undefined && event.velocity !== 0) {
          activeNotesRef.current.set(`${event.sourceId}:${event.channel}:${event.note}`, event);
        }

        if (event.kind === "note-off" && event.note !== undefined) {
          activeNotesRef.current.delete(`${event.sourceId}:${event.channel}:${event.note}`);
        }
      }

      setActiveNotes(Array.from(activeNotesRef.current.values()));
      setLastEventAt(now);
      setEvents((current) => [...decoded, ...current].slice(0, MAX_EVENTS));
    },
    [addDiagnostic, isPaused]
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

  const visibleEvents = React.useMemo(() => {
    const ccNumber = ccFilter.trim() === "" ? undefined : Number(ccFilter);
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return events.filter((event) => {
      if (hideClock && event.hex === "F8") return false;
      if (sourceFilter !== "all" && event.sourceId !== sourceFilter) return false;
      if (channelFilter !== "all" && event.channel !== Number(channelFilter)) return false;
      if (!matchesMessageFilter(event, messageFilter)) return false;
      if (ccNumber !== undefined && event.controller !== ccNumber) return false;
      if (!normalizedSearch) return true;
      return `${event.sourceName} ${event.hex} ${event.label} ${event.channel ?? ""}`.toLowerCase().includes(normalizedSearch);
    });
  }, [ccFilter, channelFilter, events, hideClock, messageFilter, searchTerm, sourceFilter]);

  const connectedInputs = inputs.filter((input) => input.state === "connected");
  const selectedConnectedInputs = connectedInputs.filter((input) => selectedInputIds.includes(input.id));
  const duplicateNames = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const input of inputs) counts.set(input.name, (counts.get(input.name) ?? 0) + 1);
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name);
  }, [inputs]);

  const channelActivity = React.useMemo(() => {
    return Array.from({ length: 16 }, (_, index) => {
      const channel = index + 1;
      const channelEvents = events.filter((event) => event.channel === channel);
      const last = channelEvents[0];
      return {
        channel,
        count: channelEvents.length,
        last,
        level: Math.min(100, channelEvents.length * 2),
      };
    });
  }, [events]);

  const ccActivity = React.useMemo(() => {
    const map = new Map<string, { event: MidiEvent; count: number }>();
    for (const event of events) {
      if (event.kind !== "cc" || event.channel === undefined || event.controller === undefined) continue;
      const key = `${event.sourceId}:${event.channel}:${event.controller}`;
      const existing = map.get(key);
      map.set(key, { event, count: (existing?.count ?? 0) + 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.event.timestamp - a.event.timestamp).slice(0, 24);
  }, [events]);

  const eventRate = React.useMemo(() => {
    const cutoff = now - 10_000;
    return Math.round((events.filter((event) => event.timestamp >= cutoff).length / 10) * 60);
  }, [events, now]);

  const exportLog = React.useCallback(() => {
    const text = visibleEvents
      .slice()
      .reverse()
      .map((event) => {
        const channel = event.channel ? `ch ${event.channel}` : "system";
        return `${formatClock(event.timestamp)}\t${event.sourceName}\t${event.hex}\t${channel}\t${event.label}`;
      })
      .join("\n");

    downloadText(`midi-debug-${new Date().toISOString().replaceAll(":", "-")}.txt`, text);
  }, [visibleEvents]);

  const copyLog = React.useCallback(async () => {
    const text = visibleEvents
      .slice(0, 200)
      .map((event) => `${formatClock(event.timestamp)}  ${event.sourceName}  ${event.hex}  ${event.label}`)
      .join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Copied visible MIDI log");
  }, [visibleEvents]);

  const supportIssue = !browserCapabilities.isSecure || !browserCapabilities.isMidiSupported;
  const staleDevice = selectedConnectedInputs.length > 0 && lastEventAt && now - lastEventAt > 5000;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Waves />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold leading-tight">MIDI Snipe</h1>
                <Badge variant="outline" className="font-mono">
                  Web MIDI
                </Badge>
                <Badge variant={midiEnabled ? "default" : "secondary"} className="gap-1">
                  {midiEnabled ? <Radio data-icon="inline-start" /> : <Cable data-icon="inline-start" />}
                  {midiEnabled ? "listening" : "idle"}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Inspect MIDI inputs in the browser, catch disconnects, decode raw bytes, and separate USB problems from DAW routing problems.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              title="Web MIDI requires HTTPS or localhost."
            >
              <Lock />
              <span className="text-sm">{browserCapabilities.isSecure ? "secure context" : "not secure"}</span>
            </div>
            <Button variant="outline" onClick={() => setIsPaused((value) => !value)}>
              {isPaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" onClick={refreshPorts} disabled={!midiEnabled}>
              <RefreshCw data-icon="inline-start" />
              Rescan
            </Button>
            <Button onClick={requestMidi} disabled={requesting || supportIssue}>
              <Usb data-icon="inline-start" />
              {requesting ? "Requesting" : midiEnabled ? "Reconnect" : "Enable MIDI"}
            </Button>
          </div>
        </header>

        {supportIssue ? (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Browser cannot open MIDI devices</AlertTitle>
            <AlertDescription>
              Open this app in desktop Chrome or Edge over HTTPS or localhost. Safari and iOS do not provide reliable Web MIDI access.
            </AlertDescription>
          </Alert>
        ) : null}

        {duplicateNames.length > 0 ? (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Duplicate MIDI device names</AlertTitle>
            <AlertDescription>
              {duplicateNames.join(", ")} appears more than once. If Ableton mappings behave strangely, delete stale MIDI ports or remap to the currently connected device.
            </AlertDescription>
          </Alert>
        ) : null}

        {staleDevice ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Selected device is quiet</AlertTitle>
            <AlertDescription>
              No MIDI has arrived for {formatAgo(lastEventAt, now)}. If the device still looks connected, check hub power, dongle placement, and USB selective suspend.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 min-[1500px]:grid-cols-[360px_minmax(560px,1fr)_420px]">
          <aside className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>Inputs, outputs, and listener selection.</CardDescription>
                <CardAction>
                  <Badge variant="secondary">{connectedInputs.length} input</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="events" value={events.length.toLocaleString()} />
                  <Metric label="rate" value={`${eventRate}/m`} />
                  <Metric label="last" value={formatAgo(lastEventAt, now)} />
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Keyboard />
                      Inputs
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedInputIds(connectedInputs.map((input) => input.id))}
                    >
                      All
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {inputs.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Enable MIDI to list available devices.
                      </div>
                    ) : (
                      inputs.map((input) => (
                        <label
                          key={input.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            selectedInputIds.includes(input.id) ? "bg-muted" : "hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={selectedInputIds.includes(input.id)}
                            disabled={input.state !== "connected"}
                            onCheckedChange={(checked) => toggleInput(input.id, checked === true)}
                            aria-label={`Listen to ${input.name}`}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-sm font-medium">{input.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{input.manufacturer}</span>
                            <span className="flex flex-wrap gap-1">
                              <StatusBadge state={input.state} />
                              <StatusBadge state={input.connection} />
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Cable />
                    Outputs
                  </div>
                  {outputs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outputs visible yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {outputs.slice(0, 5).map((output) => (
                        <div key={output.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm">{output.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{output.manufacturer}</div>
                          </div>
                          <StatusBadge state={output.state} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">SysEx permission</div>
                    <div className="text-xs text-muted-foreground">Ask only when you need firmware/editor dumps.</div>
                  </div>
                  <Switch checked={includeSysex} onCheckedChange={setIncludeSysex} aria-label="Request SysEx permission" />
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Narrow the live log without dropping captured events.</CardDescription>
                <CardAction>
                  <Filter />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Field label="Source">
                  <Select value={sourceFilter} onValueChange={(value) => value && setSourceFilter(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All sources</SelectItem>
                        {inputs.map((input) => (
                          <SelectItem key={input.id} value={input.id}>
                            {input.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Message">
                    <Select value={messageFilter} onValueChange={(value) => value && setMessageFilter(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Message" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {MESSAGE_FILTERS.map((filter) => (
                            <SelectItem key={filter.value} value={filter.value}>
                              {filter.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Channel">
                    <Select value={channelFilter} onValueChange={(value) => value && setChannelFilter(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All</SelectItem>
                          {Array.from({ length: 16 }, (_, index) => (
                            <SelectItem key={index + 1} value={`${index + 1}`}>
                              Ch {index + 1}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="CC #">
                    <Input
                      type="text"
                      value={ccFilter}
                      onChange={(event) => setCcFilter(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                      placeholder="Any"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Search">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-2 text-muted-foreground" />
                      <Input
                        type="search"
                        className="pl-8"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Vortex, B0..."
                      />
                    </div>
                  </Field>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">Hide MIDI clock</div>
                    <div className="text-xs text-muted-foreground">Suppress high-volume F8 timing messages.</div>
                  </div>
                  <Switch checked={hideClock} onCheckedChange={setHideClock} aria-label="Hide MIDI clock messages" />
                </div>
              </CardContent>
            </Card>
          </aside>

          <Card className="min-h-[760px]">
            <CardHeader>
              <CardTitle>Live MIDI Log</CardTitle>
              <CardDescription>Raw bytes and decoded message semantics from selected inputs.</CardDescription>
              <CardAction className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyLog} disabled={visibleEvents.length === 0}>
                  <Clipboard data-icon="inline-start" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={exportLog} disabled={visibleEvents.length === 0}>
                  <Download data-icon="inline-start" />
                  Export
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setEvents([])} disabled={events.length === 0}>
                  <Eraser data-icon="inline-start" />
                  Clear
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              <ScrollArea className="h-[680px]">
                <Table className="min-w-[760px]">
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-[118px]">Time</TableHead>
                      <TableHead className="w-[190px]">Source</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead className="w-[84px]">Ch</TableHead>
                      <TableHead className="w-[220px]">Bytes</TableHead>
                      <TableHead>Decoded</TableHead>
                      <TableHead className="w-[120px]">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="whitespace-normal">
                          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                            <Music2 />
                            <div>
                              <div className="font-medium">No MIDI messages visible</div>
                              <div className="text-sm text-muted-foreground">
                                Enable MIDI, select an input, then play keys or move a control.
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleEvents.map((event) => (
                        <TableRow key={event.id} className="font-mono text-xs">
                          <TableCell>{formatClock(event.timestamp)}</TableCell>
                          <TableCell>
                            <div className="max-w-[180px] truncate font-sans text-sm">{event.sourceName}</div>
                          </TableCell>
                          <TableCell>
                            <KindBadge kind={event.kind} />
                          </TableCell>
                          <TableCell>{event.channel ? `Ch ${event.channel}` : "sys"}</TableCell>
                          <TableCell className="tracking-wide">{event.hex}</TableCell>
                          <TableCell className="font-sans text-sm">{event.label}</TableCell>
                          <TableCell>
                            {event.normalized !== undefined ? (
                              <div className="flex items-center gap-2">
                                <Progress value={event.normalized} className="h-2" />
                                <span className="w-8 text-right">{event.value}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Channel pressure, CC use, and notes currently held.</CardDescription>
                <CardAction>
                  <Activity />
                </CardAction>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="channels">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                    <TabsTrigger value="cc">CC</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="channels" className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {channelActivity.map((channel) => (
                        <div key={channel.channel} className="rounded-lg border p-2">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-medium">Ch {channel.channel}</span>
                            <span className="text-muted-foreground">{channel.count}</span>
                          </div>
                          <Progress value={channel.level} className="h-2" />
                          <div className="mt-2 truncate text-xs text-muted-foreground">
                            {channel.last?.label ?? "silent"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="cc" className="mt-4">
                    <ScrollArea className="h-[360px]">
                      <div className="flex flex-col gap-2 pr-3">
                        {ccActivity.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No CC messages yet.</p>
                        ) : (
                          ccActivity.map(({ event, count }) => (
                            <div key={`${event.sourceId}:${event.channel}:${event.controller}`} className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">
                                    Ch {event.channel} CC {event.controller}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">{event.sourceName}</div>
                                </div>
                                <Badge variant="secondary" className="font-mono">
                                  {count}x
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-xs">
                                <Progress value={event.normalized ?? 0} className="h-2" />
                                <span className="w-8 text-right">{event.value}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="notes" className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {activeNotes.length === 0 ? (
                        <p className="col-span-2 text-sm text-muted-foreground">No held notes.</p>
                      ) : (
                        activeNotes.map((event) => (
                          <div key={`${event.sourceId}:${event.channel}:${event.note}`} className="rounded-lg border p-3">
                            <div className="text-lg font-semibold">{noteName(event.note ?? 0)}</div>
                            <div className="text-xs text-muted-foreground">Ch {event.channel} velocity {event.velocity}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Diagnostics</CardTitle>
                <CardDescription>Connection changes and risky controller messages.</CardDescription>
                <CardAction>
                  <ListRestart />
                </CardAction>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[286px]">
                  <div className="flex flex-col gap-2 pr-3">
                    {diagnostics.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Diagnostics will appear when devices connect, disconnect, or send suspicious controls.
                      </div>
                    ) : (
                      diagnostics.map((diagnostic) => (
                        <div
                          key={diagnostic.id}
                          className={cn(
                            "rounded-lg border p-3",
                            diagnostic.level === "critical" && "border-destructive/60",
                            diagnostic.level === "warning" && "border-primary/50"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              {diagnostic.level === "info" ? <CheckCircle2 /> : <AlertTriangle />}
                              {diagnostic.title}
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{formatClock(diagnostic.timestamp)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{diagnostic.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Live-Rig Checks</CardTitle>
                <CardDescription>Fast interpretation while debugging Ableton rigs.</CardDescription>
                <CardAction>
                  <SlidersHorizontal />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <CheckRow active={midiEnabled} text="Browser has MIDI permission." />
                <CheckRow active={selectedConnectedInputs.length > 0} text="At least one connected input is selected." />
                <CheckRow active={Boolean(lastEventAt)} text="MIDI data has arrived during this session." />
                <CheckRow active={diagnostics.every((item) => item.level !== "critical")} text="No critical browser/device diagnostic is active." />
                <Separator />
                <p className="text-muted-foreground">
                  If this log keeps moving while Ableton stops responding, inspect Ableton Track/Remote settings, mappings, and duplicate port names.
                  If this log stops too, focus on USB hub power, dongle placement, and OS power saving.
                </p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-sm font-medium">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CheckRow({ active, text }: { active: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {active ? <CheckCircle2 className="text-primary" /> : <XCircle className="text-muted-foreground" />}
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}
