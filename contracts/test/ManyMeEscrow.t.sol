// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ManyMeEscrow} from "../src/ManyMeEscrow.sol";

contract MockERC20 {
    string public name = "MockUSDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ManyMeEscrowTest is Test {
    ManyMeEscrow internal escrow;
    MockERC20 internal usdc;

    address internal constant PLATFORM = address(0xA11CE);
    address internal constant OPERATOR = address(0x0B0B);
    uint96 internal constant PLATFORM_FEE_RATE = 250;

    address internal curator = address(0xCAFE);
    address internal other = address(0xD00D);
    address internal user = address(0x1234);

    event AgentRegistered(uint256 indexed agentId, address indexed curator, uint96 curatorRate, string metadataURI);
    event AgentUpdated(uint256 indexed agentId, uint96 curatorRate, string metadataURI);
    event AgentDeactivated(uint256 indexed agentId);

    function setUp() public {
        usdc = new MockERC20();
        escrow = new ManyMeEscrow(PLATFORM, OPERATOR, PLATFORM_FEE_RATE, address(usdc));

        usdc.mint(user, 1_000_000_000_000);
        usdc.mint(other, 1_000_000_000_000);

        vm.prank(user);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(other);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function testRegisterAgent() public {
        vm.prank(curator);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(0, curator, 1_000, "ipfs://agent-1");
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent-1");

        assertEq(agentId, 0);

        ManyMeEscrow.Agent memory agent = escrow.getAgent(agentId);
        assertEq(agent.curator, curator);
        assertEq(agent.curatorRatePerSecond, 1_000);
        assertEq(agent.metadataURI, "ipfs://agent-1");
        assertTrue(agent.active);
    }

    function testRegisterMultipleAgents() public {
        vm.prank(curator);
        uint256 id0 = escrow.registerAgent(100, "ipfs://a");

        vm.prank(other);
        uint256 id1 = escrow.registerAgent(200, "ipfs://b");

        vm.prank(address(0xEEE));
        uint256 id2 = escrow.registerAgent(300, "ipfs://c");

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(escrow.nextAgentId(), 3);
    }

    function testUpdateAgent() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://old");

        vm.prank(curator);
        vm.expectEmit(true, false, false, true);
        emit AgentUpdated(agentId, 2_500, "ipfs://new");
        escrow.updateAgent(agentId, 2_500, "ipfs://new");

        ManyMeEscrow.Agent memory agent = escrow.getAgent(agentId);
        assertEq(agent.curatorRatePerSecond, 2_500);
        assertEq(agent.metadataURI, "ipfs://new");
        assertTrue(agent.active);
    }

    function testUpdateAgentByNonCurator() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://old");

        vm.prank(other);
        vm.expectRevert(ManyMeEscrow.NotAgentCurator.selector);
        escrow.updateAgent(agentId, 2_500, "ipfs://new");
    }

    function testDeactivateAgent() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://old");

        vm.prank(curator);
        vm.expectEmit(true, false, false, false);
        emit AgentDeactivated(agentId);
        escrow.deactivateAgent(agentId);

        ManyMeEscrow.Agent memory agent = escrow.getAgent(agentId);
        assertFalse(agent.active);
    }

    function testDeactivateByNonCurator() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://old");

        vm.prank(other);
        vm.expectRevert(ManyMeEscrow.NotAgentCurator.selector);
        escrow.deactivateAgent(agentId);
    }

    function testGetAgent() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1234, "ipfs://details");

        ManyMeEscrow.Agent memory agent = escrow.getAgent(agentId);
        assertEq(agent.curator, curator);
        assertEq(agent.curatorRatePerSecond, 1234);
        assertEq(agent.metadataURI, "ipfs://details");
        assertTrue(agent.active);
    }

    function testSessionRate() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://rates");

        (uint96 total, uint96 curatorRate, uint96 platformRate) = escrow.sessionRate(agentId);
        assertEq(curatorRate, 1_000);
        assertEq(platformRate, PLATFORM_FEE_RATE);
        assertEq(total, 1_000 + PLATFORM_FEE_RATE);
    }

    function testRegisterAgentEmitsEvent() public {
        vm.prank(curator);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(0, curator, 777, "ipfs://event-only");
        escrow.registerAgent(777, "ipfs://event-only");
    }

    function testCreateSession() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");

        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 50_000);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(s.agentId, agentId);
        assertEq(s.user, user);
        assertEq(s.totalRatePerSecond, 1_250);
        assertEq(s.curatorRate, 1_000);
        assertEq(s.platformFee, PLATFORM_FEE_RATE);
        assertEq(uint256(s.status), uint256(ManyMeEscrow.Status.Active));
        assertEq(s.depositedBalance, 50_000);
        assertEq(usdc.balanceOf(address(escrow)), 50_000);
    }

    function testCreateSessionForInactiveAgent() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");

        vm.prank(curator);
        escrow.deactivateAgent(agentId);

        vm.prank(user);
        vm.expectRevert(ManyMeEscrow.AgentNotActive.selector);
        escrow.createSession(agentId, 10_000);
    }

    function testStopSession() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 7);
        vm.prank(user);
        escrow.stopSession(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(uint256(s.status), uint256(ManyMeEscrow.Status.Stopped));
    }

    function testStopSessionByNonUser() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.prank(other);
        vm.expectRevert(ManyMeEscrow.NotSessionUser.selector);
        escrow.stopSession(sessionId);
    }

    function testRefundUnused() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 10);
        vm.prank(user);
        escrow.stopSession(sessionId);

        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);

        uint256 beforeRefund = usdc.balanceOf(user);
        vm.prank(user);
        escrow.refundUnused(sessionId);
        uint256 afterRefund = usdc.balanceOf(user);

        assertGt(afterRefund, beforeRefund);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testRefundBeforeClaimDoesNotStealEarnings() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 10);
        vm.prank(user);
        escrow.stopSession(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        uint128 accrued = s.accruedTotal;
        assertGt(accrued, 0);

        // User refunds BEFORE the platform claims
        uint256 userBefore = usdc.balanceOf(user);
        vm.prank(user);
        escrow.refundUnused(sessionId);
        assertEq(usdc.balanceOf(user) - userBefore, 100_000 - accrued);

        // A second refund yields nothing
        vm.prank(user);
        escrow.refundUnused(sessionId);
        assertEq(usdc.balanceOf(user) - userBefore, 100_000 - accrued);

        // Platform can still claim the full accrued earnings afterwards
        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);
        assertEq(usdc.balanceOf(PLATFORM), accrued);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testTopUpNonexistentSessionReverts() public {
        usdc.mint(user, 1_000);
        vm.startPrank(user);
        usdc.approve(address(escrow), type(uint256).max);
        vm.expectRevert(ManyMeEscrow.SessionNotFound.selector);
        escrow.topUp(999, 1_000);
        vm.stopPrank();
    }

    function testRefundOnActiveSession() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.prank(user);
        vm.expectRevert(ManyMeEscrow.SessionNotStopped.selector);
        escrow.refundUnused(sessionId);
    }

    function testFuzz_Checkpoint(uint40 duration, uint96 rate, uint40 proofDelay) public {
        duration = uint40(bound(duration, 1, 3600));
        rate = uint96(bound(rate, 1, 1_000_000));
        proofDelay = uint40(bound(proofDelay, 0, 30));

        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(rate, "ipfs://fuzz");

        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 10_000_000_000);

        ManyMeEscrow.Session memory initial = escrow.getSession(sessionId);
        uint40 startTs = uint40(block.timestamp);

        vm.warp(startTs + proofDelay);
        bool proofAccepted = proofDelay >= initial.minProofInterval;
        if (proofAccepted) {
            vm.prank(OPERATOR);
            escrow.submitProof(sessionId, keccak256("fuzz"), "ipfs://proof");
        } else {
            vm.prank(OPERATOR);
            vm.expectRevert(ManyMeEscrow.ProofTooSoon.selector);
            escrow.submitProof(sessionId, keccak256("fuzz"), "ipfs://proof");
        }

        vm.warp(startTs + duration);
        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        uint256 totalRate = uint256(rate) + uint256(PLATFORM_FEE_RATE);
        uint256 expectedAccrued;

        if (!proofAccepted) {
            uint256 effectiveEndNoProof = duration;
            if (effectiveEndNoProof > initial.proofWindow) {
                effectiveEndNoProof = initial.proofWindow;
            }
            expectedAccrued = effectiveEndNoProof * totalRate;
        } else {
            uint256 firstEffectiveEnd = proofDelay;
            if (firstEffectiveEnd > initial.proofWindow) {
                firstEffectiveEnd = initial.proofWindow;
            }
            uint256 firstSegment = firstEffectiveEnd;

            uint256 secondEffectiveEnd = duration;
            uint256 secondCap = uint256(proofDelay) + uint256(initial.proofWindow);
            if (secondEffectiveEnd > secondCap) {
                secondEffectiveEnd = secondCap;
            }

            uint256 secondSegment;
            if (secondEffectiveEnd > proofDelay) {
                secondSegment = secondEffectiveEnd - proofDelay;
            }

            expectedAccrued = (firstSegment + secondSegment) * totalRate;
        }

        assertEq(uint256(s.totalClaimed), expectedAccrued);

        uint256 curatorShare = (uint256(s.totalClaimed) * uint256(s.curatorRate)) / uint256(s.totalRatePerSecond);
        uint256 platformShare = (uint256(s.totalClaimed) * uint256(s.platformFee)) / uint256(s.totalRatePerSecond);
        uint256 sumShares = curatorShare + platformShare;

        assertTrue(sumShares <= uint256(s.totalClaimed));
        assertLe(uint256(s.totalClaimed) - sumShares, 1);
    }

    function testProofSubmit() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 3);
        vm.prank(OPERATOR);
        escrow.submitProof(sessionId, keccak256("proof"), "ipfs://proof");

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(s.lastProofAt, uint40(block.timestamp));
    }

    function testProofTooSoon() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.prank(OPERATOR);
        vm.expectRevert(ManyMeEscrow.ProofTooSoon.selector);
        escrow.submitProof(sessionId, keccak256("proof"), "ipfs://proof");
    }

    function testEnforceProofTimeout() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        ManyMeEscrow.Session memory s0 = escrow.getSession(sessionId);
        vm.warp(block.timestamp + s0.proofWindow + 1);

        escrow.enforceProofTimeout(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(uint256(s.status), uint256(ManyMeEscrow.Status.Paused));
    }

    function testProofWindowNotExpired() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.expectRevert(ManyMeEscrow.ProofWindowNotExpired.selector);
        escrow.enforceProofTimeout(sessionId);
    }

    function testClaimEarnings() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 5);
        uint256 beforeClaim = usdc.balanceOf(PLATFORM);
        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);
        uint256 afterClaim = usdc.balanceOf(PLATFORM);

        assertGt(afterClaim, beforeClaim);
    }

    function testClaimMultiple() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");

        vm.prank(user);
        uint256 sessionA = escrow.createSession(agentId, 100_000);
        vm.prank(other);
        uint256 sessionB = escrow.createSession(agentId, 100_000);

        vm.warp(block.timestamp + 5);

        uint256[] memory ids = new uint256[](2);
        ids[0] = sessionA;
        ids[1] = sessionB;

        uint256 beforeClaim = usdc.balanceOf(PLATFORM);
        vm.prank(PLATFORM);
        escrow.claimMultiple(ids);
        uint256 afterClaim = usdc.balanceOf(PLATFORM);

        assertGt(afterClaim, beforeClaim);
    }

    function testDepositExhaustion() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");
        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 1_000);

        vm.warp(block.timestamp + 100);
        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(uint256(s.status), uint256(ManyMeEscrow.Status.Paused));
        assertEq(s.accruedTotal, s.depositedBalance);
    }

    function testFullLifecycle() public {
        vm.prank(curator);
        uint256 agentId = escrow.registerAgent(1_000, "ipfs://agent");

        vm.prank(user);
        uint256 sessionId = escrow.createSession(agentId, 500_000);

        vm.warp(block.timestamp + 3);
        vm.prank(OPERATOR);
        escrow.submitProof(sessionId, keccak256("proof-1"), "ipfs://proof-1");

        vm.warp(block.timestamp + 5);
        vm.prank(PLATFORM);
        escrow.claimEarnings(sessionId);

        vm.prank(user);
        escrow.stopSession(sessionId);

        vm.prank(user);
        escrow.refundUnused(sessionId);

        ManyMeEscrow.Session memory s = escrow.getSession(sessionId);
        assertEq(uint256(s.status), uint256(ManyMeEscrow.Status.Stopped));
        // Every token is accounted for: earnings claimed + refund = deposit
        assertEq(s.totalClaimed, s.accruedTotal);
        assertEq(uint256(s.totalClaimed) + uint256(escrow.refundedAmount(sessionId)), uint256(s.depositedBalance));
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
