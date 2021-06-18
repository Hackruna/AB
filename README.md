
# Starter template for DeFiWeb2 Backend Task

## Installation

```bash
$ npm install
```

## Running the app

```bash
# install DDB
$ npm run ddb:install

# start DDB
$ npm run ddb:start

# watch mode
$ npm run start:dev
```


## Solution

### 1. Assumptions
Because of the way the task is structured, I took on an assumption, that the hourly values should represent the changes in total supply of the underlying token as reported by `Mint` and `Redeem`, not the actual total supply, which is cumulative from the creation of the market.

### 2. App logic
1) Get latest parsed block from The Block `latestBlock`
2) For each market defined in `config.ts`
2.1. Fetch `Mint` and `Redeem` events from TheGraph for the last 24h
2.2. Calculate hourly supply change and record it in DDB 
2.3. Fetch the events from infura from `latestBlock + 1` 
2.4. Start listening on events
2.5. Update the DB with events from 2.3
3) When listeners are triggered, update the DB with captured event
4) Expose endpoint `/supply/:address`on `localhost:3000` to fetch the supply for last 24h.

### 3. Possible improvements
- Between the reply comes in in 2.3) and starting listeners in 2.4) the block could possibly be mined, and it's events lost. To mitigate it and also other possible problems, like errors on listeners, app crashes etc,
one solution would be to explicitly track the blocks and logs being processed, and verify no events are lost or double counted.
- Handle formatting of values of underlying assets with decimals other than 18
- Handle chain reorganization
- Make supply updates atomic on DDB.
With the schema provided, correctly calculating updated token value needs to happen in the code,
with big decimal module. I'm not sure if this is in scope of the task, and I have not found any information on how to use DynamoDB's BigDecimal type  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBMapper.DataTypes.html
with Dynamoose https://dynamoosejs.com/guide/Schema/#attribute-types to be able to update the values atomically in DDB. Because there could be multiple transactions to compound contract within the same block, or in fact one transaction can emit both Mint and Redeem, in such a case listeners would fire simultanously, and would try to update the same current value.
To avoid this, as a quick workaround the updates are waiting on a flag; queue or a semaphor would be other options.

