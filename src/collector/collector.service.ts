import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { groupBy } from 'lodash';
import Big from 'big.js';
import * as moment from 'moment';
import { Market, TheGraphEvent } from './collector.interface';
import { Chart } from '../chart/chart.interface';
import {
  ApolloClient,
  gql,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client/core';
import fetch from 'cross-fetch';
import { ChartService } from '../chart/chart.service';
import { RPC_HOST, TOKEN_ABI, markets } from './config';

const getMintEventsQuery = (
  tokenSymbol: string,
  fromTime: number,
  toBlock: number,
  page: number,
) => `
query {
  mintEvents(
    first: 100,
    skip: ${page * 100},
    orderBy: blockNumber,
    where: {cTokenSymbol: "${tokenSymbol}", blockTime_gte: ${fromTime}, blockNumber_lte: ${toBlock}}
  ) {
    blockTime
    underlyingAmount
  }
}`;
const getRedeemEventsQuery = (
  tokenSymbol: string,
  fromTime: number,
  toBlock: number,
  page: number,
) => `
query {
  redeemEvents(
    first: 100,
    skip: ${page * 100},
    orderBy: blockNumber,
    where: {cTokenSymbol: "${tokenSymbol}", blockTime_gte: ${fromTime}, blockNumber_lte: ${toBlock}}
  ) {
    blockTime
    underlyingAmount
  }
}`;
const getLatestIndexedBlock = `
query {
  indexingStatusForCurrentVersion(subgraphName: "graphprotocol/compound-v2") { chains { latestBlock { hash number }}}
}
`;

@Injectable()
export class CollectorService implements OnModuleInit {
  clientMetadata: ApolloClient<NormalizedCacheObject>;
  clientCompound: ApolloClient<NormalizedCacheObject>;
  provider: ethers.providers.JsonRpcProvider;
  markets: Market[];
  updateRunning: boolean;

  constructor(private readonly chartService: ChartService) {
    this.clientMetadata = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: 'https://api.thegraph.com/index-node/graphql',
        fetch,
      }),
    });
    this.clientCompound = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri:
          'https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2',
        fetch,
      }),
    });

    this.provider = new ethers.providers.JsonRpcProvider(RPC_HOST);

    this.markets = markets.map(
      (m): Market => ({
        ...m,
        contract: new ethers.Contract(m.address, TOKEN_ABI, this.provider),
      }),
    );

    this.updateRunning = false;
  }

  onModuleInit() {
    this.getTheGraphLatestBlock().then((latestBlock) => {
      this.markets.forEach((m) => {
        this.fetchFromTheGraph(m, latestBlock).then(() => {
          this.syncFromChainAndListen(m, latestBlock);
        });
      });
    });
  }

  async listenToEvents(market: Market) {
    // TODO handle chain reorg
    // NOTE assuming the underlying token is 18 decimals, which is currently not true for USDC, USDT, BTC.
    // https://compound.finance/docs#protocol-math
    // Because update is not atomic, we can't allow parallel executionn
    const holdUpdate = async (): Promise<void> => {
      while (this.updateRunning) {
        await new Promise((res) => setTimeout(res, 10));
      }
    };
    market.contract.on(
      'Mint',
      async (_minter, mintAmount, mintTokens, event) => {
        const { timestamp } = await event.getBlock();
        console.log(
          `${market.symbol} Mint emitted at ${timestamp}, underlying amount: ${mintAmount}, amount: ${mintTokens}`,
        );

        await holdUpdate();

        this.updateSupply(
          Big(ethers.utils.formatUnits(mintAmount)),
          timestamp,
          market.address,
        );
      },
    );
    market.contract.on(
      'Redeem',
      async (redeemer, redeemAmount, redeemTokens, event) => {
        const { timestamp } = await event.getBlock();
        console.log(
          `${market.symbol} Redeem emitted to ${redeemer} at ${timestamp}, underlying amount: ${redeemAmount}, amount: ${redeemTokens}`,
        );

        await holdUpdate();

        this.updateSupply(
          Big(ethers.utils.formatUnits(redeemAmount)).times(-1),
          timestamp,
          market.address,
        );
      },
    );
  }

  // TODO make updates atomic
  async updateSupply(
    value: Big,
    timestamp: number,
    address: string,
  ): Promise<void> {
    this.updateRunning = true;
    try {
      const hour = moment.unix(timestamp).startOf('hour');
      const chartKey = {
        id: `${address}-${hour.valueOf()}`,
        timestamp: hour.toDate(),
      };
      const res = await this.chartService.findOne(chartKey);
      const currentValue = res ? res.value : '0';

      await this.chartService.update({
        ...chartKey,
        value: Big(currentValue).plus(value).toString(),
        address,
      });
    } catch (err) {
      console.log('Failed to update supply', err);
    } finally {
      this.updateRunning = false;
    }
  }

  async getTheGraphLatestBlock(): Promise<number> {
    try {
      const data = await this.clientMetadata.query({
        query: gql(getLatestIndexedBlock),
      });
      const latestBlock = Number(
        data.data.indexingStatusForCurrentVersion.chains[0].latestBlock.number,
      );
      console.log('latestBlock', latestBlock);
      return latestBlock;
    } catch (err) {
      console.log('Error fetching data: ', err);
    }
  }

  async fetchFromTheGraph(market: Market, latestBlock: number) {
    const paginateResults = async (
      getQueryFunction,
      resultKey: string,
    ): Promise<TheGraphEvent[]> => {
      let page = 0;
      let events: TheGraphEvent[] = [];
      let cont = false;

      do {
        const data = await this.clientCompound.query({
          query: gql(
            getQueryFunction(
              market.symbol,
              moment().startOf('hour').subtract(1, 'day').unix(),
              latestBlock,
              page,
            ),
          ),
        });

        cont = data.data[resultKey].length > 0;

        events = events.concat(data.data[resultKey]);
        page += 1;
      } while (cont);
      return events;
    };

    try {
      const mintEvents = await paginateResults(
        getMintEventsQuery,
        'mintEvents',
      );
      const redeemEvents = await paginateResults(
        getRedeemEventsQuery,
        'redeemEvents',
      );
      console.log(
        `${market.symbol} Fetched ${mintEvents.length} Mint and ${redeemEvents.length} Redeem events from TheGraph`,
      );

      const totalSupply: Chart[] = this.getTotalSupply24H(
        mintEvents,
        redeemEvents,
        market.address,
      );
      await this.chartService.batchPut(totalSupply);
    } catch (err) {
      console.log('Error fetching data: ', err);
    }
  }

  async syncFromChainAndListen(market: Market, latestBlock: number) {
    const inSequence = (tasks: Promise<void>[]): Promise<void> =>
      tasks.reduce((p, task) => p.then(() => task), Promise.resolve());

    const handleEvents = (
      events: ethers.Event[],
      amountKey: string,
      multiplier: number,
    ): Promise<void> =>
      inSequence(
        events.map(async (event) => {
          const { timestamp } = await event.getBlock();

          return this.updateSupply(
            Big(ethers.utils.formatEther(event.args[amountKey])).times(
              multiplier,
            ),
            timestamp,
            market.address,
          );
        }),
      );

    const queries: Promise<ethers.Event[]>[] = [
      market.contract.queryFilter(
        market.contract.filters.Mint(),
        latestBlock + 1,
      ),
      market.contract.queryFilter(
        market.contract.filters.Redeem(),
        latestBlock + 1,
      ),
    ];
    const [mintEvents, redeemEvents]: ethers.Event[][] = await Promise.all(
      queries,
    );

    // Start listening immediatelly after sync to avoid event loss.
    // This is still not guaranteed. Ideally blocks parsed should be explicitly tracked.
    this.listenToEvents(market);

    // since updates are not atomic we need to run them sequentially
    await handleEvents(mintEvents, 'mintAmount', 1);
    await handleEvents(redeemEvents, 'redeemAmount', -1);
  }

  getTotalSupply24H(
    mintEvents: TheGraphEvent[],
    redeemEvents: TheGraphEvent[],
    address: string,
  ): Chart[] {
    const groupEvents = (events: TheGraphEvent[]) =>
      groupBy(events, ({ blockTime }) =>
        moment.unix(blockTime).startOf('hour').unix(),
      );

    const sumUnderlying = (events: TheGraphEvent[] = []): Big =>
      events.reduce(
        (accu, event) => accu.plus(Big(event.underlyingAmount)),
        Big(0),
      );

    // avoid gaps if no events were emitted in given hour
    const hours: number[] = Array(24)
      .fill(null)
      .map((_, i) =>
        moment()
          .startOf('hour')
          .subtract(23 - i, 'hours')
          .unix(),
      );

    const groupedMintEvents = groupEvents(mintEvents);
    const groupedRedeemEvents = groupEvents(redeemEvents);

    return hours.map((hour) => {
      const time = moment.unix(hour);
      return {
        id: `${address}-${time.valueOf()}`,
        timestamp: time.toDate(),
        value: sumUnderlying(groupedMintEvents[hour])
          .minus(sumUnderlying(groupedRedeemEvents[hour]))
          .toString(),
        address,
      };
    });
  }
}
