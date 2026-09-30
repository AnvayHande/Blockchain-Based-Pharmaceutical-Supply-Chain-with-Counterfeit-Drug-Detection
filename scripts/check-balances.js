import hre from "hardhat";

async function main() {
  const { ethers } = hre;
  
  const addresses = [
    { label: "Admin", address: process.env.DEPLOYER_PRIVATE_KEY ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY).address : null },
    { label: "Manufacturer", address: process.env.MANUFACTURER_ADDRESS },
    { label: "Distributor", address: process.env.DISTRIBUTOR_ADDRESS },
    { label: "Wholesaler", address: process.env.WHOLESALER_ADDRESS },
    { label: "Pharmacy", address: process.env.PHARMACY_ADDRESS }
  ];

  console.log("Checking Sepolia ETH balances...\n");

  for (const item of addresses) {
    if (!item.address) {
      console.log(`${item.label}: Address not configured.`);
      continue;
    }
    if (!ethers.isAddress(item.address)) {
      console.log(`${item.label}: Invalid address format (${item.address})`);
      continue;
    }

    try {
      const balance = await ethers.provider.getBalance(item.address);
      const balanceEth = ethers.formatEther(balance);
      const isLow = Number(balanceEth) < 0.005;
      
      console.log(`${item.label} (${item.address}):`);
      console.log(`  Balance: ${balanceEth} ETH ${isLow ? "⚠️ LOW BALANCE (< 0.005 ETH)" : "✅"}`);
    } catch (err) {
      console.error(`  Error fetching balance for ${item.label}:`, err.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
