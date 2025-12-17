/**
 * Check Synapse Warm Storage balance and setup
 * 
 * Run from apps/api: npx tsx scripts/check-balance.ts
 */

import { Synapse } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

// Load env from parent
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY!;
const FILECOIN_RPC_URL = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';

async function main() {
  if (!BACKEND_PRIVATE_KEY) {
    console.error('❌ BACKEND_PRIVATE_KEY not found');
    process.exit(1);
  }

  console.log('🔧 Initializing...');
  
  const synapse = await Synapse.create({
    privateKey: BACKEND_PRIVATE_KEY,
    rpcURL: FILECOIN_RPC_URL,
  });

  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
  
  console.log(`\n📍 Network: ${synapse.getNetwork()}`);
  console.log(`👛 Wallet: ${wallet.address}`);
  
  // Check wallet balance (native tFIL)
  const walletBalance = await provider.getBalance(wallet.address);
  console.log(`💰 Wallet tFIL: ${ethers.formatEther(walletBalance)}`);
  
  // Check Synapse payments balance
  const payments = synapse.payments;
  
  try {
    const accountInfo = await payments.accountInfo();
    console.log(`\n📊 Synapse Payments Account:`);
    console.log(`   Total deposited: ${ethers.formatEther(accountInfo.funds)} tFIL`);
    console.log(`   Available: ${ethers.formatEther(accountInfo.availableFunds)} tFIL`);
    console.log(`   Locked up: ${ethers.formatEther(accountInfo.lockupCurrent)} tFIL`);
    
    const minRequired = ethers.parseEther('0.06'); // 60000000000000000 wei
    
    // Step 1: Check and deposit funds if needed
    if (accountInfo.availableFunds < minRequired) {
      console.log(`\n⚠️  Insufficient funds in Synapse Payments!`);
      console.log(`   Need: ${ethers.formatEther(minRequired)} tFIL`);
      console.log(`   Have: ${ethers.formatEther(accountInfo.availableFunds)} tFIL`);
      
      const depositAmount = ethers.parseEther('0.1'); // Deposit 0.1 tFIL
      
      if (walletBalance < depositAmount) {
        console.log(`\n❌ Wallet balance too low to deposit!`);
        console.log(`   Get tFIL from: https://faucet.calibration.fildev.network/`);
        process.exit(1);
      }
      
      console.log(`\n📥 Depositing 0.1 tFIL to Synapse...`);
      const tx = await payments.deposit(depositAmount);
      console.log(`   TX: ${tx.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt?.blockNumber}`);
      
      // Check new balance
      const newInfo = await payments.accountInfo();
      console.log(`\n📊 New balance: ${ethers.formatEther(newInfo.availableFunds)} tFIL`);
    } else {
      console.log(`\n✅ Sufficient funds available for storage!`);
    }

    // Step 2: Check and approve the Warm Storage service
    const warmStorageAddress = synapse.getWarmStorageAddress();
    console.log(`\n🔐 Warm Storage Service: ${warmStorageAddress}`);
    
    // Check if service is approved
    const serviceApproval = await payments.serviceApproval(warmStorageAddress);
    console.log(`   Is Approved: ${serviceApproval.isApproved}`);
    console.log(`   Rate Allowance: ${ethers.formatEther(serviceApproval.rateAllowance)} tFIL`);
    console.log(`   Lockup Allowance: ${ethers.formatEther(serviceApproval.lockupAllowance)} tFIL`);
    
    if (!serviceApproval.isApproved || serviceApproval.rateAllowance === 0n) {
      console.log(`\n⚠️  Warm Storage service not approved! Approving...`);
      
      // Approve with generous allowances
      const rateAllowance = ethers.parseEther('1'); // 1 tFIL rate allowance
      const lockupAllowance = ethers.parseEther('1'); // 1 tFIL lockup allowance  
      const maxLockupPeriod = 30n * 24n * 60n * 2n; // 30 days in epochs (2 min epochs)
      
      const approveTx = await payments.approveService(
        warmStorageAddress,
        rateAllowance,
        lockupAllowance,
        maxLockupPeriod
      );
      console.log(`   TX: ${approveTx.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      const approveReceipt = await approveTx.wait();
      console.log(`   ✅ Service approved in block ${approveReceipt?.blockNumber}`);
      
      // Verify approval
      const newApproval = await payments.serviceApproval(warmStorageAddress);
      console.log(`\n📊 Service now approved: ${newApproval.isApproved}`);
    } else {
      console.log(`\n✅ Warm Storage service already approved!`);
    }
    
    console.log(`\n🎉 Ready to run integration tests!`);
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
