// Minimal ABIs for the v2 deployed contracts. Hand-written to keep the bundle lean and avoid
// importing forge output JSON at build time.

export const vaultAbi = [
  { type: "function", name: "balances", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "reserved", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableBalance", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "challengeWindow", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nextActionId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "depositFor", stateMutability: "payable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "actionId", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "getPendingAction",
    stateMutability: "view",
    inputs: [{ name: "actionId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "ruleId", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "domain", type: "bytes32" },
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "createdAt", type: "uint256" },
          { name: "challengeDeadline", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "originalDecisionHash", type: "bytes32" },
          { name: "rawOutput", type: "bytes" }
        ]
      }
    ]
  },
  { type: "event", name: "Deposited", inputs: [
    { name: "payer", type: "address", indexed: true },
    { name: "wallet", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false }
  ] },
  { type: "event", name: "Withdrawn", inputs: [
    { name: "wallet", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false }
  ] },
  { type: "event", name: "PendingActionOpened", inputs: [
    { name: "actionId", type: "uint256", indexed: true },
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "wallet", type: "address", indexed: true },
    { name: "target", type: "address", indexed: false },
    { name: "value", type: "uint256", indexed: false }
  ] },
  { type: "event", name: "ActionSettled", inputs: [
    { name: "actionId", type: "uint256", indexed: true },
    { name: "target", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false }
  ] },
  { type: "event", name: "ActionRolledBack", inputs: [
    { name: "actionId", type: "uint256", indexed: true }
  ] }
] as const;

export const ruleEngineAbi = [
  { type: "function", name: "nextRuleId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getRulesByWallet", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256[]" }] },
  {
    type: "function",
    name: "getRule",
    stateMutability: "view",
    inputs: [{ name: "ruleId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "plainText", type: "string" },
          {
            name: "eventSpec",
            type: "tuple",
            components: [
              { name: "kind", type: "uint8" },
              { name: "comparator", type: "uint8" },
              { name: "url", type: "string" },
              { name: "selector", type: "string" },
              { name: "decimals", type: "uint8" },
              { name: "threshold", type: "uint256" },
              { name: "expected", type: "string" },
              { name: "prompt", type: "string" },
              { name: "systemOrDescription", type: "string" }
            ]
          },
          {
            name: "actionSpec",
            type: "tuple",
            components: [
              { name: "domain", type: "bytes32" },
              { name: "actionType", type: "uint8" },
              { name: "value", type: "uint256" },
              { name: "params", type: "bytes" }
            ]
          },
          { name: "limitsRef", type: "uint256" },
          { name: "active", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "armRule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "plainText", type: "string" },
      {
        name: "eventSpec",
        type: "tuple",
        components: [
          { name: "kind", type: "uint8" },
          { name: "comparator", type: "uint8" },
          { name: "url", type: "string" },
          { name: "selector", type: "string" },
          { name: "decimals", type: "uint8" },
          { name: "threshold", type: "uint256" },
          { name: "expected", type: "string" },
          { name: "prompt", type: "string" },
          { name: "systemOrDescription", type: "string" }
        ]
      },
      {
        name: "actionSpec",
        type: "tuple",
        components: [
          { name: "domain", type: "bytes32" },
          { name: "actionType", type: "uint8" },
          { name: "value", type: "uint256" },
          { name: "params", type: "bytes" }
        ]
      },
      { name: "limitsRef", type: "uint256" }
    ],
    outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "forceEvaluate", stateMutability: "payable", inputs: [{ name: "ruleId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "evaluate", stateMutability: "payable", inputs: [{ name: "ruleId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "setRuleActive", stateMutability: "nonpayable", inputs: [{ name: "ruleId", type: "uint256" }, { name: "active", type: "bool" }], outputs: [] },
  { type: "event", name: "RuleArmed", inputs: [
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "wallet", type: "address", indexed: true },
    { name: "plainText", type: "string", indexed: false }
  ] },
  { type: "event", name: "RuleEvaluationRequested", inputs: [
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "requestId", type: "uint256", indexed: true }
  ] }
] as const;

export const agentExecutorAbi = [
  { type: "function", name: "requiredDeposit", stateMutability: "view", inputs: [{ name: "kind", type: "uint8" }], outputs: [{ type: "uint256" }] },
  { type: "event", name: "EvaluationCompleted", inputs: [
    { name: "requestId", type: "uint256", indexed: true },
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "decision", type: "bool", indexed: false },
    { name: "decisionHash", type: "bytes32", indexed: false }
  ] },
  { type: "event", name: "AgentRequestCreated", inputs: [
    { name: "requestId", type: "uint256", indexed: true },
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "agentId", type: "uint256", indexed: true },
    { name: "deposit", type: "uint256", indexed: false }
  ] }
] as const;

export const challengeAbi = [
  { type: "function", name: "requiredDeposit", stateMutability: "view", inputs: [{ name: "kind", type: "uint8" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "challenge", stateMutability: "payable", inputs: [{ name: "actionId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "event", name: "ChallengeOpened", inputs: [
    { name: "actionId", type: "uint256", indexed: true },
    { name: "requestId", type: "uint256", indexed: true }
  ] },
  { type: "event", name: "ChallengeResolved", inputs: [
    { name: "actionId", type: "uint256", indexed: true },
    { name: "agreed", type: "bool", indexed: false },
    { name: "rereadDecisionHash", type: "bytes32", indexed: false }
  ] }
] as const;

export const receiptLogAbi = [
  { type: "function", name: "getActionsByWallet", stateMutability: "view", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "getActionsByRule", stateMutability: "view", inputs: [{ name: "ruleId", type: "uint256" }], outputs: [{ type: "uint256[]" }] },
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "actionId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "actionId", type: "uint256" },
          { name: "ruleId", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "source", type: "string" },
          { name: "rawOutput", type: "bytes" },
          { name: "decision", type: "bool" },
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "createdAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" },
          { name: "status", type: "uint8" }
        ]
      }
    ]
  },
  { type: "event", name: "Receipt", inputs: [
    { name: "actionId", type: "uint256", indexed: true },
    { name: "ruleId", type: "uint256", indexed: true },
    { name: "wallet", type: "address", indexed: true },
    { name: "decision", type: "bool", indexed: false },
    { name: "status", type: "uint8", indexed: false }
  ] }
] as const;

export const trackRecordAbi = [
  { type: "function", name: "totals", stateMutability: "view", inputs: [], outputs: [
    { type: "uint256", name: "evaluations" },
    { type: "uint256", name: "settled" },
    { type: "uint256", name: "rolledBack" },
    { type: "uint256", name: "failed" }
  ] },
  { type: "function", name: "ruleRecords", stateMutability: "view", inputs: [{ name: "ruleId", type: "uint256" }], outputs: [
    { type: "uint256", name: "evaluations" },
    { type: "uint256", name: "settled" },
    { type: "uint256", name: "rolledBack" },
    { type: "uint256", name: "failed" }
  ] },
  { type: "function", name: "accuracyBps", stateMutability: "view", inputs: [{ name: "ruleId", type: "uint256" }], outputs: [{ type: "uint256" }] }
] as const;

export const policyLimitsAbi = [
  { type: "function", name: "limits", stateMutability: "view", inputs: [
    { name: "wallet", type: "address" },
    { name: "ruleId", type: "uint256" }
  ], outputs: [
    { type: "uint256", name: "maxSpend" },
    { type: "uint256", name: "periodSeconds" },
    { type: "uint256", name: "maxSpendPerPeriod" },
    { type: "bool", name: "enabled" }
  ] },
  { type: "function", name: "trustCeilingBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;
