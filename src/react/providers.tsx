import React, {
  Component,
  createContext,
  useContext,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { FlarewatchClient } from "../core/client";
import { init, getClient, isInitialized } from "../core/instance";
import type { FlarewatchConfig } from "../types";

// ─── Context ──────────────────────────────────────────────────────────────────

const FlarewatchContext = createContext<FlarewatchClient | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface FlarewatchProviderProps {
  config: FlarewatchConfig;
  children: ReactNode;
  /** Componente de fallback quando ocorre erro de render. */
  fallback?: ReactNode | ((error: Error) => ReactNode);
}

interface ProviderState {
  client: FlarewatchClient;
  crashed: boolean;
  lastError: Error | null;
}

export class FlarewatchProvider extends Component<FlarewatchProviderProps, ProviderState> {
  constructor(props: FlarewatchProviderProps) {
    super(props);
    const client = isInitialized() ? getClient() : init(props.config);
    this.state = { client, crashed: false, lastError: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ProviderState> {
    return { crashed: true, lastError: error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.state.client.captureRenderError(error, info.componentStack ?? "");
  }

  componentWillUnmount(): void {
    // não destroi automaticamente — o dev controla o ciclo de vida
  }

  render(): ReactNode {
    const { crashed, lastError, client } = this.state;
    const { fallback, children } = this.props;

    if (crashed && lastError) {
      if (typeof fallback === "function") return fallback(lastError);
      if (fallback) return fallback;
      return React.createElement(DefaultFallback, { error: lastError });
    }

    return React.createElement(
      FlarewatchContext.Provider,
      { value: client },
      children
    );
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────

/**
 * Retorna o cliente flarewatch para uso dentro do Provider.
 *
 * @example
 * ```tsx
 * const fw = useFlarewatch();
 * fw.info("Usuário fez login", { userId: "123" });
 * ```
 */
export function useFlarewatch(): FlarewatchClient {
  const client = useContext(FlarewatchContext);
  if (!client) {
    throw new Error(
      "[flarewatch] useFlarewatch deve ser usado dentro de <FlarewatchProvider>."
    );
  }
  return client;
}

/**
 * Retorna um wrapper de fetch que captura erros de API automaticamente.
 *
 * @example
 * ```tsx
 * const apiFetch = useFlarewatchFetch();
 * const res = await apiFetch("/api/users");
 * ```
 */
export function useFlarewatchFetch(): typeof fetch {
  const client = useFlarewatch();
  return (input, init) => client.fetch(input as RequestInfo, init);
}

// ─── ErrorBoundary standalone (sem Provider) ─────────────────────────────────

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
}

interface BoundaryState {
  crashed: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, BoundaryState> {
  state: BoundaryState = { crashed: false, error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { crashed: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isInitialized()) {
      getClient().captureRenderError(error, info.componentStack ?? "");
    }
  }

  render(): ReactNode {
    const { crashed, error } = this.state;
    const { fallback, children } = this.props;

    if (crashed && error) {
      if (typeof fallback === "function") return fallback(error);
      if (fallback) return fallback;
      return React.createElement(DefaultFallback, { error });
    }

    return children;
  }
}

// ─── Fallback padrão ──────────────────────────────────────────────────────────

function DefaultFallback({ error }: { error: Error }): React.ReactElement {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "200px",
        padding: "32px",
        fontFamily: "system-ui, sans-serif",
        gap: "12px",
        textAlign: "center",
      },
    },
    React.createElement("strong", { style: { fontSize: "18px" } }, "Algo deu errado"),
    React.createElement(
      "p",
      { style: { color: "#666", fontSize: "14px", maxWidth: "400px" } },
      error.message
    ),
    React.createElement(
      "button",
      {
        onClick: () => window.location.reload(),
        style: {
          padding: "8px 20px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          cursor: "pointer",
          fontSize: "14px",
        },
      },
      "Recarregar página"
    )
  );
}
