# Onward frontend

The Onward frontend. Self driving wallet UI for Somnia testnet.

## Run locally

```sh
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Connect a wallet, switch to Somnia testnet (chain id 50312), and fund the vault with a small amount of STT. Contract addresses are read from `../deployments-v3.json`.

## Production build

```sh
npm run build
npm run preview
```

## Notes

- No private key is loaded by the frontend. Everything that costs gas is signed by the connected wallet.
- The dashboard exposes a Trigger now button on each rule so you can fire a real evaluation without waiting for the underlying world condition to hit.
- The receipt detail page links every action to Shannon explorer for full chain audit.
- Public assets (SVG diagrams, rollback proof, favicon) are in `public/`.
