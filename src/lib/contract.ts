export const CIPHER_TRADE_ADDRESS = "0x4ADdAE6dC62C84fac26Fbf6C62f467B2f53E6A6B";

export const CIPHER_TRADE_ABI = [
  // ── Write ──
  "function openPosition(bytes32 inputDirection, bytes32 inputSize, bytes calldata inputProof) external",
  "function closePosition() external",
  "function followTrader(address trader, uint256 allocation) external",
  "function settlePosition(address trader, bool direction, uint64 size) external",
  "function stake() external",
  "function unstake() external",
  "function setPrice(uint256 price) external",

  // ── Read: position ──
  "function isPositionOpen(address trader) external view returns (bool)",
  "function getFollowerCount(address trader) external view returns (uint256)",
  "function getPosition(address trader) external view returns (bytes32 size, uint256 entryPrice, bool isOpen, bool staked)",
  "function currentPrice() external view returns (uint256)",
  "function stakedBalance(address) external view returns (uint256)",
  "function admin() external view returns (address)",

  // ── Read: registry & track record ──
  "function getTraderCount() external view returns (uint256)",
  "function getTraders() external view returns (address[])",
  "function isRegistered(address) external view returns (bool)",
  "function getTradeCount(address trader) external view returns (uint256)",
  "function getTradeHistory(address trader) external view returns (tuple(uint256 entryPrice, uint256 exitPrice, bool direction, uint64 size, int256 pnlBps, uint256 timestamp)[])",
  "function traderStats(address) external view returns (uint256 totalTrades, uint256 wins, int256 netPnlBps)",

  // ── Events ──
  "event PositionOpened(address indexed trader, uint256 entryPrice)",
  "event PositionClosed(address indexed trader)",
  "event Settled(address indexed trader, int256 pnlBps)",
  "event TradeRecorded(address indexed trader, bool direction, uint64 size, int256 pnlBps)",
  "event Followed(address indexed follower, address indexed trader, uint256 amount)",
  "event Staked(address indexed trader)",
  "event Unstaked(address indexed trader)",
] as const;
