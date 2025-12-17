/**
 * Script to deposit tFIL into Synapse Warm Storage contract
 * 
 * Usage:
 * cd apps/api && npx tsx ../../scripts/deposit-warm-storage.ts
 */

import { Synapse } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env' });

const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const FILECOIN_RPC_URL = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';

// Amount to deposit (in FIL/tFIL) - 1 tFIL should be enough for testing
const DEPOSIT_AMOUNT = '1'; // tFIL

async function main() {
  if (!BACKEND_PRIVATE_KEY) {
    console.error('❌ BACKEND_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  console.log('🔧 Initializing Synapse SDK...');
  
  // Create Synapse client
  const synapse = await Synapse.create({
    privateKey: BACKEND_PRIVATE_KEY,
    rpcURL: FILECOIN_RPC_URL,
  });

  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(FILECOIN_RPC_URL);
  
  console.log(`📍 Network: ${synapse.getNetwork()}`);
  console.log(`👛 Wallet address: ${wallet.address}`);
  
  // Check wallet balance
  const walletBalance = await provider.getBalance(wallet.address);
  console.log(`💰 Wallet balance: ${ethers.formatEther(walletBalance)} tFIL`);
  
  // Check current deposit in payments contract
  const payments = synapse.payments;
  
  try {
    // Get account info from payments contract
    const accountInfo = await payments.accountInfo();
    console.log('\n📊 Current Synapse Payments Account:');
    console.log(`   Total funds: ${ethers.formatEther(accountInfo.funds)} tFIL`);
    console.log(`   Available funds: ${ethers.formatEther(accountInfo.availableFunds)} tFIL`);
    console.log(`   Lockup current: ${ethers.formatEther(accountInfo.lockupCurrent)} tFIL`);
    console.log(`   Lockup rate: ${ethers.formatEther(accountInfo.lockupRate)} tFIL/epoch`);
    
    // Check if we need to deposit
    const depositAmountWei = ethers.parseEther(DEPOSIT_AMOUNT);
    
    if (accountInfo.availableFunds >= depositAmountWei) {
      console.log('\n✅ You already have sufficient funds deposited!');
      return;
    }
    
    console.log(`\n📥 Depositing ${DEPOSIT_AMOUNT} tFIL to Synapse Payments contract...`);
    
    // Deposit funds
    const tx = await payments.deposit(depositAmountWei);
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt?.blockNumber}`);
    
    // Check new balance
    const newAccountInfo = await payments.accountInfo();
    console.log('\n📊 Updated Synapse Payments Account:');
    console.log(`   Total funds: ${ethers.formatEther(newAccountInfo.funds)} tFIL`);
    console.log(`   Available funds: ${ethers.formatEther(newAccountInfo.availableFunds)} tFIL`);
    
    console.log('\n🎉 Deposit complete! You can now run the integration tests.');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    
    if (walletBalance < ethers.parseEther(DEPOSIT_AMOUNT)) {
      console.log('\n⚠️  Your wallet balance is too low. Get more tFIL from the faucet:');
      console.log('   https://faucet.calibration.fildev.network/');
    }
    
    process.exit(1);
  }
}

main();

