# 🔥 flarewatch

> Lightweight error tracking, performance monitoring and custom logging for React + Vite apps.

[![npm version](https://img.shields.io/npm/v/flarewatch.svg)](https://www.npmjs.com/package/flarewatch)
[![bundle size](https://img.shields.io/bundlephobia/minzip/flarewatch)](https://bundlephobia.com/package/flarewatch)
[![license](https://img.shields.io/npm/l/flarewatch.svg)](LICENSE)

---

## Funcionalidades

- ✅ Captura de erros de render React (`ErrorBoundary` integrado)
- ✅ Erros JS globais (`window.onerror`)
- ✅ Promises rejeitadas sem `.catch()`
- ✅ Erros de API (fetch wrapper)
- ✅ Web Vitals: LCP, FID, CLS, FCP, TTFB — com severidade automática
- ✅ Logs customizados: `info`, `warn`, `error`, `debug`
- ✅ Transports plugáveis (HTTP, Console, ou crie o seu)
- ✅ Batch + retry + fallback offline (localStorage)
- ✅ `beforeSend` hook para filtrar/enriquecer eventos
- ✅ TypeScript first — 100% tipado

---

## Instalação

```bash
npm install flarewatch
# ou
pnpm add flarewatch
```

---

## Setup rápido

### 1. Modo `init()` — entry point do Vite

```ts
// src/main.ts
import { init, httpTransport, consoleTransport } from "flarewatch";

init({
  transports: [
    httpTransport({ url: "https://seu-backend.com/api/errors" }),
    consoleTransport({ minLevel: "warning" }), // só em dev
  ],
  defaultContext: {
    appVersion: import.meta.env.VITE_APP_VERSION,
    environment: import.meta.env.MODE,
  },
  debug: import.meta.env.DEV,
});
```

### 2. Modo `<FlarewatchProvider>` — com React

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { FlarewatchProvider } from "flarewatch/react";
import { httpTransport, consoleTransport } from "flarewatch";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <FlarewatchProvider
    config={{
      transports: [
        httpTransport({ url: "/api/errors" }),
        consoleTransport(),
      ],
    }}
    fallback={<div>Algo deu errado.</div>}
  >
    <App />
  </FlarewatchProvider>
);
```

---

## Logs customizados

```tsx
import { useFlarewatch } from "flarewatch/react";

function MyComponent() {
  const fw = useFlarewatch();

  const handleCheckout = async () => {
    fw.info("Checkout iniciado", { cartItems: 3 });

    try {
      await processPayment();
      fw.info("Pagamento aprovado");
    } catch (err) {
      fw.error(err as Error, { step: "payment" });
    }
  };
}
```

Sem Provider (após `init()`):

```ts
import { getClient } from "flarewatch";

const fw = getClient();
fw.warn("Cache expirado", { key: "user-preferences" });
```

---

## Fetch com captura automática

```tsx
import { useFlarewatchFetch } from "flarewatch/react";

function UsersList() {
  const apiFetch = useFlarewatchFetch();

  useEffect(() => {
    // erros HTTP 4xx/5xx e falhas de rede chegam automático no backend
    apiFetch("/api/users")
      .then(r => r.json())
      .then(setUsers);
  }, []);
}
```

Ou sem hooks:

```ts
import { getClient } from "flarewatch";

const fw = getClient();
const res = await fw.fetch("/api/products");
```

---

## Transports

### `httpTransport(options)`

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `url` | `string` | — | **Obrigatório.** Endpoint que recebe os eventos |
| `headers` | `object` | `{}` | Headers extras (Authorization, etc) |
| `batchMs` | `number` | `2000` | Debounce em ms antes de enviar o batch |
| `batchSize` | `number` | `20` | Força envio quando atingir N eventos |
| `timeout` | `number` | `8000` | Timeout da requisição em ms |
| `retries` | `number` | `3` | Tentativas com backoff exponencial |
| `offlineFallback` | `boolean` | `true` | Salva no localStorage quando offline |

### `consoleTransport(options)`

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `minLevel` | `Severity` | `"debug"` | Nível mínimo para exibir |
| `verbose` | `boolean` | `false` | Exibe o objeto completo do evento |

### Criar transport customizado

```ts
import type { Transport } from "flarewatch";

const datadogTransport: Transport = {
  name: "datadog",
  send(event) {
    DD_LOGS.logger.log(event.message, event.context, event.severity);
  },
};

init({ transports: [datadogTransport] });
```

---

## `beforeSend` — filtrar ou enriquecer eventos

```ts
init({
  transports: [...],
  beforeSend(event) {
    // descartar erros de extensões de browser
    if (event.stack?.includes("chrome-extension://")) return false;

    // enriquecer com dados do usuário logado
    return {
      ...event,
      context: {
        ...event.context,
        userId: store.getState().user.id,
      },
    };
  },
});
```

---

## Configuração completa

```ts
init({
  transports: [
    httpTransport({
      url: "/api/errors",
      headers: { Authorization: `Bearer ${token}` },
      batchMs: 3000,
      batchSize: 30,
      retries: 3,
    }),
    consoleTransport({ minLevel: "warning", verbose: true }),
  ],
  captureGlobalErrors: true,
  captureUnhandledRejections: true,
  capturePerformance: true,
  minLogLevel: "info",
  defaultContext: {
    appVersion: "1.2.3",
    environment: "production",
    userId: getCurrentUser()?.id,
  },
  beforeSend(event) {
    if (event.type.startsWith("perf.") && event.severity === "info") return false;
    return event;
  },
  debug: false,
});
```

---

## Payload enviado ao backend

```json
{
  "id": "fw-lq3k2-abc12",
  "type": "error.api",
  "severity": "error",
  "message": "HTTP 500 Internal Server Error",
  "stack": "Error: HTTP 500...",
  "url": "https://seuapp.com/dashboard",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-03-23T14:00:00.000Z",
  "sessionDuration": 42,
  "context": {
    "endpoint": "/api/users",
    "status": 500,
    "method": "GET",
    "appVersion": "1.2.3",
    "userId": "user-456"
  }
}
```

---

## Web Vitals — thresholds de severidade

| Métrica | `info` (bom) | `warning` (precisa melhorar) | `error` (ruim) |
|---|---|---|---|
| LCP | ≤ 2500ms | ≤ 4000ms | > 4000ms |
| FID | ≤ 100ms | ≤ 300ms | > 300ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| FCP | ≤ 1800ms | ≤ 3000ms | > 3000ms |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

---

## License

MIT
