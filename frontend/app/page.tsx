"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useIdentity } from "./hooks/useIdentity";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || "http://localhost:3001";

interface ChatMessage {
  id: string;
  text: string;
  signatureHex: string;
  fromMe: boolean;
  displayName: string;
  peerId: string;
  recipient: string;
  at: number;
}

function truncate(s: string, len = 12) {
  if (s.length <= len) return s;
  return s.slice(0, len) + "…";
}

function getPeerByPubKey(
  pubKey: string,
  peers: { id: string; name: string; pubKey: string }[]
) {
  return peers.find((p) => p.pubKey === pubKey);
}

function getPeerByName(
  name: string,
  peers: { id: string; name: string; pubKey: string }[]
) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return peers.find((p) => p.name.toLowerCase() === q) ?? null;
}

function resolveRecipientId(
  raw: string,
  peers: { id: string; name: string; pubKey: string }[]
): string {
  const r = raw.trim();
  if (!r) return "";
  const peer = getPeerByName(r, peers);
  return peer ? peer.pubKey : r;
}

function resolveRecipientDisplay(
  recipientId: string,
  peers: { id: string; name: string; pubKey: string }[]
): string {
  if (!recipientId) return "";
  const peer = getPeerByPubKey(recipientId, peers);
  return peer ? `${peer.name} (${truncate(recipientId, 10)})` : truncate(recipientId, 24);
}

function resolveRecipientLabel(
  recipientId: string,
  peers: { id: string; name: string; pubKey: string }[]
): string {
  if (!recipientId) return "Broadcast";
  const peer = getPeerByPubKey(recipientId, peers);
  return peer ? peer.name : truncate(recipientId, 16);
}

export default function Home() {
  const {
    displayName,
    setDisplayName,
    peerId,
    signMessage,
    verifySignature,
    isReady,
    isInitialized,
    initializeWithDisplayName,
    error,
  } = useIdentity();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(displayName);

  const [operatorName, setOperatorName] = useState("");
  const [modalClosing, setModalClosing] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [p2pNotification, setP2pNotification] = useState(false);
  const [onlinePeers, setOnlinePeers] = useState<{ id: string; name: string; pubKey: string }[]>([]);
  const [relayConnected, setRelayConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const handleInitialize = useCallback(() => {
    const name = operatorName.trim();
    if (!name) return;
    setModalClosing(true);
    setTimeout(() => {
      initializeWithDisplayName(name);
      setModalClosing(false);
    }, 220);
  }, [operatorName, initializeWithDisplayName]);

  const handleSignAndSend = useCallback(() => {
    const text = input.trim();
    if (!text || !isInitialized) return;
    const sig = signMessage(text);
    if (sig == null) return;
    const recipient =
      resolveRecipientId(selectedRecipient, onlinePeers) ||
      selectedRecipient.trim() ||
      "Broadcast";
    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text,
      signatureHex: sig,
      fromMe: true,
      displayName,
      peerId,
      recipient,
      at: Date.now(),
    };
    socketRef.current?.emit("message", msg);
    setInput("");
  }, [input, isInitialized, signMessage, displayName, peerId, selectedRecipient, onlinePeers]);

  useEffect(() => {
    if (!isInitialized || !peerId || !displayName) return;
    const socket = io(RELAY_URL, { autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setRelayConnected(true);
      socket.emit("register", { peerId, displayName });
    });
    socket.on("disconnect", () => setRelayConnected(false));

    socket.on("online_list", (list: { id: string; name: string; pubKey: string }[]) => {
      setOnlinePeers(Array.isArray(list) ? list : []);
    });
    socket.on(
      "user_online",
      (user: { peerId?: string; id?: string; name?: string; pubKey?: string; displayName?: string }) => {
        const pId = user.peerId ?? user.id ?? user.pubKey;
        if (!pId || pId === peerId) return;
        const name = user.name ?? user.displayName ?? truncate(pId, 12);
        setOnlinePeers((prev) => {
          const without = prev.filter((p) => p.pubKey !== pId);
          return [...without, { id: pId, name, pubKey: pId }];
        });
      }
    );
    socket.on("user_offline", (data: { peerId: string }) => {
      if (data.peerId === peerId) return;
      setOnlinePeers((prev) => prev.filter((p) => p.pubKey !== data.peerId));
    });

    socket.on("message", async (chatMsg: ChatMessage) => {
      const myId = peerId;
      console.log("Incoming message:", chatMsg);

      if (!chatMsg?.text || !chatMsg?.signatureHex || !chatMsg?.peerId) return;
      const valid = await verifySignature(
        chatMsg.peerId,
        chatMsg.text,
        chatMsg.signatureHex
      );
      if (!valid) {
        console.log("SIGNATURE_ERROR");
        return;
      }
      const recipient = chatMsg.recipient ?? "Broadcast";
      const isForMe = recipient === "Broadcast" || recipient === myId;
      if (!isForMe) {
        console.log(`ID_MISMATCH: Incoming [${recipient}], Mine [${myId}]`);
        return;
      }
      const isFromMe = chatMsg.peerId === myId;
      setMessages((prev) => {
        if (prev.some((m) => m.id === chatMsg.id)) return prev;
        return [
          ...prev,
          {
            ...chatMsg,
            fromMe: isFromMe,
          },
        ];
      });
      if (!isFromMe) setP2pNotification(true);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isInitialized, peerId, displayName, verifySignature]);

  useEffect(() => {
    if (!p2pNotification) return;
    const t = setTimeout(() => setP2pNotification(false), 4000);
    return () => clearTimeout(t);
  }, [p2pNotification]);

  const openEditName = () => {
    setEditNameValue(displayName);
    setEditingName(true);
  };
  const saveDisplayName = () => {
    const v = editNameValue.trim();
    if (v) setDisplayName(v);
    setEditingName(false);
  };

  const showModal = !isInitialized && isReady && !error;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-mono">
      {/* Full-screen modal when no displayName */}
      {showModal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md ${
            modalClosing ? "animate-modal-fade-out" : "animate-modal-fade-in"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className={`mx-4 w-full max-w-md rounded-lg border-2 border-emerald-500 bg-zinc-900/95 px-8 py-10 shadow-2xl shadow-emerald-500/10 ${
              modalClosing ? "animate-modal-content-out" : "animate-modal-content-in"
            }`}
          >
            <p
              id="modal-title"
              className="text-center text-sm font-semibold uppercase tracking-widest text-emerald-400 animate-blink"
            >
              ESTABLISHING SECURE CONNECTION
            </p>
            <div className="mt-8">
              <label
                htmlFor="operator-name"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Enter Operator Name
              </label>
              <input
                id="operator-name"
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInitialize()}
                placeholder="Your call sign"
                className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
                disabled={modalClosing}
              />
            </div>
            <button
              type="button"
              onClick={handleInitialize}
              disabled={!operatorName.trim() || modalClosing}
              className="mt-8 w-full rounded-lg border-2 border-emerald-500 bg-emerald-500/10 py-3 text-sm font-bold uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/20 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Initialize
            </button>
          </div>
        </div>
      )}

      {/* Left sidebar — only when initialized */}
      {isInitialized && (
        <>
          <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/80">
            <div className="border-b border-zinc-800 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
                CommonChat
              </h2>
              <p className="mt-1 text-xs text-zinc-500">Ed25519 signed</p>
            </div>

            <div className="border-b border-zinc-800 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                You
              </h3>
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
                    className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveDisplayName}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-zinc-100">
                    {displayName || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={openEditName}
                    className="shrink-0 text-xs text-emerald-400/80 hover:text-emerald-400"
                  >
                    Edit
                  </button>
                </div>
              )}
              <p className="mt-1 truncate text-xs text-zinc-500" title={peerId}>
                {truncate(peerId, 20)}
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Online Peers
                </h3>
                <span
                  className={`h-2 w-2 rounded-full ${
                    relayConnected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-zinc-500"
                  }`}
                  title={relayConnected ? "Relay connected" : "Relay disconnected"}
                />
              </div>
              <ul className="space-y-2">
                {onlinePeers.length === 0 && (
                  <p className="text-xs text-zinc-500">
                    {relayConnected
                      ? "No other users yet."
                      : "Connecting to relay…"}
                  </p>
                )}
                {onlinePeers.map((p) => (
                  <li
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRecipient(p.pubKey)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedRecipient(p.pubKey)}
                    title={`To: ${p.name} (${p.pubKey})`}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 transition hover:border-emerald-500/50 hover:bg-zinc-700/30 ${
                      selectedRecipient === p.pubKey
                        ? "border-emerald-500/60 bg-emerald-950/20"
                        : "border-zinc-700/50 bg-zinc-800/50"
                    }`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{p.name}</p>
                      <p className="truncate text-xs text-zinc-500">{p.pubKey}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Right: chat */}
          <main className="flex flex-1 flex-col bg-zinc-950">
            <div className="border-b border-zinc-800 px-6 py-3">
              <h1 className="text-sm font-semibold text-zinc-300">
                Channel <span className="text-emerald-400">#general</span>
              </h1>
              <p className="text-xs text-zinc-500">Messages are signed with Ed25519</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-zinc-500">
                    No messages yet. Type below and click &quot;Sign &amp; Send&quot;.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border ${
                      m.fromMe
                        ? "border-emerald-500/30 bg-emerald-950/20"
                        : "border-zinc-700/50 bg-zinc-900/30"
                    } p-4 shadow-lg`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-emerald-400/90">
                        {m.displayName}
                      </span>
                      <div className="flex items-center gap-2">
                        {(m.recipient ?? "Broadcast") !== "Broadcast" && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400/90">
                            End-to-End Encrypted
                          </span>
                        )}
                        <span className="text-xs text-zinc-500">
                          {truncate(m.peerId, 16)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      To: {(m.recipient ?? "Broadcast") === "Broadcast" ? "Broadcast (Everyone)" : truncate(m.recipient ?? "", 24)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">
                      {m.text}
                    </p>
                    <div className="mt-3 rounded border border-zinc-700/50 bg-zinc-900/50 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-400/90">
                        Signed with Ed25519
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                        {m.signatureHex}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800 p-4">
              <div className="mx-auto max-w-2xl space-y-2">
                {selectedRecipient && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                      To: {resolveRecipientLabel(selectedRecipient, onlinePeers)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500">To:</span>
                  <input
                    type="text"
                    value={resolveRecipientDisplay(selectedRecipient, onlinePeers)}
                    onChange={(e) =>
                      setSelectedRecipient(resolveRecipientId(e.target.value, onlinePeers))
                    }
                    placeholder="Broadcast (Everyone) or type a name (Alice, Bob…)"
                    className="flex-1 rounded border border-zinc-700/60 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                  />
                  {selectedRecipient && (
                    <>
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-400/90">
                        End-to-End Encrypted
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedRecipient("")}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                        title="Clear recipient"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignAndSend()}
                  placeholder="Type a message…"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSignAndSend}
                  disabled={!input.trim()}
                  className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_12px_rgba(52,211,153,0.25)] transition hover:bg-emerald-500 hover:shadow-[0_0_16px_rgba(52,211,153,0.35)] disabled:opacity-50 disabled:shadow-none"
                >
                  Sign &amp; Send
                </button>
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* Loading while WASM/identity check runs */}
      {!isReady && !error && (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          Loading…
        </div>
      )}
      {error && (
        <div className="flex flex-1 items-center justify-center text-red-400">
          {error}
        </div>
      )}

      {/* New P2P message notification - bottom right */}
      {p2pNotification && (
        <div className="fixed bottom-4 right-4 z-50 animate-modal-content-in rounded-lg border border-emerald-500/60 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-emerald-500/10">
          <p className="text-sm font-medium text-emerald-400">
            New P2P Message Received
          </p>
        </div>
      )}
    </div>
  );
}
