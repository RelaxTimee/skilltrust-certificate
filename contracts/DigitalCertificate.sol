// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract DigitalCertificate {
    address public owner;
    mapping(address => bool) public issuers; 

    struct Course {
        string courseCode;
        string courseName;
        string description;
    }

    struct Certificate {
        string certId;
        string courseCode;
        address recipient;
        bytes32 certHash;
        uint issuedAt;
        address issuer;
        bool revoked;
        string revokeReason;
    }

    mapping(string => Course) private courses;
    mapping(string => Certificate) private certificates;
    mapping(address => string[]) private certsOf;

    event IssuerUpdated(address indexed issuer, bool allowed);
    event CourseCreated(string courseCode);
    event CertificateIssued(string certId, address indexed recipient, bytes32 certHash);
    event CertificateRevoked(string certId, string reason);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyIssuer() {
        require(msg.sender == owner || issuers[msg.sender], "Only issuer");
        _;
    }

    // ===== Admin =====
    function setIssuer(address _issuer, bool _allowed) public onlyOwner {
        require(_issuer != address(0), "Invalid address");
        issuers[_issuer] = _allowed;

        emit IssuerUpdated(_issuer, _allowed);
    }

    // ===== Create Training Course =====
    function createCourse(
        string memory _courseCode,
        string memory _courseName,
        string memory _description
    ) public onlyOwner {
        require(bytes(_courseCode).length > 0, "Course code required");
        require(bytes(courses[_courseCode].courseCode).length == 0, "Course already exists");

        courses[_courseCode] = Course(_courseCode, _courseName, _description);

        emit CourseCreated(_courseCode);
    }

    function issueCertificate(
        string memory _certId,
        string memory _courseCode,
        address _recipient,
        bytes32 _certHash
    ) public onlyIssuer {
        require(bytes(_certId).length > 0, "Certificate ID required");
        require(bytes(certificates[_certId].certId).length == 0, "Certificate ID already exists");
        require(bytes(courses[_courseCode].courseCode).length != 0, "Course not found");
        require(_recipient != address(0), "Invalid recipient");
        require(_certHash != bytes32(0), "Hash required");

        Certificate storage c = certificates[_certId];
        c.certId = _certId;
        c.courseCode = _courseCode;
        c.recipient = _recipient;
        c.certHash = _certHash;
        c.issuedAt = block.timestamp;
        c.issuer = msg.sender;

        certsOf[_recipient].push(_certId);

        emit CertificateIssued(_certId, _recipient, _certHash);
    }

    function revokeCertificate(string memory _certId, string memory _reason) public onlyOwner {
        Certificate storage c = certificates[_certId];

        require(bytes(c.certId).length != 0, "Certificate not found");
        require(!c.revoked, "Already revoked");
        require(bytes(_reason).length > 0, "Reason required");

        c.revoked = true;
        c.revokeReason = _reason;

        emit CertificateRevoked(_certId, _reason);
    }

    function verifyCertificate(string memory _certId)
        public
        view
        returns (bool isValid, address recipient, string memory courseCode, uint issuedAt, bool revoked)
    {
        Certificate storage c = certificates[_certId];

        if (bytes(c.certId).length == 0) {
            return (false, address(0), "", 0, false);
        }

        return (!c.revoked, c.recipient, c.courseCode, c.issuedAt, c.revoked);
    }

    function checkHash(string memory _certId, bytes32 _certHash) public view returns (bool) {
        Certificate storage c = certificates[_certId];
        return bytes(c.certId).length != 0 && c.certHash == _certHash;
    }

    function getCertificate(string memory _certId) public view returns (Certificate memory) {
        Certificate memory c = certificates[_certId];
        require(bytes(c.certId).length != 0, "Certificate not found");
        return c;
    }

    function getCourse(string memory _courseCode) public view returns (Course memory) {
        Course memory c = courses[_courseCode];
        require(bytes(c.courseCode).length != 0, "Course not found");
        return c;
    }

    // ===== Certificate Dashboard =====
    function getCertificatesOf(address _user) public view returns (string[] memory) {
        return certsOf[_user];
    }
}