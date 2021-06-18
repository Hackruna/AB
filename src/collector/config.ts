import { MarketConfig } from './collector.interface';

export const RPC_HOST =
  'https://mainnet.infura.io/v3/8d810610fe7741cc9753cbaafb1f000c';
export const TOKEN_ABI = [
  'event Mint(address minter, uint mintAmount, uint mintTokens);',
  'event Redeem(address redeemer, uint redeemAmount, uint redeemTokens);',
];

export const markets: MarketConfig[] = [
  {
    address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
    symbol: 'cETH',
    underlyingDecimals: 18,
  },
  {
    address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
    symbol: 'cDAI',
    underlyingDecimals: 18,
  },
  {
    address: '0x35A18000230DA775CAc24873d00Ff85BccdeD550',
    symbol: 'cUNI',
    underlyingDecimals: 18,
  },
];
