// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PharmaSupplyChain
 * @notice Tracks pharmaceutical batches from manufacturer to pharmacy.
 *         The contract is the SOURCE OF TRUTH for ownership, status, and authenticity.
 *         The backend stores only descriptive metadata; its integrity is proven by
 *         comparing metadataHash (stored here) with a hash recomputed from backend data.
 */
contract PharmaSupplyChain is AccessControl {

    // ─────────────────────────── Roles ───────────────────────────
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant WHOLESALER_ROLE   = keccak256("WHOLESALER_ROLE");
    bytes32 public constant PHARMACY_ROLE     = keccak256("PHARMACY_ROLE");

    // ─────────────────────────── Enums ───────────────────────────
    enum MedicineStatus {
        REGISTERED,    // 0 — freshly created by manufacturer
        IN_TRANSIT,    // 1 — reserved for future use (not set by current code)
        AT_DISTRIBUTOR,// 2
        AT_WHOLESALER, // 3
        AT_PHARMACY,   // 4
        SOLD,          // 5 — sold to end customer
        RECALLED,      // 6 — recalled by admin or manufacturer
        EXPIRED        // 7 — reserved; expiry is checked dynamically, not written on-chain
    }

    // ─────────────────────────── Structs ─────────────────────────
    struct Participant {
        address walletAddress;
        string  organizationName;
        bytes32 role;
        bool    authorized;
    }

    struct MedicineBatch {
        string        batchId;
        string        medicineName;
        address       manufacturer;
        uint256       manufactureDate;
        uint256       expiryDate;
        uint256       quantity;        // number of units/packs (must be > 0)
        bytes32       metadataHash;    // keccak256 of canonical off-chain metadata JSON
        address       currentOwner;
        MedicineStatus status;
        string        documentCID;    // optional certificate/document URL
        bool          exists;
    }

    struct TransferRecord {
        address        from;
        address        to;
        uint256        timestamp;
        MedicineStatus newStatus;
        string         transactionRef;
    }

    // ─────────────────────────── Storage ─────────────────────────
    mapping(address => Participant)      public participants;
    mapping(string  => MedicineBatch)    public medicines;
    mapping(string  => TransferRecord[]) public transferHistory;

    // ─────────────────────────── Events ──────────────────────────
    event ParticipantRegistered(
        address indexed wallet,
        string  organizationName,
        bytes32 role
    );
    // NOTE: string indexed stores keccak256 of the string, so we also emit
    // the plain batchId as a non-indexed parameter for frontend log reads.
    event MedicineRegistered(
        string  indexed batchIdHash,
        string          batchId,
        string          medicineName,
        address indexed manufacturer
    );
    event MedicineTransferred(
        string  indexed batchIdHash,
        string          batchId,
        address indexed from,
        address indexed to,
        MedicineStatus  status
    );
    event MedicineRecalled(
        string  indexed batchIdHash,
        string          batchId
    );
    event CounterfeitReported(
        string  indexed batchIdHash,
        string          batchId,
        string          details,
        address indexed reporter
    );
    event MedicineStatusChanged(
        string  indexed batchIdHash,
        string          batchId,
        MedicineStatus  status
    );

    // ─────────────────────── Constructor ─────────────────────────
    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ──────────────────── Participant Management ──────────────────

    /**
     * @notice Register a supply-chain participant. Admin only.
     * @param _wallet           Wallet address of the participant.
     * @param _organizationName Human-readable organization name.
     * @param _role             bytes32 role hash (use MANUFACTURER_ROLE etc.).
     */
    function registerParticipant(
        address _wallet,
        string  memory _organizationName,
        bytes32 _role
    ) external onlyRole(ADMIN_ROLE) {
        require(!participants[_wallet].authorized, "Participant already registered");
        require(
            _role == MANUFACTURER_ROLE ||
            _role == DISTRIBUTOR_ROLE  ||
            _role == WHOLESALER_ROLE   ||
            _role == PHARMACY_ROLE,
            "Invalid role"
        );

        participants[_wallet] = Participant({
            walletAddress:    _wallet,
            organizationName: _organizationName,
            role:             _role,
            authorized:       true
        });

        _grantRole(_role, _wallet);
        emit ParticipantRegistered(_wallet, _organizationName, _role);
    }

    // ──────────────────── Medicine Registration ───────────────────

    /**
     * @notice Register a new medicine batch. Manufacturer only.
     * @param _batchId          Unique batch identifier (e.g. PHM-CIP-PAR-20260929-001).
     * @param _medicineName     Medicine name (non-empty).
     * @param _manufactureDate  Unix timestamp of manufacture date.
     * @param _expiryDate       Unix timestamp of expiry date (must be > _manufactureDate).
     * @param _quantity         Number of units/packs in the batch (must be > 0).
     * @param _metadataHash     keccak256 of canonical off-chain metadata JSON.
     * @param _documentCID      Optional certificate/document URL (may be empty).
     */
    function registerMedicine(
        string  memory _batchId,
        string  memory _medicineName,
        uint256 _manufactureDate,
        uint256 _expiryDate,
        uint256 _quantity,
        bytes32 _metadataHash,
        string  memory _documentCID
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(bytes(_batchId).length > 0,        "Batch ID required");
        require(bytes(_medicineName).length > 0,   "Medicine name required");
        require(_quantity > 0,                     "Quantity must be > 0");
        require(_expiryDate > _manufactureDate,    "Expiry must be after manufacture date");
        require(!medicines[_batchId].exists,       "Batch ID already registered");

        medicines[_batchId] = MedicineBatch({
            batchId:         _batchId,
            medicineName:    _medicineName,
            manufacturer:    msg.sender,
            manufactureDate: _manufactureDate,
            expiryDate:      _expiryDate,
            quantity:        _quantity,
            metadataHash:    _metadataHash,
            currentOwner:    msg.sender,
            status:          MedicineStatus.REGISTERED,
            documentCID:     _documentCID,
            exists:          true
        });

        emit MedicineRegistered(_batchId, _batchId, _medicineName, msg.sender);
    }

    // ──────────────────── Transfer Helpers ───────────────────────

    /**
     * @dev Valid supply-chain transitions:
     *   Manufacturer  → Distributor
     *   Distributor   → Wholesaler | Pharmacy   (wholesaler step is optional)
     *   Wholesaler    → Pharmacy
     */
    function _isValidTransfer(bytes32 currentRole, bytes32 nextRole) internal pure returns (bool) {
        if (currentRole == MANUFACTURER_ROLE) return nextRole == DISTRIBUTOR_ROLE;
        if (currentRole == DISTRIBUTOR_ROLE)  return nextRole == WHOLESALER_ROLE || nextRole == PHARMACY_ROLE;
        if (currentRole == WHOLESALER_ROLE)   return nextRole == PHARMACY_ROLE;
        return false;
    }

    function _getStatusForRole(bytes32 role) internal pure returns (MedicineStatus) {
        if (role == DISTRIBUTOR_ROLE) return MedicineStatus.AT_DISTRIBUTOR;
        if (role == WHOLESALER_ROLE)  return MedicineStatus.AT_WHOLESALER;
        if (role == PHARMACY_ROLE)    return MedicineStatus.AT_PHARMACY;
        revert("Invalid role for receiving");
    }

    // ──────────────────── Transfer Custody ───────────────────────

    /**
     * @notice Transfer custody of a medicine batch to the next actor in the supply chain.
     */
    function transferMedicine(
        string  memory _batchId,
        address _to,
        string  memory _transactionRef
    ) external {
        MedicineBatch storage batch = medicines[_batchId];
        require(batch.exists,                                "Medicine batch does not exist");
        require(batch.currentOwner == msg.sender,           "You are not the current owner");
        require(batch.status != MedicineStatus.RECALLED,    "Medicine has been recalled");
        require(batch.status != MedicineStatus.SOLD,        "Medicine has been sold");
        require(block.timestamp <= batch.expiryDate,        "Medicine is expired");

        Participant memory sender   = participants[msg.sender];
        Participant memory receiver = participants[_to];

        require(receiver.authorized,                        "Receiver is not authorized");
        require(
            _isValidTransfer(sender.role, receiver.role),
            "Invalid supply chain transition"
        );

        MedicineStatus newStatus = _getStatusForRole(receiver.role);

        batch.currentOwner = _to;
        batch.status       = newStatus;

        transferHistory[_batchId].push(TransferRecord({
            from:           msg.sender,
            to:             _to,
            timestamp:      block.timestamp,
            newStatus:      newStatus,
            transactionRef: _transactionRef
        }));

        emit MedicineTransferred(_batchId, _batchId, msg.sender, _to, newStatus);
    }

    // ──────────────────── Sell to Customer ───────────────────────

    /**
     * @notice Mark a batch as sold to the end customer. Pharmacy only.
     *         After this call the batch cannot be transferred.
     */
    function sellMedicine(string memory _batchId) external onlyRole(PHARMACY_ROLE) {
        MedicineBatch storage batch = medicines[_batchId];
        require(batch.exists,                                      "Medicine batch does not exist");
        require(batch.currentOwner == msg.sender,                  "You are not the current owner");
        require(batch.status == MedicineStatus.AT_PHARMACY,        "Medicine is not at pharmacy");
        require(batch.status != MedicineStatus.RECALLED,           "Medicine has been recalled");
        require(block.timestamp <= batch.expiryDate,               "Medicine is expired");

        batch.status = MedicineStatus.SOLD;
        emit MedicineStatusChanged(_batchId, _batchId, MedicineStatus.SOLD);
    }

    // ──────────────────── Recall ─────────────────────────────────

    /**
     * @notice Recall a medicine batch. Admin OR the batch's own manufacturer can recall.
     */
    function recallMedicine(string memory _batchId) external {
        MedicineBatch storage batch = medicines[_batchId];
        require(batch.exists, "Medicine batch does not exist");
        require(
            hasRole(ADMIN_ROLE, msg.sender) || batch.manufacturer == msg.sender,
            "Only admin or the batch manufacturer can recall"
        );
        batch.status = MedicineStatus.RECALLED;
        emit MedicineRecalled(_batchId, _batchId);
    }

    // ──────────────────── Counterfeit Report ─────────────────────

    /**
     * @notice Report a suspected counterfeit batch on-chain.
     *         _details is limited to 280 characters to prevent spam.
     */
    function reportCounterfeit(
        string memory _batchId,
        string memory _details
    ) external {
        require(bytes(_details).length > 0,   "Details required");
        require(bytes(_details).length <= 280, "Details too long (max 280 chars)");
        emit CounterfeitReported(_batchId, _batchId, _details, msg.sender);
    }

    // ──────────────────── Views ───────────────────────────────────

    /**
     * @notice Verify a medicine batch.
     *         Returns the struct; if batchId is unknown, exists == false (never reverts).
     */
    function verifyMedicine(string memory _batchId)
        external view returns (MedicineBatch memory)
    {
        return medicines[_batchId];
    }

    /**
     * @notice Alias for verifyMedicine — returns the full struct, exists==false for unknown IDs.
     */
    function getBatchSummary(string memory _batchId)
        external view returns (MedicineBatch memory)
    {
        return medicines[_batchId];
    }

    /**
     * @notice Returns true if the batch exists and block.timestamp > expiryDate.
     *         Does NOT write EXPIRED status on-chain.
     */
    function isExpired(string memory _batchId) external view returns (bool) {
        MedicineBatch storage batch = medicines[_batchId];
        if (!batch.exists) return false;
        return block.timestamp > batch.expiryDate;
    }

    /**
     * @notice Get the full transfer history for a batch.
     */
    function getTransferHistory(string memory _batchId)
        external view returns (TransferRecord[] memory)
    {
        return transferHistory[_batchId];
    }
}
