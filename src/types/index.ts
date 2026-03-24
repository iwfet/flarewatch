// ─── Severidade e tipo de evento ────────────────────────────────────────────

export type Severity = "fatal" | "error" | "warning" | "info" | "debug";

export type EventType =
  | "error.render"
  | "error.global"
  | "error.promise"
  | "error.api"
  | "log.info"
  | "log.warn"
  | "log.error"
  | "log.debug"
  | "perf.lcp"
  | "perf.fid"
  | "perf.cls"
  | "perf.ttfb"
  | "perf.fcp";

// ─── Payload enviado aos transports ─────────────────────────────────────────

export interface FlarewatchEvent {
  /** Identificador único do evento */
  id: string;
  /** Tipo estruturado do evento */
  type: EventType;
  /** Severidade */
  severity: Severity;
  /** Mensagem legível */
  message: string;
  /** Stack trace (quando disponível) */
  stack?: string;
  /** URL onde ocorreu */
  url: string;
  /** User agent */
  userAgent: string;
  /** ISO timestamp */
  timestamp: string;
  /** Duração da sessão em segundos */
  sessionDuration: number;
  /** Dados extras livres */
  context?: Record<string, unknown>;
}

// ─── Transport (destino dos dados) ──────────────────────────────────────────

export interface Transport {
  /** Nome identificador do transport */
  name: string;
  /**
   * Chamado para cada evento capturado.
   * Pode ser async — erros internos são silenciados.
   */
  send(event: FlarewatchEvent): void | Promise<void>;
}

// ─── Configuração do init() ──────────────────────────────────────────────────

export interface FlarewatchConfig {
  /**
   * Lista de transports ativos.
   * Use `httpTransport()`, `consoleTransport()` ou crie o seu.
   */
  transports: Transport[];

  /**
   * Capturar erros JS globais (window.onerror).
   * @default true
   */
  captureGlobalErrors?: boolean;

  /**
   * Capturar promises rejeitadas sem .catch().
   * @default true
   */
  captureUnhandledRejections?: boolean;

  /**
   * Capturar métricas de performance via PerformanceObserver (LCP, FID, CLS, FCP, TTFB).
   * @default true
   */
  capturePerformance?: boolean;

  /**
   * Nível mínimo de log para capturar.
   * @default "debug"
   */
  minLogLevel?: Severity;

  /**
   * Dados extras incluídos em todos os eventos (ex: userId, appVersion).
   */
  defaultContext?: Record<string, unknown>;

  /**
   * Hook chamado antes de enviar — retorne false para descartar o evento.
   */
  beforeSend?: (event: FlarewatchEvent) => FlarewatchEvent | false;

  /**
   * Ativa logs de debug da própria lib no console.
   * @default false
   */
  debug?: boolean;
}
