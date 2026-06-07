# Onward Backend

Onward is a Somnia testnet self-driving wallet backend. Users arm plain-English rules, Somnia Agents read live data, the Vault opens a pending on-chain action, and the Challenge contract can force a fresh reread before settlement.

## Network

- Chain: Somnia Testnet
- Chain ID: `50312`
- RPC: `https://dream-rpc.somnia.network`
- Agent platform: `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`

## Commands

Create `.env` from `.env.example` and set `PRIVATE_KEY`.

```sh
npm install
npm run build
npm run test
npm run deploy:v2
npm run day0
npm run demo:v2
npm run verify:v2
```

## Artifacts

- Deployments: `deployments.json`
- No-hook/native-trading v2 deployments: `deployments-v2.json`
- Day-0 agent measurements: `day0-results.json`
- Legacy demo harness results: `demo-results.json`
- No-hook/native-trading v2 demo results: `gap-demo-v2-results.json`
- Read-only v2 verification report: `verification-v2.json`
- ABIs: `out/**/<Contract>.json`
- Contracts: `src/`
- Deployment/demo scripts: `scripts/`
- Tests: `test/OnwardCore.t.sol`

## Frontend Handoff

Primary v2 addresses are in `deployments-v2.json`.

User flow:

1. Deposit STT with `Vault.depositFor(address user)` or withdraw with `Vault.withdraw(uint256 amount)`.
2. Arm a rule through `RuleEngine.armRule(string plainText, EventSpec eventSpec, ActionSpec actionSpec, uint256 limitsRef)`.
3. Trigger a live evaluation with `RuleEngine.evaluate(uint256 ruleId)` or demo-trigger it with `RuleEngine.forceEvaluate(uint256 ruleId)`.
4. Watch `RuleEngine.RuleArmed`, `RuleEngine.RuleEvaluationRequested`, `AgentExecutor.AgentRequestCreated`, `AgentExecutor.EvaluationCompleted`, `Vault.PendingActionOpened`, `ReceiptLog.Receipt`, `Challenge.ChallengeResolved`, `Vault.ActionSettled`, and `Vault.ActionRolledBack`.
5. Challenge a pending action with `Challenge.challenge(uint256 actionId)`.
6. Read receipts with `ReceiptLog.getReceipt(uint256 actionId)`, `ReceiptLog.getActionsByRule(uint256 ruleId)`, and `ReceiptLog.getActionsByWallet(address wallet)`.

The current v2 demo connectors route as follows:

- Prediction: Option C `MinimalPredictionMarket`
- Trading: native Somnia Exchange Algebra `SwapRouter` through `NativeAlgebraTradingAdapter`
- Lending: Option C `MiniLendingPool`
