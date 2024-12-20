# CoW Protocol order hash computation

A simple script that, given an order UID, recovers all order data from the API and recomputes the order UID from this data.

It only supports the prod environment and the Ethereum mainnet chain.

## Requirements

- [Deno](https://deno.com/).

## Usage

Validate the math to compute an order UID with:

```sh
./run.sh [order_uid]
```

If the UID is not specified, it will use a hardcoded UID.
