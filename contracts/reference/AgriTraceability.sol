// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract AgriTraceability {
    address public owner;

    enum Role { None, Farmer, Transporter, Distributor }
    enum Status { Harvested, InTransit, InWarehouse, Delivered, Recalled }

    struct Batch {
        string batchCode;
        string productName;
        string harvestDate;
        string origin;
        string certification;
        address farmer;
        address currentHolder;
        address pendingHolder;
        Status status;
        string recallReason;
    }

    // History
    struct Record {
        address from;
        address to;
        Status status;
        string note;
        uint timestamp;
    }

    mapping(address => Role) public roles;
    mapping(string => Batch) private batches;
    mapping(string => Record[]) private history;

    event StakeholderRegistered(address indexed user, Role role);
    event BatchRegistered(string batchCode, address indexed farmer);
    event CustodyRequested(string batchCode, address indexed from, address indexed to);
    event CustodyTransferred(string batchCode, address indexed from, address indexed to);
    event StatusUpdated(string batchCode, Status status);
    event BatchRecalled(string batchCode, string reason);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier batchExists(string memory _batchCode) {
        require(bytes(batches[_batchCode].batchCode).length != 0, "Batch not found");
        _;
    }

    // ===== Register =====
    // role: 1 = Farmer, 2 = Transporter, 3 = Distributor
    function registerStakeholder(address _user, Role _role) public onlyOwner {
        require(_user != address(0), "Invalid address");
        require(_role != Role.None, "Invalid role");
        require(roles[_user] == Role.None, "Already registered");

        roles[_user] = _role;

        emit StakeholderRegistered(_user, _role);
    }

    // ===== Register Product  =====
    function registerBatch(
        string memory _batchCode,
        string memory _productName,
        string memory _harvestDate,
        string memory _origin,
        string memory _certification
    ) public {
        require(roles[msg.sender] == Role.Farmer, "Only farmer");
        require(bytes(_batchCode).length > 0, "Batch code required");
        require(bytes(_productName).length > 0, "Product name required");
        require(bytes(batches[_batchCode].batchCode).length == 0, "Batch already exists");

        Batch storage b = batches[_batchCode];
        b.batchCode = _batchCode;
        b.productName = _productName;
        b.harvestDate = _harvestDate;
        b.origin = _origin;
        b.certification = _certification;
        b.farmer = msg.sender;
        b.currentHolder = msg.sender;
        b.status = Status.Harvested;

        addHistory(_batchCode, address(0), msg.sender, Status.Harvested, "Batch registered");

        emit BatchRegistered(_batchCode, msg.sender);
    }

    // ===== Transfer Ownership/Custody =====
    // ผู้ถือครองปัจจุบันระบุผู้รับ
    function transferCustody(string memory _batchCode, address _to) public batchExists(_batchCode) {
        Batch storage b = batches[_batchCode];

        require(msg.sender == b.currentHolder, "Only current holder");
        require(b.status != Status.Recalled, "Batch recalled");
        require(b.status != Status.Delivered, "Batch already delivered");
        require(_to != msg.sender, "Cannot transfer to yourself");
        require(
            roles[_to] == Role.Transporter || roles[_to] == Role.Distributor,
            "Invalid receiver"
        );

        b.pendingHolder = _to;

        emit CustodyRequested(_batchCode, msg.sender, _to);
    }

    // ผู้รับกดยืนยัน ถึงจะเปลี่ยนผู้ถือครองและบันทึกประวัติ
    function acceptCustody(string memory _batchCode) public batchExists(_batchCode) {
        Batch storage b = batches[_batchCode];

        require(msg.sender == b.pendingHolder, "Not the pending receiver");
        require(b.status != Status.Recalled, "Batch recalled");

        address from = b.currentHolder;
        b.currentHolder = msg.sender;
        b.pendingHolder = address(0);

        addHistory(_batchCode, from, msg.sender, b.status, "Custody transferred");

        emit CustodyTransferred(_batchCode, from, msg.sender);
    }

    // ===== Update Product Status =====
    // status: 0 = Harvested, 1 = InTransit, 2 = InWarehouse, 3 = Delivered, 4 = Recalled
    function updateStatus(
        string memory _batchCode,
        Status _newStatus,
        string memory _note
    ) public batchExists(_batchCode) {
        Batch storage b = batches[_batchCode];

        require(msg.sender == b.currentHolder, "Only current holder");
        require(b.status != Status.Recalled, "Batch recalled");
        require(_newStatus != Status.Recalled, "Use recallBatch");
        require(uint(_newStatus) > uint(b.status), "Invalid status");

        b.status = _newStatus;

        addHistory(_batchCode, msg.sender, msg.sender, _newStatus, _note);

        emit StatusUpdated(_batchCode, _newStatus);
    }

    // ===== Product Recall =====
    function recallBatch(string memory _batchCode, string memory _reason)
        public
        onlyOwner
        batchExists(_batchCode)
    {
        Batch storage b = batches[_batchCode];

        require(b.status != Status.Recalled, "Already recalled");
        require(bytes(_reason).length > 0, "Reason required");

        b.status = Status.Recalled;
        b.recallReason = _reason;

        addHistory(_batchCode, msg.sender, b.currentHolder, Status.Recalled, _reason);

        emit BatchRecalled(_batchCode, _reason);
    }

    // ฟังก์ชันช่วยบันทึกประวัติ
    function addHistory(
        string memory _batchCode,
        address _from,
        address _to,
        Status _status,
        string memory _note
    ) internal {
        history[_batchCode].push(Record(_from, _to, _status, _note, block.timestamp));
    }

    function getBatch(string memory _batchCode)
        public
        view
        batchExists(_batchCode)
        returns (Batch memory)
    {
        return batches[_batchCode];
    }

    function traceHistory(string memory _batchCode)
        public
        view
        batchExists(_batchCode)
        returns (Record[] memory)
    {
        return history[_batchCode];
    }

    function getHistoryCount(string memory _batchCode)
        public
        view
        batchExists(_batchCode)
        returns (uint)
    {
        return history[_batchCode].length;
    }
}