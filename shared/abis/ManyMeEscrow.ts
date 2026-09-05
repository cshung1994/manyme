export const manyMeEscrowAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_platformWallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_platformOperator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_platformFeeRate",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "_paymentToken",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "accruedAvailable",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agents",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "curator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "curatorRatePerSecond",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimEarnings",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimMultiple",
    "inputs": [
      {
        "name": "sessionIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createSession",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "depositAmount",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deactivateAgent",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enforceProofTimeout",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAgent",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ManyMeEscrow.Agent",
        "components": [
          {
            "name": "curator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "curatorRatePerSecond",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "metadataURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSession",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ManyMeEscrow.Session",
        "components": [
          {
            "name": "agentId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "user",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "totalRatePerSecond",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "curatorRate",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "platformFee",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "proofWindow",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "minProofInterval",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "startedAt",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "lastCheckpointAt",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "lastProofAt",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "depositedBalance",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "accruedTotal",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "totalClaimed",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum ManyMeEscrow.Status"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextAgentId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextSessionId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paymentToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "platformFeeRate",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "platformOperator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "platformWallet",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "refundUnused",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "refundedAmount",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerAgent",
    "inputs": [
      {
        "name": "curatorRatePerSecond",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sessionRate",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "total",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "curator",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "platform",
        "type": "uint96",
        "internalType": "uint96"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "sessions",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "totalRatePerSecond",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "curatorRate",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "platformFee",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "proofWindow",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "minProofInterval",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "startedAt",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "lastCheckpointAt",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "lastProofAt",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "depositedBalance",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "accruedTotal",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "totalClaimed",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum ManyMeEscrow.Status"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "stopSession",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitProof",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "proofHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "topUp",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateAgent",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "curatorRatePerSecond",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AgentDeactivated",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentRegistered",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "curator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "curatorRate",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentUpdated",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "curatorRate",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DepositExhausted",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EarningsClaimed",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "platformWallet",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FundsRefunded",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProofSubmitted",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "proofHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "submittedAt",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProofTimeout",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "lastProofAt",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      },
      {
        "name": "timeoutAt",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionCreated",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "deposit",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "totalRate",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionStopped",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "totalAccrued",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "refunded",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionToppedUp",
    "inputs": [
      {
        "name": "sessionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AgentNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAgentCurator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPlatformOperator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotPlatformWallet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotSessionUser",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ProofTooSoon",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ProofWindowNotExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SessionNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SessionNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SessionNotStopped",
    "inputs": []
  }
] as const;
