# PharmaChain — Blockchain-Based Pharmaceutical Supply Chain

A decentralized application for tracking pharmaceutical batches from manufacturer to pharmacy, with public counterfeit detection using Ethereum blockchain.

## Features

- **Role-based pages** — separate dedicated pages for Manufacturer, Distributor, Wholesaler, Pharmacy, and Admin
- **Code 128 barcode + QR code** labels on every batch
- **Public verification** without MetaMask — anyone can verify a medicine
- **Counterfeit detection** — metadata hash stored on-chain, recomputed to detect tampering
- **Full supply chain history** — every custody transfer recorded on Ethereum
- **Scan with camera** — reads both QR codes and Code 128 barcodes

---

## Quick Start

### Prerequisites
- Node.js 20+
- MetaMask browser extension
- Git

### 1. Install dependencies
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Start everything (Windows)
```bash
start_project.bat
```

This will:
1. Start a Hardhat local blockchain node
2. Deploy the smart contract (writes address to `frontend/src/contracts/config.js`)
3. Seed demo accounts and batches
4. Start the Express backend on port 3001
5. Start the Vite frontend on port 5173

### 3. Open the app
```
http://localhost:5173
```

---

## Demo Accounts (Hardhat defaults)

| Role         | Organization            | Account # | Import to MetaMask? |
|--------------|-------------------------|-----------|---------------------|
| Admin        | Deployer                | #0        | Yes — for admin     |
| Manufacturer | CiplaPharm Ltd          | #1        | Yes                 |
| Distributor  | MedLink Distributors    | #2        | Yes                 |
| Wholesaler   | BulkMed Wholesale       | #3        | Yes                 |
| Pharmacy     | CityHealth Pharmacy     | #4        | Yes                 |

Hardhat default private keys are printed when you run `npx hardhat node`. Copy them into MetaMask.

### Sample Batch IDs (seeded)
The seed script prints exact batch IDs to the console. They follow the format:
- `PHM-CIP-PAR-<YYYYMMDD>-001` — Paracetamol (AT_PHARMACY, genuine)
- `PHM-CIP-IBU-<YYYYMMDD>-001` — Ibuprofen (RECALLED)

---

## Manual Testing Guide

### End-to-End Flow
1. Import Hardhat account #0 into MetaMask → connect wallet → visit `/admin` → register 4 participants (accounts #1–#4)
2. Switch MetaMask to account #1 (Manufacturer) → `/manufacturer` → fill form → click Register Batch → see barcode + QR label
3. Transfer the batch to Distributor (dropdown) from Manufacturer page
4. Switch to account #2 (Distributor) → `/distributor` → see incoming batch → verify it → transfer to Pharmacy
5. Switch to account #4 (Pharmacy) → `/pharmacy` → see batch → click "Complete Sale"
6. Visit `/` (no wallet needed) → enter the batch ID → see **GENUINE — ALREADY SOLD** verdict
7. Scan the QR code or barcode with the camera: `/scan`

### Verdict scenarios to test
| Test | Expected Result |
|------|----------------|
| Unknown batch ID | FAKE / UNREGISTERED (red) |
| Recalled batch ID | RECALLED (red) |
| Valid batch at pharmacy | GENUINE (green) |
| Sold batch | GENUINE — ALREADY SOLD (blue) |
| Disconnect blockchain | ERROR (grey) — never shows FAKE |

---

## Phone Testing

A customer's phone cannot reach `localhost:8545`. For a phone demo:

**Option 1 — Same Wi-Fi LAN:**
```bash
# 1. Find your laptop's LAN IP (e.g. 192.168.1.10)
ipconfig

# 2. Start Hardhat with network binding
npx hardhat node --hostname 0.0.0.0

# 3. Set frontend env
# frontend/.env
VITE_RPC_URL=http://192.168.1.10:8545

# 4. Start Vite with host binding
cd frontend && npx vite --host
```

**Option 2 — Sepolia Testnet:**
Set `VITE_RPC_URL` to a Sepolia RPC URL (Alchemy/Infura) after deploying to Sepolia.

> **HTTPS for Camera**: Camera scanning (`/scan`) requires HTTPS or localhost. For phone testing,
> use a tunnelling tool like [ngrok](https://ngrok.com/) or configure `vite --https`.

---

## NPM Scripts

### Root (Hardhat)
```bash
npm run compile       # Compile Solidity contracts
npm run test          # Run Hardhat contract tests
npm run node          # Start local blockchain node
npm run deploy:local  # Deploy to local node
npm run seed          # Seed demo data (requires node + backend running)
```

### Frontend
```bash
cd frontend
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # OXLint check
npm run test   # Vitest unit tests
```

### Backend
```bash
cd backend
npm start      # Start backend
npm run dev    # Start with --watch (auto-reload)
```

---

## Architecture

```
React DApp (Vite) ─────────────────────────────────────────────
/manufacturer → ManufacturerPage   (RoleGuard: Manufacturer)
/distributor  → DistributorPage    (RoleGuard: Distributor)
/wholesaler   → WholesalerPage     (RoleGuard: Wholesaler)
/pharmacy     → PharmacyPage       (RoleGuard: Pharmacy)
/admin        → AdminPage          (RoleGuard: Admin)
/             → VerifyPage         (PUBLIC — no wallet)
/scan         → ScanPage           (PUBLIC — no wallet)
         │ write tx (MetaMask)   │ read-only (JsonRpcProvider)
         ▼                       ▼
    PharmaSupplyChain.sol   ← SOURCE OF TRUTH
         ▲
         │ metadataHash compared to recomputed hash
    Express backend :3001 (descriptive metadata + scans + reports)
```

**Golden rules:**
1. Ownership, status, and authenticity → decided ONLY by the smart contract
2. Backend is NOT authoritative — integrity proven by hash comparison
3. Never store private keys or personal data

---

## Known Limitation

This system proves that **a batch was registered by an authorized manufacturer and how it moved**. It **cannot** prove that the physical pack in your hand is not a **copy of a real label** — a barcode can be reprinted on a fake pack.

Risk mitigation in this system:
- SOLD-status warning ("label may have been copied")
- Scan-count warning (>50 scans)
- Expiry and recall checks
- Tamper-evident metadata hash

**Future work:** Unit-level serial numbers with Merkle root on-chain for full per-pack verification.
