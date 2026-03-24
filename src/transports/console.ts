import type { Transport, FlarewatchEvent, Severity } from "../types";

export interface ConsoleTransportOptions {
  /**
   * Nível mínimo para exibir no console.
   * @default "debug"
   */
  minLevel?: Severity;
  /**
   * Exibe o objeto completo do evento abaixo da mensagem.
   * @default false
   */
  verbose?: boolean;
}

const COLORS: Record<Severity, string> = {
  fatal:   "background:#7F1D1D;color:#FEF2F2;font-weight:bold;padding:2px 6px;border-radius:3px",
  error:   "background:#991B1B;color:#FEF2F2;font-weight:bold;padding:2px 6px;border-radius:3px",
  warning: "background:#92400E;color:#FFFBEB;font-weight:bold;padding:2px 6px;border-radius:3px",
  info:    "background:#1E3A5F;color:#EFF6FF;font-weight:bold;padding:2px 6px;border-radius:3px",
  debug:   "background:#1F2937;color:#F9FAFB;font-weight:bold;padding:2px 6px;border-radius:3px",
};

const SEVERITY_RANK: Record<Severity, number> = {
  debug: 0, info: 1, warning: 2, error: 3, fatal: 4,
};

export function consoleTransport(options: ConsoleTransportOptions = {}): Transport {
  const { minLevel = "debug", verbose = false } = options;

  return {
    name: "console",
    send(event: FlarewatchEvent): void {
      if (SEVERITY_RANK[event.severity] < SEVERITY_RANK[minLevel]) return;

      const label = `[flarewatch] ${event.type}`;
      const style = COLORS[event.severity];
      const msg   = event.message;

      const fn = event.severity === "fatal" || event.severity === "error"
        ? console.error
        : event.severity === "warning"
        ? console.warn
        : event.severity === "debug"
        ? console.debug
        : console.info;

      if (verbose) {
        fn(`%c${label}%c ${msg}`, style, "color:inherit", event);
      } else {
        fn(`%c${label}%c ${msg}`, style, "color:inherit");
      }
    },
  };
}
