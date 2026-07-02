import { parseAbi } from "viem";

export const CIPHER_TRADE_ADDRESS = "0xa76FD6549554b2Df202Ba4E1E3db5605Ef92d2f6";

export const CIPHER_TRADE_ABI = parseAbi([
  // ── Write ──
  "function openPosition(bytes32 inputDirection, bytes32 inputSize, bytes32 inputLeverage, bytes calldata inputProof) external",
  "function closePosition() external",
  "function followTrader(address trader, uint256 allocation) external",
  "function copyTrade(address leader, uint256 allocation) external",
  "function settlePosition(address trader, bool direction, uint64 size, uint64 leverage) external",
  "function stake() external",
  "function unstake() external",
  "function faucet() external",
  "function wrap(uint64 amount) external",
  "function setUsername(string name) external",
  "function setTPSL(bytes32 inputTp, bytes32 inputSl, bytes calldata inputProof) external",
  "function hasTPSL(address trader) external view returns (bool)",

  // ── Read: position ──
  "function isPositionOpen(address trader) external view returns (bool)",
  "function getFollowerCount(address trader) external view returns (uint256)",
  "function getPosition(address trader) external view returns (bytes32 size, uint256 entryPrice, bool isOpen, bool staked)",
  "function getEncryptedHandles(address trader) external view returns (bytes32 direction, bytes32 size, bytes32 leverage)",
  "function isSettled(address trader) external view returns (bool)",
  "function staked(address) external view returns (bool)",
  "function claimedFaucet(address) external view returns (bool)",
  "function confidentialBalanceOf(address user) external view returns (bytes32)",
  "function usernames(address) external view returns (string)",
  "function resolveUsername(string name) external view returns (address)",
  "function admin() external view returns (address)",

  // ── Read: registry & track record ──
  "function getTraderCount() external view returns (uint256)",
  "function getTraders() external view returns (address[])",
  "function isRegistered(address) external view returns (bool)",
  "function getTradeCount(address trader) external view returns (uint256)",
  "struct Trade { uint256 entryPrice; uint256 exitPrice; bool direction; uint64 size; uint64 leverage; int256 pnlBps; int256 feeBps; uint256 timestamp; }",
  "function getTradeHistory(address trader) external view returns (Trade[])",
  "function traderStats(address) external view returns (uint256 totalTrades, uint256 wins, int256 netPnlBps)",

  // ── Events ──
  "event PositionOpened(address indexed trader, uint256 entryPrice)",
  "event PositionClosed(address indexed trader)",
  "event Settled(address indexed trader, int256 pnlBps)",
  "event TradeRecorded(address indexed trader, bool direction, uint64 size, int256 pnlBps)",
  "event Followed(address indexed follower, address indexed trader, uint256 amount)",
  "event Staked(address indexed trader)",
  "event Unstaked(address indexed trader)",
  "event TPSLSet(address indexed trader)",
]);
