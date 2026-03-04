/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_commonwareidentity_free: (a: number, b: number) => void;
export const commonwareidentity_decrypt_from_peer: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
export const commonwareidentity_encrypt_for_peer: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
export const commonwareidentity_export_private_hex: (a: number) => [number, number];
export const commonwareidentity_get_x25519_public_key: (a: number) => [number, number];
export const commonwareidentity_pub_key: (a: number) => [number, number];
export const commonwareidentity_sign: (a: number, b: number, c: number) => [number, number];
export const create_identity: () => number;
export const identity_from_private_hex: (a: number, b: number) => [number, number, number];
export const verify_signature: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
