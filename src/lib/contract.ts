export const CIPHER_TRADE_ADDRESS = "0x0000000000000000000000000000000000000000"; // update after Sepolia deploy

export const CIPHER_TRADE_ABI = [
  "function openPosition(bytes32 inputDirection, bytes32 inputSize, bytes calldata inputProof) external",
  "function closePosition() external",
  "function followTrader(address trader, uint256 allocation) external",
  "function settlePosition(address trader, bool direction, uint64 size) external",
  "function stake() external",
  "function unstake() external",
  "function setPrice(uint256 price) external",
  "function isPositionOpen(address trader) external view returns (bool)",
  "function getFollowerCount(address trader) external view returns (uint256)",
  "function getPosition(address trader) external view returns (bytes32 size, uint256 entryPrice, bool isOpen, bool staked)",
  "function currentPrice() external view returns (uint256)",
  "function stakedBalance(address) external view returns (uint256)",
  "function admin() external view returns (address)",
  "event PositionOpened(address indexed trader, uint256 entryPrice)",
  "event PositionClosed(address indexed trader)",
  "event Settled(address indexed trader, int256 pnlBps)",
  "event Followed(address indexed follower, address indexed trader, uint256 amount)",
] as const;