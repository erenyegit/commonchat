# CommonChat Relay

WebSocket relay for global P2P: online discovery and message routing by Peer-ID.

- **Register:** Clients send `peerId` + `displayName`; server adds them to the global online list.
- **Routing:** Messages with `recipient: "Broadcast"` go to all; otherwise only to the socket(s) with that Peer-ID.
- **No crypto:** Signatures are verified by clients (Rust/Commonware). Relay only forwards.

## Run locally

```bash
npm install
npm start
# Listens on PORT or 3001
```

Frontend expects `NEXT_PUBLIC_RELAY_URL=http://localhost:3001` (or set in `.env`).

## Deploy (Vercel + Relay)

- **Frontend:** Deploy Next.js to Vercel as usual. Set env var `NEXT_PUBLIC_RELAY_URL` to your relay URL (e.g. `https://your-relay.up.railway.app`).
- **Relay:** Deploy this Node server to a host that supports long-lived WebSockets, e.g.:
  - [Railway](https://railway.app): `railway up` or connect repo, set start command `npm start`, expose port.
  - [Render](https://render.com): Web Service, build `npm install`, start `npm start`.
  - [Fly.io](https://fly.io): `fly launch`, ensure internal port 3001 and public port 443.

Use **HTTPS** and the same origin or CORS for the frontend domain.
