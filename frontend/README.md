This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Deploy this Next.js app to [Vercel](https://vercel.com) as usual.
2. Set the environment variable **`NEXT_PUBLIC_RELAY_URL`** to your Global P2P Relay URL (e.g. `https://your-relay.up.railway.app`). The relay is a separate WebSocket server—see `../relay/README.md` for running and deploying it (Railway, Render, Fly.io, etc.).
3. Without a relay, the app still builds; at runtime it will try to connect to `http://localhost:3001` by default. For production, deploy the relay and set `NEXT_PUBLIC_RELAY_URL` accordingly.
