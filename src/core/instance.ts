import { FlarewatchClient } from "./client";
import type { FlarewatchConfig } from "../types";

let instance: FlarewatchClient | null = null;

/**
 * Inicializa o flarewatch. Chame uma vez no entry point da aplicação.
 *
 * @example
 * ```ts
 * import { init, httpTransport } from "flarewatch";
 *
 * init({
 *   transports: [httpTransport({ url: "/api/errors" })],
 * });
 * ```
 */
export function init(config: FlarewatchConfig): FlarewatchClient {
  if (instance) {
    console.warn("[flarewatch] já inicializado. Chame destroy() antes de reinicializar.");
    return instance;
  }
  instance = new FlarewatchClient(config);
  instance.init();
  return instance;
}

/**
 * Retorna a instância atual. Lança se não inicializado.
 */
export function getClient(): FlarewatchClient {
  if (!instance) {
    throw new Error(
      "[flarewatch] não inicializado. Chame init() antes de usar getClient()."
    );
  }
  return instance;
}

/**
 * Destrói a instância atual (útil em testes ou hot-reload).
 */
export function destroy(): void {
  instance?.destroy();
  instance = null;
}

/**
 * true se o flarewatch já foi inicializado.
 */
export function isInitialized(): boolean {
  return instance !== null;
}
