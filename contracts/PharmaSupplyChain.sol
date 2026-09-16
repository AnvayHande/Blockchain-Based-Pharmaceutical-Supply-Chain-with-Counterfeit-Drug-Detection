// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract PharmaSupplyChain is AccessControl {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant WHOLESALER_ROLE = keccak256("WHOLESALER_ROLE");
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    // Status Enums
    enum MedicineStatus {
        REGISTERED,
        IN_TRANSIT,
        AT_DISTRIBUTOR,
        AT_WHOLESALER,
        AT_PHARMACY,
        SOLD,
        RECALLED,
        EXPIRED
    }

    // Participant Structure
    struct Participant {
        address walletAddress;
        string organizationName;
        bytes32 role;
        bool authorized;
    }

    // Medicine Structure
    struct MedicineBatch {
        string batchId;
        string medicineName;
        address manufacturer;
        uint256 manufactureDate;
        uint256 expiryDate;
        address currentOwner;
        MedicineStatus status;
        string documentCID; // IPFS hash for certificates
        bool exists;
    }

    // Transfer Record Structure
    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        MedicineStatus newStatus;
        string transactionRef;
    }

    // Mappings
    mapping(address => Participant) public participants;
    mapping(string => MedicineBatch) public medicines;
    mapping(string => TransferRecord[]) public transferHistory;

    // Events
    event ParticipantRegistered(address indexed wallet, string organizationName, bytes32 role);
    event MedicineRegistered(string indexed batchId, string medicineName, address indexed manufacturer);
    event MedicineTransferred(string indexed batchId, address indexed from, address indexed to, MedicineStatus status);
    event MedicineRecalled(string indexed batchId);
    event CounterfeitReported(string indexed batchId, string details, address indexed reporter);
    event MedicineStatusChanged(string indexed batchId, MedicineStatus status);

    constructor() {
        // Grant deployer the admin role
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // Register a new participant (Admin only)
    function registerParticipant(address _wallet, string memory _organizationName, bytes32 _role) external onlyRole(ADMIN_ROLE) {
        require(!participants[_wallet].authorized, "Participant already registered");
        require(
            _role == MANUFACTURER_ROLE ||
            _role == DISTRIBUTOR_ROLE ||
            _role == WHOLESALER_ROLE ||
            _role == PHARMACY_ROLE,
            "Invalid role"
        );

        participants[_wallet] = Participant({
            walletAddress: _wallet,
            organizationName: _organizationName,
            role: _role,
            authorized: true
        });

        _grantRole(_role, _wallet);
        
        emit ParticipantRegistered(_wallet, _organizationName, _role);
    }

    // Medicine Registration (Manufacturer only)
    function registerMedicine(
        string memory _batchId,
        string memory _medicineName,
        uint256 _manufactureDate,
        uint256 _expiryDate,
        string memory _documentCID
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(!medicines[_batchId].exists, "Medicine batch already exists");
        require(_expiryDate > _manufactureDate, "Expiry date must be after manufacture date");

        medicines[_batchId] = MedicineBatch({
            batchId: _batchId,
            medicineName: _medicineName,
            manufacturer: msg.sender,
            manufactureDate: _manufactureDate,
            expiryDate: _expiryDate,
            currentOwner: msg.sender,
            status: MedicineStatus.REGISTERED,
            documentCID: _documentCID,
            exists: true
        });

        emit MedicineRegistered(_batchId, _medicineName, msg.sender);
    }

    // Internal function to validate role transition
    function _isValidTransfer(bytes32 currentRole, bytes32 nextRole) internal pure returns (bool) {
        if (currentRole == MANUFACTURER_ROLE) return nextRole == DISTRIBUTOR_ROLE;
        if (currentRole == DISTRIBUTOR_ROLE) return nextRole == WHOLESALER_ROLE;
        if (currentRole == WHOLESALER_ROLE) return nextRole == PHARMACY_ROLE;
        return false;
    }

    // Get expected status based on the receiver's role
    function _getStatusForRole(bytes32 role) internal pure returns (MedicineStatus) {
        if (role == DISTRIBUTOR_ROLE) return MedicineStatus.AT_DISTRIBUTOR;
        if (role == WHOLESALER_ROLE) return MedicineStatus.AT_WHOLESALER;
        if (role == PHARMACY_ROLE) return MedicineStatus.AT_PHARMACY;
        revert("Invalid role for receiving");
    }

    // Transfer Custody
    function transferMedicine(string memory _batchId, address _to, string memory _transactionRef) external {
        MedicineBatch storage batch = medicines[_batchId];
        require(batch.exists, "Medicine batch does not exist");
        require(batch.currentOwner == msg.sender, "You are not the current owner");
        require(batch.status != MedicineStatus.RECALLED, "Medicine has been recalled");
        require(batch.status != MedicineStatus.SOLD, "Medicine has been sold");
        require(block.timestamp <= batch.expiryDate, "Medicine is expired");
        
        Participant memory sender = participants[msg.sender];
        Participant memory receiver = participants[_to];
        
        require(receiver.authorized, "Receiver is not authorized");
        
        require(_isValidTransfer(sender.role, receiver.role), "Invalid supply chain transition");

        MedicineStatus newStatus = _getStatusForRole(receiver.role);
        
        batch.currentOwner = _to;
        batch.status = newStatus;

        transferHistory[_batchId].push(TransferRecord({
            from: msg.sender,
            to: _to,
            timestamp: block.timestamp,
            newStatus: newStatus,
            transactionRef: _transactionRef
        }));

        emit MedicineTransferred(_batchId, msg.sender, _to, newStatus);
    }

    // Pharmacy sells the medicine to customer
    function sellMedicine(string memory _batchId) external onlyRole(PHARMACY_ROLE) {
        MedicineBatch storage batch = medicines[_batchId];
        require(batch.exists, "Medicine batch does not exist");
        require(batch.currentOwner == msg.sender, "You are not the current owner");
        require(batch.status == MedicineStatus.AT_PHARMACY, "Medicine is not at pharmacy");
        require(batch.status != MedicineStatus.RECALLED, "Medicine has been recalled");
        require(block.timestamp <= batch.expiryDate, "Medicine is expired");

        batch.status = MedicineStatus.SOLD;
        emit MedicineStatusChanged(_batchId, MedicineStatus.SOLD);
    }

    // Recall Medicine (Admin only)
    function recallMedicine(string memory _batchId) external onlyRole(ADMIN_ROLE) {
        require(medicines[_batchId].exists, "Medicine batch does not exist");
        medicines[_batchId].status = MedicineStatus.RECALLED;
        emit MedicineRecalled(_batchId);
    }

    // Report Counterfeit (Public)
    function reportCounterfeit(string memory _batchId, string memory _details) external {
        emit CounterfeitReported(_batchId, _details, msg.sender);
    }

    // Verify Medicine (Public)
    function verifyMedicine(string memory _batchId) external view returns (MedicineBatch memory) {
        return medicines[_batchId];
    }

    // Get Transfer History (Public)
    function getTransferHistory(string memory _batchId) external view returns (TransferRecord[] memory) {
        return transferHistory[_batchId];
    }
}
