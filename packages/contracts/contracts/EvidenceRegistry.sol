// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EvidenceRegistry
 * @author WitnessChain
 * @notice Registry for human rights evidence with immutable timestamps
 * @dev Stores evidence hashes with timestamps on Filecoin VM (FVM).
 *      This contract provides proof-of-existence for evidence stored off-chain.
 *      No file data or encrypted content is stored on-chain.
 */
contract EvidenceRegistry {
    string public constant VERSION = "1.0.0";

    /**
     * @notice Evidence record structure
     * @dev All fields are immutable after registration
     */
    struct Evidence {
        bytes32 evidenceId;
        bytes32 contentHash;
        string pieceCid;
        string providerAddress;
        address submitter;
        uint256 timestamp;
        uint256 blockNumber;
        bool verified;
    }

    /// @notice Contract deployer address (MVP admin for verification)
    address public immutable deployer;

    /// @notice Mapping from evidence ID to evidence record
    mapping(bytes32 => Evidence) private _evidenceRecords;

    /// @notice Total count of registered evidence
    uint256 public evidenceCount;

    /// @notice Emitted when new evidence is registered
    event EvidenceRegistered(
        bytes32 indexed evidenceId,
        bytes32 indexed contentHash,
        string pieceCid,
        string providerAddress,
        address indexed submitter,
        uint256 timestamp,
        uint256 blockNumber
    );

    /// @notice Emitted when evidence is verified by admin
    event EvidenceVerified(
        bytes32 indexed evidenceId,
        address indexed verifier,
        uint256 timestamp
    );

    /// @notice Evidence with this ID already exists
    error EvidenceAlreadyExists(bytes32 evidenceId);

    /// @notice Evidence with this ID does not exist
    error EvidenceNotFound(bytes32 evidenceId);

    /// @notice Evidence has already been verified
    error EvidenceAlreadyVerified(bytes32 evidenceId);

    /// @notice Only the deployer can perform this action
    error OnlyDeployer();

    /// @notice Content hash cannot be zero
    error InvalidContentHash();

    /// @notice PieceCID cannot be empty
    error InvalidPieceCid();

    /// @notice Provider address cannot be empty
    error InvalidProviderAddress();

    constructor() {
        deployer = msg.sender;
    }

    /**
     * @notice Register new evidence with immutable timestamp
     * @param evidenceId Unique identifier for the evidence (typically UUID as bytes32)
     * @param contentHash SHA-256 hash of the original unencrypted content
     * @param pieceCid Filecoin PieceCID where encrypted content is stored
     * @param providerAddress Storage Provider address/ID on Filecoin
     * @dev Reverts if evidence ID already exists or inputs are invalid.
     *      The submitter is recorded as msg.sender.
     */
    function registerEvidence(
        bytes32 evidenceId,
        bytes32 contentHash,
        string calldata pieceCid,
        string calldata providerAddress
    ) external {
        // Validate inputs
        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }
        if (bytes(pieceCid).length == 0) {
            revert InvalidPieceCid();
        }
        if (bytes(providerAddress).length == 0) {
            revert InvalidProviderAddress();
        }

        // Check evidence doesn't already exist
        if (_evidenceRecords[evidenceId].timestamp != 0) {
            revert EvidenceAlreadyExists(evidenceId);
        }

        // Store the evidence record
        _evidenceRecords[evidenceId] = Evidence({
            evidenceId: evidenceId,
            contentHash: contentHash,
            pieceCid: pieceCid,
            providerAddress: providerAddress,
            submitter: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number,
            verified: false
        });

        evidenceCount++;

        emit EvidenceRegistered(
            evidenceId,
            contentHash,
            pieceCid,
            providerAddress,
            msg.sender,
            block.timestamp,
            block.number
        );
    }

    /**
     * @notice Retrieve evidence record by ID
     * @param evidenceId The unique evidence identifier
     * @return The complete Evidence struct
     * @dev Reverts if evidence does not exist
     */
    function getEvidence(bytes32 evidenceId) external view returns (Evidence memory) {
        Evidence storage record = _evidenceRecords[evidenceId];
        
        if (record.timestamp == 0) {
            revert EvidenceNotFound(evidenceId);
        }

        return record;
    }

    /**
     * @notice Check if evidence exists
     * @param evidenceId The unique evidence identifier
     * @return True if evidence is registered
     */
    function evidenceExists(bytes32 evidenceId) external view returns (bool) {
        return _evidenceRecords[evidenceId].timestamp != 0;
    }

    /**
     * @notice Verify evidence content hash matches
     * @param evidenceId The unique evidence identifier
     * @param contentHash The content hash to verify against
     * @return True if evidence exists and content hash matches
     */
    function verifyContentHash(
        bytes32 evidenceId, 
        bytes32 contentHash
    ) external view returns (bool) {
        Evidence storage record = _evidenceRecords[evidenceId];
        return record.timestamp != 0 && record.contentHash == contentHash;
    }

    /**
     * @notice Mark evidence as verified (MVP admin only)
     * @param evidenceId The unique evidence identifier
     * @dev Only the contract deployer can verify evidence.
     *      Cannot verify evidence that doesn't exist or is already verified.
     */
    function verifyEvidence(bytes32 evidenceId) external {
        if (msg.sender != deployer) {
            revert OnlyDeployer();
        }

        Evidence storage record = _evidenceRecords[evidenceId];

        if (record.timestamp == 0) {
            revert EvidenceNotFound(evidenceId);
        }

        if (record.verified) {
            revert EvidenceAlreadyVerified(evidenceId);
        }

        record.verified = true;

        emit EvidenceVerified(evidenceId, msg.sender, block.timestamp);
    }

    /**
     * @notice Get the submitter address for evidence
     * @param evidenceId The unique evidence identifier
     * @return The address that submitted the evidence
     */
    function getSubmitter(bytes32 evidenceId) external view returns (address) {
        Evidence storage record = _evidenceRecords[evidenceId];
        
        if (record.timestamp == 0) {
            revert EvidenceNotFound(evidenceId);
        }

        return record.submitter;
    }

    /**
     * @notice Check if evidence is verified
     * @param evidenceId The unique evidence identifier
     * @return True if evidence exists and is verified
     */
    function isVerified(bytes32 evidenceId) external view returns (bool) {
        Evidence storage record = _evidenceRecords[evidenceId];
        return record.timestamp != 0 && record.verified;
    }
}
