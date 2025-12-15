/**
 * General Deployment Script for EvidenceRegistry Contract
 *
 * This script deploys to whichever network is specified via --network flag.
 * For Calibration testnet, use: pnpm deploy:calibration
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network <network>
 */

import { ethers } from 'hardhat';

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Deploying EvidenceRegistry to ${network.name} (Chain ID: ${chainId})`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${await deployer.getAddress()}`);

  const EvidenceRegistry = await ethers.getContractFactory('EvidenceRegistry');
  const registry = await EvidenceRegistry.deploy();

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log(`EvidenceRegistry deployed to: ${address}`);
  console.log(`Version: ${await registry.VERSION()}`);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

