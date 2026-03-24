// ─── Core ─────────────────────────────────────────────────────────────────────
export { FlarewatchClient } from "./core/client";
export { init, getClient, destroy, isInitialized } from "./core/instance";

// ─── Transports ───────────────────────────────────────────────────────────────
export { httpTransport } from "./transports/http";
export { consoleTransport } from "./transports/console";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  FlarewatchConfig,
  FlarewatchEvent,
  Transport,
  EventType,
  Severity,
} from "./types";

export type { HttpTransportOptions } from "./transports/http";
export type { ConsoleTransportOptions } from "./transports/console";
