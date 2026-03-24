import type {
  FlarewatchConfig,
  FlarewatchEvent,
  EventType,
  Severity,
} from "../types";

// ─── Utilitários internos ────────────────────────────────────────────────────

function uid(): string {
  return `fw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const SEVERITY_RANK: Record<Severity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  fatal: 4,
};

// ─── Client ─────────────────────────────────────────────────────────────────

export class FlarewatchClient {
  private config: Required<FlarewatchConfig>;
  private sessionStart = Date.now();
  private initialized = false;

  constructor(config: FlarewatchConfig) {
    this.config = {
      captureGlobalErrors: true,
      captureUnhandledRejections: true,
      capturePerformance: true,
      minLogLevel: "debug",
      defaultContext: {},
      beforeSend: (e) => e,
      debug: false,
      ...config,
    };
  }

  // ─── Inicialização ─────────────────────────────────────────────────────────

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (this.config.captureGlobalErrors) this.attachGlobalErrors();
    if (this.config.captureUnhandledRejections) this.attachUnhandledRejections();
    if (this.config.capturePerformance) this.attachPerformance();

    this.debugLog("flarewatch initialized", this.config);
  }

  destroy(): void {
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
    this.initialized = false;
  }

  // ─── API pública de log ────────────────────────────────────────────────────

  log(message: string, context?: Record<string, unknown>): void {
    this.capture("log.info", "info", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.capture("log.info", "info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.capture("log.warn", "warning", message, context);
  }

  error(message: string | Error, context?: Record<string, unknown>): void {
    const err = message instanceof Error ? message : new Error(message);
    this.capture("log.error", "error", err.message, { stack: err.stack, ...context });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.capture("log.debug", "debug", message, context);
  }

  // ─── Captura de erro de render (usado pelo ErrorBoundary) ─────────────────

  captureRenderError(error: Error, componentStack: string): void {
    this.capture("error.render", "fatal", error.message, {
      stack: error.stack,
      componentStack,
    });
  }

  // ─── Wrapper de fetch ──────────────────────────────────────────────────────

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;

    try {
      const res = await globalThis.fetch(input, init);

      if (!res.ok) {
        this.capture("error.api", res.status >= 500 ? "error" : "warning", `HTTP ${res.status}`, {
          endpoint: url,
          status: res.status,
          statusText: res.statusText,
          method: init?.method ?? "GET",
        });
      }

      return res;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.capture("error.api", "error", error.message, {
        endpoint: url,
        method: init?.method ?? "GET",
        stack: error.stack,
      });
      throw err;
    }
  }

  // ─── Captura interna ───────────────────────────────────────────────────────

  capture(
    type: EventType,
    severity: Severity,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (SEVERITY_RANK[severity] < SEVERITY_RANK[this.config.minLogLevel]) return;

    const raw: FlarewatchEvent = {
      id: uid(),
      type,
      severity,
      message,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      timestamp: new Date().toISOString(),
      sessionDuration: Math.round((Date.now() - this.sessionStart) / 1000),
      context: {
        ...this.config.defaultContext,
        ...context,
      },
    };

    const event = this.config.beforeSend(raw);
    if (event === false) {
      this.debugLog("event discarded by beforeSend", raw);
      return;
    }

    this.dispatch(event);
  }

  // ─── Despacho para transports ──────────────────────────────────────────────

  private dispatch(event: FlarewatchEvent): void {
    for (const transport of this.config.transports) {
      try {
        const result = transport.send(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            this.debugLog(`transport "${transport.name}" failed`, err);
          });
        }
      } catch (err) {
        this.debugLog(`transport "${transport.name}" threw`, err);
      }
    }
  }

  // ─── Listeners globais ─────────────────────────────────────────────────────

  private onError = (e: ErrorEvent): void => {
    this.capture("error.global", "error", e.message, {
      stack: e.error?.stack,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  };

  private onUnhandledRejection = (e: PromiseRejectionEvent): void => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    this.capture("error.promise", "error", err.message, { stack: err.stack });
  };

  private attachGlobalErrors(): void {
    window.addEventListener("error", this.onError);
  }

  private attachUnhandledRejections(): void {
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  // ─── Performance (Web Vitals via PerformanceObserver) ─────────────────────

  private attachPerformance(): void {
    if (typeof PerformanceObserver === "undefined") return;

    // LCP
    this.observeMetric("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      const value = last.renderTime ?? last.loadTime ?? 0;
      this.capture("perf.lcp", this.lcpSeverity(value), "LCP", { value, unit: "ms" });
    });

    // CLS
    this.observeMetric("layout-shift", (entries) => {
      let cls = 0;
      for (const e of entries) {
        const entry = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
      if (cls > 0) {
        this.capture("perf.cls", this.clsSeverity(cls), "CLS", { value: parseFloat(cls.toFixed(4)), unit: "score" });
      }
    });

    // FID
    this.observeMetric("first-input", (entries) => {
      const e = entries[0] as PerformanceEntry & { processingStart?: number };
      const value = (e.processingStart ?? 0) - e.startTime;
      this.capture("perf.fid", this.fidSeverity(value), "FID", { value: Math.round(value), unit: "ms" });
    });

    // FCP + TTFB via navigation
    this.observePaintAndNav();
  }

  private observeMetric(type: string, cb: (entries: PerformanceEntry[]) => void): void {
    try {
      const obs = new PerformanceObserver((list) => cb(list.getEntries()));
      obs.observe({ type, buffered: true });
    } catch {
      // métrica não suportada no browser — silencia
    }
  }

  private observePaintAndNav(): void {
    try {
      // FCP
      const paintObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            this.capture("perf.fcp", this.fcpSeverity(entry.startTime), "FCP", {
              value: Math.round(entry.startTime),
              unit: "ms",
            });
          }
        }
      });
      paintObs.observe({ type: "paint", buffered: true });
    } catch { /* não suportado */ }

    // TTFB via navigation timing
    if (typeof window !== "undefined") {
      window.addEventListener("load", () => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav) {
          const ttfb = Math.round(nav.responseStart - nav.requestStart);
          this.capture("perf.ttfb", this.ttfbSeverity(ttfb), "TTFB", { value: ttfb, unit: "ms" });
        }
      }, { once: true });
    }
  }

  // ─── Thresholds de severidade (Core Web Vitals) ───────────────────────────

  private lcpSeverity(ms: number): Severity {
    if (ms <= 2500) return "info";
    if (ms <= 4000) return "warning";
    return "error";
  }

  private clsSeverity(score: number): Severity {
    if (score <= 0.1) return "info";
    if (score <= 0.25) return "warning";
    return "error";
  }

  private fidSeverity(ms: number): Severity {
    if (ms <= 100) return "info";
    if (ms <= 300) return "warning";
    return "error";
  }

  private fcpSeverity(ms: number): Severity {
    if (ms <= 1800) return "info";
    if (ms <= 3000) return "warning";
    return "error";
  }

  private ttfbSeverity(ms: number): Severity {
    if (ms <= 800) return "info";
    if (ms <= 1800) return "warning";
    return "error";
  }

  // ─── Debug interno ────────────────────────────────────────────────────────

  private debugLog(msg: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.debug(`[flarewatch] ${msg}`, ...args);
    }
  }
}
