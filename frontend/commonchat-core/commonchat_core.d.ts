/* tslint:disable */
/* eslint-disable */

/**
 * Kimlik: Ed25519 public key + içeride private key (imza için).
 */
export class CommonwareIdentity {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Private key'i hex string olarak dışa aktarır (localStorage için).
     */
    export_private_hex(): string;
    /**
     * Mesajı Ed25519 ile imzalar; imza hex string olarak döner.
     */
    sign(message: string): string;
    readonly pub_key: string;
}

/**
 * Yeni rastgele kimlik oluşturur.
 */
export function create_identity(): CommonwareIdentity;

/**
 * localStorage'tan okunan private key hex ile kimliği geri yükler.
 */
export function identity_from_private_hex(hex_str: string): CommonwareIdentity;

/**
 * İmzayı doğrular: pub_key_hex ile message üzerindeki signature_hex geçerli mi?
 */
export function verify_signature(pub_key_hex: string, message: string, signature_hex: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_commonwareidentity_free: (a: number, b: number) => void;
    readonly commonwareidentity_export_private_hex: (a: number) => [number, number];
    readonly commonwareidentity_pub_key: (a: number) => [number, number];
    readonly commonwareidentity_sign: (a: number, b: number, c: number) => [number, number];
    readonly create_identity: () => number;
    readonly identity_from_private_hex: (a: number, b: number) => [number, number, number];
    readonly verify_signature: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
