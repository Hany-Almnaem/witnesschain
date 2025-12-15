// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEvidenceRegistry
 * @author WitnessChain
 * @notice Interface for the EvidenceRegistry contract
 */
interface IEvidenceRegistry {
    /**
     * @notice Evidence record structure
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

    /**
     * @notice Register new evidence with immutable timestamp
     * @param evidenceId Unique identifier for the evidence
     * @param contentHash SHA-256 hash of the original content
     * @param pieceCid Filecoin PieceCID
     * @param providerAddress Storage Provider address
     */
    function registerEvidence(
        bytes32 evidenceId,
        bytes32 contentHash,
        string calldata pieceCid,
        string calldata providerAddress
    ) external;

    /**
     * @notice Retrieve evidence record by ID
     * @param evidenceId The unique evidence identifier
     * @return The complete Evidence struct
     */
    function getEvidence(bytes32 evidenceId) external view returns (Evidence memory);

    /**
     * @notice Check if evidence exists
     * @param evidenceId The unique evidence identifier
     * @return True if evidence is registered
     */
    function evidenceExists(bytes32 evidenceId) external view returns (bool);

    /**
     * @notice Verify evidence content hash matches
     * @param evidenceId The unique evidence identifier
     * @param contentHash The content hash to verify against
     * @return True if evidence exists and content hash matches
     */
    function verifyContentHash(bytes32 evidenceId, bytes32 contentHash) external view returns (bool);

    /**
     * @notice Mark evidence as verified (admin only)
     * @param evidenceId The unique evidence identifier
     */
    function verifyEvidence(bytes32 evidenceId) external;

    /**
     * @notice Get the submitter address for evidence
     * @param evidenceId The unique evidence identifier
     * @return The address that submitted the evidence
     */
    function getSubmitter(bytes32 evidenceId) external view returns (address);

    /**
     * @notice Check if evidence is verified
     * @param evidenceId The unique evidence identifier
     * @return True if evidence exists and is verified
     */
    function isVerified(bytes32 evidenceId) external view returns (bool);

    /**
     * @notice Get total count of registered evidence
     */
    function evidenceCount() external view returns (uint256);

    /**
     * @notice Get contract version
     */
    function VERSION() external view returns (string memory);

    /**
     * @notice Get deployer address
     */
    function deployer() external view returns (address);
}

