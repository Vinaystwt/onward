# Onward

A self driving wallet on the Somnia blockchain. The agent reads an external source through Somnia consensus AI, acts on chain when the user's rule conditions are met, and writes an auditable on chain receipt. At challenge time the network runs a fresh consensus reading of the same source and if the result changed, the vault rolls the action back before settlement. The system does not verify ground truth. It guarantees that an action executes only when the consensus reading at challenge time still agrees with the original.

## Why Somnia

The challenge mechanism needs a second read it can trust as much as the first. Off chain bots can rerun a read but cannot prove they ran it honestly. A push oracle cannot rerun the same read on demand under the same quorum assumptions. Somnia's consensus AI lets the contract ask the same question again inside the validator consensus layer and receive a signed result that carries the same trust weight as the first read. That is the only design where the chain can enforce a pre settlement rollback without a trusted off chain operator.

## The self correcting challenge

When a rule fires, the vault reserves funds and opens a pending action. While the challenge window is open, any party can call `Challenge.challenge(actionId)`. The contract opens a fresh Somnia consensus request against the same source URL. Two outcomes only:

- The fresh reading agrees with the original. The vault settles the action immediately and marks the receipt Settled.
- The fresh reading disagrees. The vault returns the reserved funds and marks the receipt RolledBack.

Both sequences ran live on Somnia testnet and are permanently on chain.

### Rollback proof (action 2)

Source read value 1, decision: fire. Source then updated to value 3 via HTTP PUT. Challenge ran a fresh reading, returned 3, disagreed with original. Vault rolled back before settlement.

| Step | Transaction |
|------|-------------|
| First consensus read: value 1, fire | [0xab8889…f9534](https://shannon-explorer.somnia.network/tx/0xab888985cfe08f65559d355f133ca3f0d9a4f422c45ce6f909a4cb19f11f9534) |
| Challenge called | [0xe4fefd…a31b](https://shannon-explorer.somnia.network/tx/0xe4fefdef5d66186a1d38b7090200608621a68d17e3fa60d7f0f39fadf321a31b) |
| Challenge resolved: rolled back | [0x7c468d…aa50](https://shannon-explorer.somnia.network/tx/0x7c468d841b18c82c12122049c386651faa8fd074b66bb1b30abcd97a482baa50) |

### Settle proof (action 3)

Source read value 1, decision: fire. Source unchanged. Challenge ran a fresh reading, returned 1, agreed with original. Vault settled.

| Step | Transaction |
|------|-------------|
| First consensus read: value 1, fire | [0x65ee62…c8b4](https://shannon-explorer.somnia.network/tx/0x65ee62eaeb46b7bc61f139249b49c11770123bae2beb2754f46061a64cc2c8b4) |
| Challenge resolved: settled | [0x8deeec…783a](https://shannon-explorer.somnia.network/tx/0x8deeec897a481e7d775d874c37beead002e29bb28524743521935855a4f9783a) |

Full proof artifact with all transaction hashes and block numbers: `rollback-proof.json` at the repo root.

## Architecture

Nine contracts, each with one job. All deployed on Somnia testnet, chain id 50312. Addresses come from `deployments-v3.json`.

| Contract | Address | Role |
|----------|---------|------|
| RuleEngine | [0x9E5C97…Ca80](https://shannon-explorer.somnia.network/address/0x9E5C97B83696eC46db29877428E1F2528984Ca80) | Stores user rules and starts evaluation cycles |
| AgentExecutor | [0x734E26…6d3](https://shannon-explorer.somnia.network/address/0x734E260E63d4a08a4F4b5F6177B938f6740A56d3) | Creates Somnia Agent requests and opens pending vault actions |
| Vault | [0x262111…506](https://shannon-explorer.somnia.network/address/0x26211197012061B75df41D44cf836aBBEB69b506) | Custodies STT, reserves and settles or rolls back |
| Challenge | [0xFb74D0…305](https://shannon-explorer.somnia.network/address/0xFb74D0De3AaC051c123E0561ab904977E1bf4305) | Runs independent consensus readings and settles or rolls back |
| PolicyLimits | [0xB58e41…8aE](https://shannon-explorer.somnia.network/address/0xB58e41cf6f2C1509786c56743171464a097BA8aE) | Per rule caps, rate limits, and trust ceiling |
| ReceiptLog | [0x542F65…7cd](https://shannon-explorer.somnia.network/address/0x542F6548D6D93416466dc4a62F8CE44FfF2997cd) | Queryable on chain audit receipts |
| TrackRecord | [0x606AB7…5D7f](https://shannon-explorer.somnia.network/address/0x606AB70e0da747B07fB3411D2A1cf2647eAF5D7f) | Accuracy counters and rule leaderboard |
| AdapterRegistry | [0xc3AfbA…d44](https://shannon-explorer.somnia.network/address/0xc3AfbAAFA8C1Bc769A83996A27626a60c5Bfad44) | Domain to adapter routing |
| Registry | [0x65f22f…c9a](https://shannon-explorer.somnia.network/address/0x65f22f4cAD6438c1Ac7B77406fA22cBA1CaF8c9a) | Supported event and action types |

## Running the frontend locally

```sh
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Connect a wallet (Rabby, MetaMask, OKX, or any injected provider), switch to Somnia testnet (chain id 50312), and fund the vault with a small amount of STT.

For a production build:

```sh
cd frontend
npm run build
npm run preview
```

## Demo flow

1. Open `/arm` and arm a rule. Pick a template, set a threshold and a spend cap, confirm the transaction.
2. Open `/app` and hit Trigger now on the rule. The vault opens a pending action and the receipt appears at `/receipts`.
3. Open the receipt detail. The challenge window shows the countdown. Hit Force fresh read to call `Challenge.challenge` on chain.
4. Watch the receipt flip to Settled or RolledBack depending on whether the consensus reading agreed.
5. Open `/docs/challenge` to see both outcomes with the live proof transactions linked above.

## Receipt provenance

Every field on a receipt is tagged with the tier that produced it.

| Tier | What it means |
|------|--------------|
| User defined | Set by the wallet owner at arm time |
| Source | The raw value the consensus fetch returned from the external URL |
| Agent inferred | The decision and action encoding from the Somnia consensus AI |
| On chain enforced | Values enforced by the vault and policy contracts |
| Consensus verified | Final status from the challenge reading |

## Backend scripts

The `scripts/` directory and contract source are in the repo root. The frontend app is in `frontend/`. Run backend scripts from the repo root after copying `.env.example` to `.env` and filling in `PRIVATE_KEY`.

```sh
npm install
npm run build
npm run test
```

## Security notes

No private key is used by the frontend. Every transaction the app submits is signed by the connected wallet. The `.env` file is excluded by `.gitignore` and was never committed to this repository.
