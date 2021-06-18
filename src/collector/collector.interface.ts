import { Contract } from 'ethers';
import { Big } from 'big.js';

export interface MarketConfig {
  address: string;
  symbol: string;
  underlyingDecimals: number;
}

export interface Market extends MarketConfig {
  contract: Contract;
}

export interface TheGraphEvent {
  __typename: string;
  blockTime: number;
  underlyingAmount: string;
}

export interface QueueTask {
  value: Big;
  timestamp: number;
  address: string;
}