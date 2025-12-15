/**
 * Deployment Script for EvidenceRegistry Contract
 *
 * Deploys the EvidenceRegistry contract to Filecoin Calibration testnet.
 * Saves deployment info to deployments/calibration.json.
 *
 * Prerequisites:
 *   - BACKEND_PRIVATE_KEY set in .env with funded wallet
 *   - FILECOIN_RPC_URL set (defaults to Calibration public RPC)
 *
 * Usage:
 *   pnpm deploy:calibration
 *
 * Output:
 *   - Contract address
 *   - Transaction hash
 *   - Block number
 *   - Deployment saved to deployments/calibration.json
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentInfo {
  network: string;
  chainId: number;
  contractName: string;
  contractAddress: string;
  deployerAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  version: string;
  verified: boolean;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  EvidenceRegistry Deployment - Filecoin Calibration Testnet');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Network:  ${network.name}`);
  console.log(`Chain ID: ${chainId}`);

  // Validate we're on Calibration testnet
  if (chainId !== 314159) {
    console.error('\n❌ Error: Not connected to Calibration testnet (Chain ID: 314159)');
    console.error(`   Current chain ID: ${chainId}`);
    process.exit(1);
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`Deployer: ${deployerAddress}`);

  // Check balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  const balanceInFil = ethers.formatEther(balance);
  console.log(`Balance:  ${balanceInFil} FIL\n`);

  if (balance === 0n) {
    console.error('❌ Error: Deployer wallet has no FIL balance');
    console.error('   Get test FIL from: https://faucet.calibration.fildev.network/');
    process.exit(1);
  }

  // Minimum balance check (0.1 FIL for deployment gas)
  const minBalance = ethers.parseEther('0.1');
  if (balance < minBalance) {
    console.warn('⚠️  Warning: Low balance. Deployment may fail due to insufficient gas.');
  }

  // Deploy the contract
  console.log('Deploying EvidenceRegistry...\n');

  const EvidenceRegistry = await ethers.getContractFactory('EvidenceRegistry');
  const registry = await EvidenceRegistry.deploy();

  // Wait for deployment transaction to be mined
  const deploymentTx = registry.deploymentTransaction();
  if (!deploymentTx) {
    console.error('❌ Error: Deployment transaction not found');
    process.exit(1);
  }

  console.log(`Transaction Hash: ${deploymentTx.hash}`);
  console.log('Waiting for confirmation...\n');

  // Wait for the transaction to be mined
  const receipt = await deploymentTx.wait();
  if (!receipt) {
    console.error('❌ Error: Transaction receipt not found');
    process.exit(1);
  }

  const contractAddress = await registry.getAddress();
  const blockNumber = receipt.blockNumber;

  // Verify deployment by reading contract state
  const version = await registry.VERSION();
  const deployerFromContract = await registry.deployer();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEPLOYMENT SUCCESSFUL');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Transaction Hash: ${deploymentTx.hash}`);
  console.log(`Block Number:     ${blockNumber}`);
  console.log(`Contract Version: ${version}`);
  console.log(`Deployer:         ${deployerFromContract}`);

  // Calculate gas used
  const gasUsed = receipt.gasUsed;
  const effectiveGasPrice = receipt.gasPrice ?? 0n;
  const totalCost = gasUsed * effectiveGasPrice;
  console.log(`Gas Used:         ${gasUsed.toString()}`);
  console.log(`Total Cost:       ${ethers.formatEther(totalCost)} FIL\n`);

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: 'calibration',
    chainId,
    contractName: 'EvidenceRegistry',
    contractAddress,
    deployerAddress,
    transactionHash: deploymentTx.hash,
    blockNumber,
    timestamp: new Date().toISOString(),
    version,
    verified: false,
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentPath = path.join(deploymentsDir, 'calibration.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${deploymentPath}`);

  // Output environment variable update instructions
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Update your .env file with the contract address:');
  console.log(`   NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS=${contractAddress}`);
  console.log(`   EVIDENCE_REGISTRY_ADDRESS=${contractAddress}\n`);
  console.log('2. Verify the contract on Filfox:');
  console.log(`   https://calibration.filfox.info/address/${contractAddress}\n`);
  console.log('3. The contract is now ready for use.\n');

  return deploymentInfo;
}

main()
  .then((deployment) => {
    console.log('Deployment completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });

