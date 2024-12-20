import {
  BytesLike,
  concat,
  id as keccak256,
  TypedDataDomain,
  TypedDataEncoder,
} from "npm:ethers@^6.13.4";

export enum OrderKind {
  SELL = "sell",
  BUY = "buy",
}
export enum OrderBalance {
  ERC20 = "erc20",
  EXTERNAL = "external",
  INTERNAL = "internal",
}

export interface Order {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: number;
  // This is the app data struct hash
  appData: BytesLike;
  feeAmount: bigint;
  kind: OrderKind;
  partiallyFillable: boolean;
  sellTokenBalance: OrderBalance;
  buyTokenBalance: OrderBalance;
}

export interface OrderWithExtendedppData {
  order: Order;
  appDataString: string;
  owner: string;
}

const CHAIN = {
  apiName: "mainnet",
  chainId: 1,
};

const SOME_ORDER_UID =
  "0x502b1cc8d3da63b55762fa028a5c6ecf0818c765484525fcfe2b63103b173e758352b830b2d719aa370cb04a1830c14cf32e3f1a67655feb";

async function orderFromApi(uid: string): Promise<OrderWithExtendedppData> {
  const url = `https://api.cow.fi/${CHAIN.apiName}/api/v1/orders/${uid}`;
  const response = await fetch(
    url,
  );
  if (!response.ok) {
    console.error(`Failed HTTP request to ${url}`);
    console.error(response);
    Deno.exit(1);
  }
  const apiOrder = JSON.parse(await response.text());
  const order = {
    sellToken: apiOrder.sellToken,
    buyToken: apiOrder.buyToken,
    receiver: apiOrder.receiver,
    sellAmount: BigInt(apiOrder.sellAmount),
    buyAmount: BigInt(apiOrder.buyAmount),
    validTo: apiOrder.validTo,
    appData: apiOrder.appData,
    feeAmount: BigInt(apiOrder.feeAmount),
    kind: apiOrder.kind,
    partiallyFillable: apiOrder.partiallyFillable,
    sellTokenBalance: apiOrder.sellTokenBalance,
    buyTokenBalance: apiOrder.buyTokenBalance,
  };
  return {
    order,
    appDataString: apiOrder.fullAppData,
    owner: apiOrder.owner,
  };
}

let orderUid;
switch (Deno.args.length) {
  case 0:
    orderUid = SOME_ORDER_UID;
    break;
  case 1:
    orderUid = Deno.args[0];
    break;
  default:
    console.error(`Usage: ./run.sh [order_uid]`);
    Deno.exit(1);
}
console.log(`Using order with UID ${orderUid}`);

const order = await orderFromApi(orderUid);

// The app data hash is derived from the app data string through an IPFS hash.
// The app data hash is designed to be a unique content identifier on the IPFS
// network for the file containing the string that encode the app data struct,
// returned from the API.
// In the simplest case, this identifier is just the keccak256 hashing of the
// string. However, IPFS requires chunking of content after a certain size, so
// if the app data is very large (certainly >1MB) this doesn't work and the
// IPFS hash computation has to be carried out in full.
// I think there are no orders that require anything but simple keccak256 over
// the string at this point in time, but this is not confirmed.
// The full computation of the IPFS hash can be found in the services:
// https://github.com/cowprotocol/services/blob/53ec0677f0a59c2c93770a86117cd16aaa1d3996/crates/app-data/src/app_data_hash.rs#L187-L198 
if (order.order.appData == "0x" + "00".repeat(32)) {
  console.log("✅ Zero app data, the app data can be assumed to be '{}'");
} else if (order.appDataString === undefined) {
  console.error("❌ Order has no app data preimage");
} else if (keccak256(order.appDataString) == order.order.appData) {
  console.log("✅ App data matches simplified IPFS hash computation");
} else {
  throw new Error("❌ IPFS hash does not match simple hashing with keccak256");
}

// https://github.com/cowprotocol/contracts/blob/v1/src/contracts/mixins/GPv2Signing.sol#L31-L42
const domain: TypedDataDomain = {
  name: "Gnosis Protocol",
  version: "v2",
  chainId: CHAIN.chainId,
  // https://docs.cow.fi/cow-protocol/reference/contracts/core#deployments
  verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
};

// The EIP-712 type fields definition for a CoW Protocol order.
// They don't match with the order struct
// https://github.com/cowprotocol/contracts/blob/v1/src/contracts/libraries/GPv2Order.sol#L26-L48
export const ORDER_TYPE_FIELDS = [
  { name: "sellToken", type: "address" },
  { name: "buyToken", type: "address" },
  { name: "receiver", type: "address" },
  { name: "sellAmount", type: "uint256" },
  { name: "buyAmount", type: "uint256" },
  { name: "validTo", type: "uint32" },
  { name: "appData", type: "bytes32" },
  { name: "feeAmount", type: "uint256" },
  { name: "kind", type: "string" },
  { name: "partiallyFillable", type: "bool" },
  { name: "sellTokenBalance", type: "string" },
  { name: "buyTokenBalance", type: "string" },
];
export const ORDER_TYPE_NAME = "Order";

const orderHash = TypedDataEncoder.hash(domain, {
  [ORDER_TYPE_NAME]: ORDER_TYPE_FIELDS,
}, { ...order.order, appData: order.order.appData });

const hexValidTo = "0x" + order.order.validTo.toString(16).padStart(8, "0");
const computedUid = concat([orderHash, order.owner, hexValidTo]);

if (orderUid != computedUid) {
  console.error("Original:   ", orderUid);
  console.error("Recomputed: ", computedUid);
  throw new Error("Unreachable code: order UID recomputation failed");
} else {
  console.log("✅ Recomputed order UID matches with original order UID");
}
