"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "commonchat_identity";

export interface StoredIdentity {
  displayName: string;
  pubKey: string;
  privateKeyHex: string;
}

export function useIdentity() {
  const [displayName, setDisplayName] = useState<string>("");
  const [peerId, setPeerId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identityRef = useRef<{
    sign: (msg: string) => string;
    pub_key: string;
    export_private_hex: () => string;
    get_x25519_public_key: () => string;
    encrypt_for_peer: (recipientX25519PubHex: string, plaintext: string) => string;
    decrypt_from_peer: (senderX25519PubHex: string, encryptedHex: string) => string;
  } | null>(null);
  type IdentityInstance = {
    sign: (m: string) => string;
    pub_key: string;
    export_private_hex: () => string;
    get_x25519_public_key: () => string;
    encrypt_for_peer: (recipientX25519PubHex: string, plaintext: string) => string;
    decrypt_from_peer: (senderX25519PubHex: string, encryptedHex: string) => string;
  };
  type CoreModule = {
    default?: () => Promise<unknown>;
    create_identity: () => IdentityInstance;
    identity_from_private_hex: (hex: string) => IdentityInstance;
    verify_signature: (pub: string, msg: string, sig: string) => boolean;
  };
  const coreRef = useRef<CoreModule | null>(null);

  const loadStored = useCallback(async () => {
    try {
      const core = await import("@/src/commonware-lib/commonchat_core.js") as CoreModule;
      coreRef.current = core;
      if (typeof core.default === "function") {
        await core.default();
      }
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const stored: StoredIdentity = JSON.parse(raw);
        if (stored.displayName?.trim() && stored.privateKeyHex) {
          const identity = core.identity_from_private_hex(stored.privateKeyHex);
          identityRef.current = identity;
          setDisplayName(stored.displayName);
          setPeerId(identity.pub_key);
          setIsInitialized(true);
        }
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  const initializeWithDisplayName = useCallback(
    async (name: string) => {
      const core = coreRef.current;
      if (!core) {
        const mod = await import("@/src/commonware-lib/commonchat_core.js") as CoreModule;
        coreRef.current = mod;
        if (typeof mod.default === "function") await mod.default();
      }
      const c = coreRef.current!;
      const identity = c.create_identity();
      const trimmed = name.trim() || "Operator";
      const toStore: StoredIdentity = {
        displayName: trimmed,
        pubKey: identity.pub_key,
        privateKeyHex: identity.export_private_hex(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      identityRef.current = identity;
      setDisplayName(trimmed);
      setPeerId(identity.pub_key);
      setIsInitialized(true);
      setError(null);
    },
    []
  );

  const signMessage = useCallback((message: string): string | null => {
    const id = identityRef.current;
    if (!id) return null;
    return id.sign(message);
  }, []);

  const verifySignature = useCallback(
    async (pubKeyHex: string, message: string, signatureHex: string): Promise<boolean> => {
      try {
        const c = coreRef.current ?? (await import("@/src/commonware-lib/commonchat_core.js") as CoreModule);
        if (!coreRef.current) coreRef.current = c;
        if (typeof c.default === "function") await c.default();
        return c.verify_signature(pubKeyHex, message, signatureHex);
      } catch {
        return false;
      }
    },
    []
  );

  const getX25519PublicKey = useCallback((): string | null => {
  const id = identityRef.current;
  if (!id) return null;
  return id.get_x25519_public_key();
}, []);

  const encryptForPeer = useCallback((recipientX25519PubHex: string, plaintext: string): string | null => {
    const id = identityRef.current;
    if (!id) return null;
    return id.encrypt_for_peer(recipientX25519PubHex, plaintext);
  }, []);

  const decryptFromPeer = useCallback((senderX25519PubHex: string, encryptedHex: string): string | null => {
    const id = identityRef.current;
    if (!id) return null;
    return id.decrypt_from_peer(senderX25519PubHex, encryptedHex);
  }, []);


  const updateDisplayName = useCallback((newName: string) => {
    setDisplayName(newName);
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const stored: StoredIdentity = JSON.parse(raw);
      stored.displayName = newName;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
  }, []);

  return {
  displayName,
  setDisplayName: updateDisplayName,
  peerId,
  signMessage,
  verifySignature,
  getX25519PublicKey,
  encryptForPeer,
  decryptFromPeer,
  isReady,
  isInitialized,
  initializeWithDisplayName,
  error,
};
}
