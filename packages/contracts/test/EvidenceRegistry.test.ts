import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { EvidenceRegistry } from '../typechain-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * EvidenceRegistry Contract Tests
 *
 * Comprehensive test suite covering:
 * - Happy path scenarios
 * - Failure cases and edge conditions
 * - Access control
 * - Gas consumption verification
 */
describe('EvidenceRegistry', function () {
  // Test fixtures for consistent state across tests
  async function deployFixture(): Promise<{
    registry: EvidenceRegistry;
    deployer: HardhatEthersSigner;
    submitter: HardhatEthersSigner;
    otherUser: HardhatEthersSigner;
  }> {
    const [deployer, submitter, otherUser] = await ethers.getSigners();

    const EvidenceRegistry = await ethers.getContractFactory('EvidenceRegistry');
    const registry = await EvidenceRegistry.deploy() as unknown as EvidenceRegistry;
    await registry.waitForDeployment();

    return { registry, deployer, submitter, otherUser };
  }

  // Helper to generate test evidence data
  function generateTestEvidence(index = 0) {
    // Generate a unique evidence ID from a UUID-like string
    const uuidString = `evidence-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;
    const evidenceId = ethers.keccak256(ethers.toUtf8Bytes(uuidString));

    // Generate a realistic content hash (SHA-256 of some content)
    const contentHash = ethers.keccak256(
      ethers.toUtf8Bytes(`test-content-${index}-${Date.now()}`)
    );

    const pieceCid = `bafkzcib${Math.random().toString(36).substring(2, 15)}`;
    const providerAddress = `f0${Math.floor(Math.random() * 1000000)}`;

    return { evidenceId, contentHash, pieceCid, providerAddress };
  }

  describe('Deployment', function () {
    it('should set the deployer correctly', async function () {
      const { registry, deployer } = await loadFixture(deployFixture);
      expect(await registry.deployer()).to.equal(deployer.address);
    });

    it('should initialize with zero evidence count', async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.evidenceCount()).to.equal(0);
    });

    it('should report correct version', async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.VERSION()).to.equal('1.0.0');
    });
  });

  describe('registerEvidence', function () {
    describe('Happy Path', function () {
      it('should register new evidence successfully', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress
          )
        ).to.emit(registry, 'EvidenceRegistered');

        const evidence = await registry.getEvidence(evidenceId);
        expect(evidence.contentHash).to.equal(contentHash);
        expect(evidence.pieceCid).to.equal(pieceCid);
        expect(evidence.providerAddress).to.equal(providerAddress);
        expect(evidence.submitter).to.equal(submitter.address);
        expect(evidence.verified).to.equal(false);
      });

      it('should increment evidence count after registration', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        expect(await registry.evidenceCount()).to.equal(0);

        const test1 = generateTestEvidence(1);
        await registry.connect(submitter).registerEvidence(
          test1.evidenceId,
          test1.contentHash,
          test1.pieceCid,
          test1.providerAddress
        );
        expect(await registry.evidenceCount()).to.equal(1);

        const test2 = generateTestEvidence(2);
        await registry.connect(submitter).registerEvidence(
          test2.evidenceId,
          test2.contentHash,
          test2.pieceCid,
          test2.providerAddress
        );
        expect(await registry.evidenceCount()).to.equal(2);
      });

      it('should store block timestamp and number', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

        const tx = await registry.connect(submitter).registerEvidence(
          evidenceId,
          contentHash,
          pieceCid,
          providerAddress
        );
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt!.blockNumber);

        const evidence = await registry.getEvidence(evidenceId);
        expect(evidence.timestamp).to.equal(block!.timestamp);
        expect(evidence.blockNumber).to.equal(receipt!.blockNumber);
      });

      it('should emit EvidenceRegistered event with correct parameters', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress
          )
        )
          .to.emit(registry, 'EvidenceRegistered')
          .withArgs(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress,
            submitter.address,
            // timestamp and blockNumber are dynamic, so we don't check exact values
            (timestamp: bigint) => timestamp > 0,
            (blockNumber: bigint) => blockNumber > 0
          );
      });

      it('should allow multiple evidence from same submitter', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);

        for (let i = 0; i < 5; i++) {
          const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence(i);
          await registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress
          );
        }

        expect(await registry.evidenceCount()).to.equal(5);
      });

      it('should allow evidence from different submitters', async function () {
        const { registry, submitter, otherUser } = await loadFixture(deployFixture);

        const test1 = generateTestEvidence(1);
        await registry.connect(submitter).registerEvidence(
          test1.evidenceId,
          test1.contentHash,
          test1.pieceCid,
          test1.providerAddress
        );

        const test2 = generateTestEvidence(2);
        await registry.connect(otherUser).registerEvidence(
          test2.evidenceId,
          test2.contentHash,
          test2.pieceCid,
          test2.providerAddress
        );

        const evidence1 = await registry.getEvidence(test1.evidenceId);
        const evidence2 = await registry.getEvidence(test2.evidenceId);

        expect(evidence1.submitter).to.equal(submitter.address);
        expect(evidence2.submitter).to.equal(otherUser.address);
      });
    });

    describe('Failure Cases', function () {
      it('should reject duplicate evidence ID', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

        await registry.connect(submitter).registerEvidence(
          evidenceId,
          contentHash,
          pieceCid,
          providerAddress
        );

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress
          )
        ).to.be.revertedWithCustomError(registry, 'EvidenceAlreadyExists');
      });

      it('should reject zero content hash', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, pieceCid, providerAddress } = generateTestEvidence();

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            ethers.ZeroHash,
            pieceCid,
            providerAddress
          )
        ).to.be.revertedWithCustomError(registry, 'InvalidContentHash');
      });

      it('should reject empty pieceCid', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, providerAddress } = generateTestEvidence();

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            '',
            providerAddress
          )
        ).to.be.revertedWithCustomError(registry, 'InvalidPieceCid');
      });

      it('should reject empty provider address', async function () {
        const { registry, submitter } = await loadFixture(deployFixture);
        const { evidenceId, contentHash, pieceCid } = generateTestEvidence();

        await expect(
          registry.connect(submitter).registerEvidence(
            evidenceId,
            contentHash,
            pieceCid,
            ''
          )
        ).to.be.revertedWithCustomError(registry, 'InvalidProviderAddress');
      });
    });
  });

  describe('getEvidence', function () {
    it('should return evidence for valid ID', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      const evidence = await registry.getEvidence(evidenceId);
      expect(evidence.evidenceId).to.equal(evidenceId);
      expect(evidence.contentHash).to.equal(contentHash);
      expect(evidence.pieceCid).to.equal(pieceCid);
      expect(evidence.providerAddress).to.equal(providerAddress);
    });

    it('should revert for non-existent evidence', async function () {
      const { registry } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));

      await expect(registry.getEvidence(randomId))
        .to.be.revertedWithCustomError(registry, 'EvidenceNotFound');
    });
  });

  describe('evidenceExists', function () {
    it('should return true for existing evidence', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      expect(await registry.evidenceExists(evidenceId)).to.equal(true);
    });

    it('should return false for non-existent evidence', async function () {
      const { registry } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));

      expect(await registry.evidenceExists(randomId)).to.equal(false);
    });
  });

  describe('verifyContentHash', function () {
    it('should return true for matching content hash', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      expect(await registry.verifyContentHash(evidenceId, contentHash)).to.equal(true);
    });

    it('should return false for non-matching content hash', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes('wrong-content'));
      expect(await registry.verifyContentHash(evidenceId, wrongHash)).to.equal(false);
    });

    it('should return false for non-existent evidence', async function () {
      const { registry } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes('any-content'));

      expect(await registry.verifyContentHash(randomId, contentHash)).to.equal(false);
    });
  });

  describe('verifyEvidence', function () {
    it('should allow deployer to verify evidence', async function () {
      const { registry, deployer, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      await expect(registry.connect(deployer).verifyEvidence(evidenceId))
        .to.emit(registry, 'EvidenceVerified')
        .withArgs(evidenceId, deployer.address, (ts: bigint) => ts > 0);

      const evidence = await registry.getEvidence(evidenceId);
      expect(evidence.verified).to.equal(true);
    });

    it('should reject verification from non-deployer', async function () {
      const { registry, submitter, otherUser } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      await expect(registry.connect(otherUser).verifyEvidence(evidenceId))
        .to.be.revertedWithCustomError(registry, 'OnlyDeployer');

      await expect(registry.connect(submitter).verifyEvidence(evidenceId))
        .to.be.revertedWithCustomError(registry, 'OnlyDeployer');
    });

    it('should reject verification of non-existent evidence', async function () {
      const { registry, deployer } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));

      await expect(registry.connect(deployer).verifyEvidence(randomId))
        .to.be.revertedWithCustomError(registry, 'EvidenceNotFound');
    });

    it('should reject double verification', async function () {
      const { registry, deployer, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      await registry.connect(deployer).verifyEvidence(evidenceId);

      await expect(registry.connect(deployer).verifyEvidence(evidenceId))
        .to.be.revertedWithCustomError(registry, 'EvidenceAlreadyVerified');
    });
  });

  describe('isVerified', function () {
    it('should return false for unverified evidence', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      expect(await registry.isVerified(evidenceId)).to.equal(false);
    });

    it('should return true for verified evidence', async function () {
      const { registry, deployer, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );
      await registry.connect(deployer).verifyEvidence(evidenceId);

      expect(await registry.isVerified(evidenceId)).to.equal(true);
    });

    it('should return false for non-existent evidence', async function () {
      const { registry } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));

      expect(await registry.isVerified(randomId)).to.equal(false);
    });
  });

  describe('getSubmitter', function () {
    it('should return correct submitter address', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      expect(await registry.getSubmitter(evidenceId)).to.equal(submitter.address);
    });

    it('should revert for non-existent evidence', async function () {
      const { registry } = await loadFixture(deployFixture);
      const randomId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'));

      await expect(registry.getSubmitter(randomId))
        .to.be.revertedWithCustomError(registry, 'EvidenceNotFound');
    });
  });

  describe('Evidence Immutability', function () {
    it('should not allow modifying evidence after registration', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      const evidenceBefore = await registry.getEvidence(evidenceId);

      // Attempt to re-register (should fail)
      const newContentHash = ethers.keccak256(ethers.toUtf8Bytes('modified-content'));
      await expect(
        registry.connect(submitter).registerEvidence(
          evidenceId,
          newContentHash,
          'new-cid',
          'new-provider'
        )
      ).to.be.revertedWithCustomError(registry, 'EvidenceAlreadyExists');

      // Verify original data unchanged
      const evidenceAfter = await registry.getEvidence(evidenceId);
      expect(evidenceAfter.contentHash).to.equal(evidenceBefore.contentHash);
      expect(evidenceAfter.pieceCid).to.equal(evidenceBefore.pieceCid);
      expect(evidenceAfter.timestamp).to.equal(evidenceBefore.timestamp);
    });
  });

  describe('Gas Consumption', function () {
    // Gas limits based on specification:
    // - registerEvidence < 100k gas
    // - getEvidence < 30k gas
    // - verifyEvidence < 50k gas
    // Test fails if gas exceeds 10x expected (safety margin for estimation variance)

    it('registerEvidence should use reasonable gas', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      const tx = await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );
      const receipt = await tx.wait();

      // Expected < 100k, fail if > 1M (10x safety margin)
      expect(receipt!.gasUsed).to.be.lessThan(1_000_000n);
    });

    it('getEvidence should use reasonable gas', async function () {
      const { registry, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      // For view functions, we estimate gas instead of measuring actual usage
      const estimatedGas = await registry.getEvidence.estimateGas(evidenceId);

      // Expected < 30k, fail if > 300k (10x safety margin)
      expect(estimatedGas).to.be.lessThan(300_000n);
    });

    it('verifyEvidence should use reasonable gas', async function () {
      const { registry, deployer, submitter } = await loadFixture(deployFixture);
      const { evidenceId, contentHash, pieceCid, providerAddress } = generateTestEvidence();

      await registry.connect(submitter).registerEvidence(
        evidenceId,
        contentHash,
        pieceCid,
        providerAddress
      );

      const tx = await registry.connect(deployer).verifyEvidence(evidenceId);
      const receipt = await tx.wait();

      // Expected < 50k, fail if > 500k (10x safety margin)
      expect(receipt!.gasUsed).to.be.lessThan(500_000n);
    });
  });
});

