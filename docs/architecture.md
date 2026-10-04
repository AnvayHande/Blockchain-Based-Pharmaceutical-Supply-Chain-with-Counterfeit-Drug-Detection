# System Architecture

## Overview
This Pharmaceutical Supply Chain project implements a dual-layer architecture:
1. **On-Chain Layer**: A Solidity smart contract (`PharmaSupplyChain.sol`) deployed to Ethereum handles all authoritative trust logic.
2. **Off-Chain Layer**: A Node.js backend handles auxiliary metadata to simulate IPFS/certificate storage, providing speed and flexibility for non-sensitive data.

## Data Flow
1. **Registration**: A Manufacturer initiates a `registerMedicine` transaction on the blockchain. The frontend simultaneously stores extended metadata in the backend.
2. **Transfer**: The Manufacturer calls `transferMedicine` to pass ownership to a Distributor. The blockchain cryptographically validates the sender and receiver.
3. **Verification**: A customer scans a QR code using the DApp. The frontend fetches the live status and owner from the blockchain, and matches it with the descriptive metadata from the backend.

## Security Model
- **Smart Contract as the Source of Truth**: The frontend never trusts the backend for ownership or status. All verification must pass the smart contract's checks.
- **Role-Based Access Control**: Functions in the smart contract use `onlyRole` and `onlyOwner` modifiers. If a malicious distributor tries to register medicine, the Ethereum network rejects the transaction.
