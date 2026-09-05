// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ManyMeEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint40 internal constant DEFAULT_PROOF_WINDOW = 10;
    uint40 internal constant DEFAULT_MIN_PROOF_INTERVAL = 3;

    struct Agent {
        address curator;
        uint96 curatorRatePerSecond;
        string metadataURI;
        bool active;
    }

    enum Status {
        Created,
        Active,
        Paused,
        Stopped
    }

    struct Session {
        uint256 agentId;
        address user;
        uint96 totalRatePerSecond;
        uint96 curatorRate;
        uint96 platformFee;
        uint40 proofWindow;
        uint40 minProofInterval;
        uint40 startedAt;
        uint40 lastCheckpointAt;
        uint40 lastProofAt;
        uint128 depositedBalance;
        uint128 accruedTotal;
        uint128 totalClaimed;
        Status status;
    }

    error NotAgentCurator();
    error AgentNotActive();
    error SessionNotFound();
    error NotSessionUser();
    error NotPlatformWallet();
    error NotPlatformOperator();
    error SessionNotStopped();
    error SessionNotActive();
    error ProofTooSoon();
    error ProofWindowNotExpired();

    mapping(uint256 => Agent) public agents;
    uint256 public nextAgentId;
    mapping(uint256 => Session) public sessions;
    // Refunds tracked separately from totalClaimed so a refund can never
    // consume earnings that the platform has accrued but not yet claimed.
    mapping(uint256 => uint128) public refundedAmount;
    uint256 public nextSessionId;
    address public platformWallet;
    address public platformOperator;
    uint96 public platformFeeRate;
    address public paymentToken;

    event AgentRegistered(uint256 indexed agentId, address indexed curator, uint96 curatorRate, string metadataURI);
    event AgentUpdated(uint256 indexed agentId, uint96 curatorRate, string metadataURI);
    event AgentDeactivated(uint256 indexed agentId);
    event SessionCreated(uint256 indexed sessionId, uint256 indexed agentId, address indexed user, uint128 deposit, uint96 totalRate);
    event SessionStopped(uint256 indexed sessionId, uint128 totalAccrued, uint128 refunded);
    event SessionToppedUp(uint256 indexed sessionId, uint128 amount);
    event ProofSubmitted(uint256 indexed sessionId, bytes32 indexed proofHash, string metadataURI, uint40 submittedAt);
    event ProofTimeout(uint256 indexed sessionId, uint40 lastProofAt, uint40 timeoutAt);
    event EarningsClaimed(uint256 indexed sessionId, address indexed platformWallet, uint128 amount);
    event DepositExhausted(uint256 indexed sessionId);
    event FundsRefunded(uint256 indexed sessionId, address indexed user, uint128 amount);

    constructor(address _platformWallet, address _platformOperator, uint96 _platformFeeRate, address _paymentToken) {
        nextAgentId = 0;
        nextSessionId = 0;
        platformWallet = _platformWallet;
        platformOperator = _platformOperator;
        platformFeeRate = _platformFeeRate;
        paymentToken = _paymentToken;
    }

    function registerAgent(uint96 curatorRatePerSecond, string calldata metadataURI) external returns (uint256 agentId) {
        agentId = nextAgentId;
        unchecked {
            nextAgentId = agentId + 1;
        }

        agents[agentId] = Agent({
            curator: msg.sender,
            curatorRatePerSecond: curatorRatePerSecond,
            metadataURI: metadataURI,
            active: true
        });

        emit AgentRegistered(agentId, msg.sender, curatorRatePerSecond, metadataURI);
        return agentId;
    }

    function updateAgent(uint256 agentId, uint96 curatorRatePerSecond, string calldata metadataURI) external {
        Agent storage agent = agents[agentId];
        if (agent.curator != msg.sender) revert NotAgentCurator();

        agent.curatorRatePerSecond = curatorRatePerSecond;
        agent.metadataURI = metadataURI;

        emit AgentUpdated(agentId, curatorRatePerSecond, metadataURI);
    }

    function deactivateAgent(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.curator != msg.sender) revert NotAgentCurator();

        agent.active = false;

        emit AgentDeactivated(agentId);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function sessionRate(uint256 agentId) external view returns (uint96 total, uint96 curator, uint96 platform) {
        curator = agents[agentId].curatorRatePerSecond;
        platform = platformFeeRate;
        total = curator + platform;
    }

    function createSession(uint256 agentId, uint128 depositAmount) external nonReentrant returns (uint256 sessionId) {
        Agent memory agent = agents[agentId];
        if (!agent.active) revert AgentNotActive();

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        uint40 nowTs = uint40(block.timestamp);
        uint96 platformFee = platformFeeRate;
        uint96 curatorRate = agent.curatorRatePerSecond;
        uint96 totalRate = curatorRate + platformFee;

        sessionId = nextSessionId;
        unchecked {
            nextSessionId = sessionId + 1;
        }

        sessions[sessionId] = Session({
            agentId: agentId,
            user: msg.sender,
            totalRatePerSecond: totalRate,
            curatorRate: curatorRate,
            platformFee: platformFee,
            proofWindow: DEFAULT_PROOF_WINDOW,
            minProofInterval: DEFAULT_MIN_PROOF_INTERVAL,
            startedAt: nowTs,
            lastCheckpointAt: nowTs,
            lastProofAt: nowTs,
            depositedBalance: depositAmount,
            accruedTotal: 0,
            totalClaimed: 0,
            status: Status.Active
        });

        emit SessionCreated(sessionId, agentId, msg.sender, depositAmount, totalRate);
    }

    function topUp(uint256 sessionId, uint128 amount) external nonReentrant {
        Session storage s = sessions[sessionId];
        if (s.user == address(0)) revert SessionNotFound();
        if (s.status == Status.Stopped) revert SessionNotStopped();

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        s.depositedBalance += amount;

        emit SessionToppedUp(sessionId, amount);
    }

    function stopSession(uint256 sessionId) external {
        Session storage s = sessions[sessionId];
        if (s.user != msg.sender) revert NotSessionUser();

        _checkpoint(sessionId);
        s.status = Status.Stopped;

        uint128 refundable = s.depositedBalance - s.accruedTotal - refundedAmount[sessionId];
        emit SessionStopped(sessionId, s.accruedTotal, refundable);
    }

    function refundUnused(uint256 sessionId) external nonReentrant {
        Session storage s = sessions[sessionId];
        if (s.user != msg.sender) revert NotSessionUser();
        if (s.status != Status.Stopped) revert SessionNotStopped();

        // Only the portion never accrued as earnings is refundable; accrued
        // earnings stay claimable by the platform regardless of call order.
        uint128 refund = s.depositedBalance - s.accruedTotal - refundedAmount[sessionId];
        refundedAmount[sessionId] += refund;

        if (refund > 0) {
            IERC20(paymentToken).safeTransfer(msg.sender, refund);
        }

        emit FundsRefunded(sessionId, msg.sender, refund);
    }

    function claimEarnings(uint256 sessionId) external nonReentrant {
        if (msg.sender != platformWallet) revert NotPlatformWallet();
        _claimEarnings(sessionId);
    }

    function claimMultiple(uint256[] calldata sessionIds) external nonReentrant {
        if (msg.sender != platformWallet) revert NotPlatformWallet();

        uint256 len = sessionIds.length;
        for (uint256 i; i < len; ++i) {
            _claimEarnings(sessionIds[i]);
        }
    }

    function accruedAvailable(uint256 sessionId) external view returns (uint128) {
        Session memory s = sessions[sessionId];

        if (s.status == Status.Active) {
            uint40 effectiveEnd = uint40(block.timestamp);
            uint256 proofCutoff = uint256(s.lastProofAt) + uint256(s.proofWindow);
            if (block.timestamp > proofCutoff) {
                effectiveEnd = s.lastProofAt + s.proofWindow;
            }

            uint40 validElapsed;
            if (effectiveEnd > s.lastCheckpointAt) {
                validElapsed = effectiveEnd - s.lastCheckpointAt;
            }

            uint256 rawAccrual = uint256(validElapsed) * uint256(s.totalRatePerSecond);
            uint128 remaining = s.depositedBalance - s.accruedTotal;
            uint128 newAccrual = rawAccrual > remaining ? remaining : uint128(rawAccrual);
            s.accruedTotal += newAccrual;
        }

        return s.accruedTotal - s.totalClaimed;
    }

    function getSession(uint256 sessionId) external view returns (Session memory) {
        return sessions[sessionId];
    }

    function submitProof(uint256 sessionId, bytes32 proofHash, string calldata metadataURI) external {
        if (msg.sender != platformOperator) revert NotPlatformOperator();

        Session storage s = sessions[sessionId];
        if (s.status != Status.Active) revert SessionNotActive();
        if (block.timestamp < uint256(s.lastProofAt) + uint256(s.minProofInterval)) revert ProofTooSoon();

        _checkpoint(sessionId);
        s.lastProofAt = uint40(block.timestamp);

        emit ProofSubmitted(sessionId, proofHash, metadataURI, uint40(block.timestamp));
    }

    function enforceProofTimeout(uint256 sessionId) external {
        Session storage s = sessions[sessionId];
        if (block.timestamp <= uint256(s.lastProofAt) + uint256(s.proofWindow)) revert ProofWindowNotExpired();

        _checkpoint(sessionId);
        s.status = Status.Paused;

        emit ProofTimeout(sessionId, s.lastProofAt, uint40(block.timestamp));
    }

    function _claimEarnings(uint256 sessionId) internal {
        _checkpoint(sessionId);

        Session storage s = sessions[sessionId];
        uint128 amount = s.accruedTotal - s.totalClaimed;
        s.totalClaimed += amount;

        if (amount > 0) {
            IERC20(paymentToken).safeTransfer(platformWallet, amount);
        }

        emit EarningsClaimed(sessionId, platformWallet, amount);
    }

    function _checkpoint(uint256 sessionId) internal {
        Session storage s = sessions[sessionId];
        if (s.status != Status.Active) return;

        uint40 effectiveEnd = uint40(block.timestamp);
        uint256 proofCutoff = uint256(s.lastProofAt) + uint256(s.proofWindow);
        if (block.timestamp > proofCutoff) {
            effectiveEnd = s.lastProofAt + s.proofWindow;
        }

        uint40 validElapsed;
        if (effectiveEnd > s.lastCheckpointAt) {
            validElapsed = effectiveEnd - s.lastCheckpointAt;
        }

        uint256 rawAccrual = uint256(validElapsed) * uint256(s.totalRatePerSecond);
        uint128 remaining = s.depositedBalance - s.accruedTotal;
        uint128 newAccrual;

        if (rawAccrual > remaining) {
            newAccrual = remaining;
            s.status = Status.Paused;
            emit DepositExhausted(sessionId);
        } else {
            newAccrual = uint128(rawAccrual);
        }

        s.accruedTotal += newAccrual;
        s.lastCheckpointAt = uint40(block.timestamp);
    }
}
