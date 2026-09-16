import hardhat from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const PharmaSupplyChain = await hardhat.ethers.getContractFactory("PharmaSupplyChain");
  console.log("Deploying PharmaSupplyChain...");
  const pharmaSupplyChain = await PharmaSupplyChain.deploy();
  await pharmaSupplyChain.waitForDeployment();
  
  const targetAddress = await pharmaSupplyChain.getAddress();
  console.log("PharmaSupplyChain deployed to:", targetAddress);

  // Write the contract address and ABI to frontend/src/contracts/config.js
  const configDir = path.join(__dirname, "../frontend/src/contracts");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Get the artifact to extract ABI
  const artifact = await hardhat.artifacts.readArtifact("PharmaSupplyChain");

  const configContent = `
export const CONTRACT_ADDRESS = "${targetAddress}";
export const CONTRACT_ABI = ${JSON.stringify(artifact.abi, null, 2)};
`;

  fs.writeFileSync(path.join(configDir, "config.js"), configContent);
  console.log("Contract config written to frontend/src/contracts/config.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
