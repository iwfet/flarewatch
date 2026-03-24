import type { Transport, FlarewatchEvent } from "../types";

export interface HttpTransportOptions {
  /** URL do endpoint que recebe os eventos */
  url: string;
  /**
   * Headers adicionais (ex: Authorization).
   * @default {}
   */
  headers?: Record<string, string>;
  /**
   * Enviar eventos em batch após X ms de debounce.
   * 0 = envio imediato por evento.
   * @default 2000
   */
  batchMs?: number;
  /**
   * Tamanho máximo do batch antes de forçar envio.
   * @default 20
   */
  batchSize?: number;
  /**
   * Timeout da requisição em ms.
   * @default 8000
   */
  timeout?: number;
  /**
   * Quantas vezes tentar reenviar em caso de falha.
   * @default 3
   */
  retries?: number;
  /**
   * Salvar eventos no localStorage quando offline e reenviar depois.
   * @default true
   */
  offlineFallback?: boolean;
  /**
   * Chave usada no localStorage para eventos pendentes.
   * @default "__flarewatch_queue"
   */
  storageKey?: string;
}

const STORAGE_KEY = "__flarewatch_queue";

export function httpTransport(options: HttpTransportOptions): Transport {
  const {
    url,
    headers = {},
    batchMs = 2000,
    batchSize = 20,
    timeout = 8000,
    retries = 3,
    offlineFallback = true,
    storageKey = STORAGE_KEY,
  } = options;

  let queue: FlarewatchEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  // ─── Envio da fila ────────────────────────────────────────────────────────

  async function flush(): Promise<void> {
    if (queue.length === 0) return;
    const batch = queue.splice(0, batchSize);
    await sendWithRetry(batch, retries);
  }

  async function sendWithRetry(batch: FlarewatchEvent[], attempts: number): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeout);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
          signal: controller.signal,
        });

        clearTimeout(t);

        if (res.ok) {
          // limpa da fila offline se havia eventos salvos
          if (offlineFallback) drainStorage(storageKey);
          return;
        }

        // 4xx não adianta retry
        if (res.status >= 400 && res.status < 500) return;

      } catch {
        const isLast = i === attempts - 1;
        if (isLast && offlineFallback) {
          saveToStorage(storageKey, batch);
        } else if (!isLast) {
          await sleep(500 * 2 ** i); // backoff exponencial: 500ms, 1s, 2s
        }
      }
    }
  }

  function schedule(): void {
    if (batchMs === 0) {
      flush();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, batchMs);
  }

  // ─── Fila offline ─────────────────────────────────────────────────────────

  function saveToStorage(key: string, events: FlarewatchEvent[]): void {
    try {
      const existing: FlarewatchEvent[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const merged = [...existing, ...events].slice(-100); // max 100 eventos
      localStorage.setItem(key, JSON.stringify(merged));
    } catch { /* localStorage indisponível */ }
  }

  function drainStorage(key: string): void {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const pending: FlarewatchEvent[] = JSON.parse(raw);
      if (!pending.length) return;
      localStorage.removeItem(key);
      // reenvia sem retry para não criar loop
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(pending),
      }).catch(() => {
        // se falhar de novo, salva de volta
        saveToStorage(key, pending);
      });
    } catch { /* ignora */ }
  }

  // drena na inicialização (caso haja eventos salvos de sessão anterior)
  if (typeof window !== "undefined" && offlineFallback) {
    window.addEventListener("online", () => drainStorage(storageKey), { once: false });
    // tenta drenar imediatamente se já estiver online
    if (navigator.onLine) drainStorage(storageKey);
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  return {
    name: "http",
    send(event: FlarewatchEvent): void {
      queue.push(event);
      if (queue.length >= batchSize) {
        if (timer) clearTimeout(timer);
        flush();
      } else {
        schedule();
      }
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
