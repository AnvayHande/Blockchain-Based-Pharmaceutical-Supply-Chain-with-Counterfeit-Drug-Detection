import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("PharmaSupplyChain", function () {
  let PharmaSupplyChain;
  let pharmaSupplyChain;
  let admin;
  let manufacturer;
  let distributor;
  let wholesaler;
  let pharmacy;
  let customer;

  let ADMIN_ROLE, MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, WHOLESALER_ROLE, PHARMACY_ROLE;

  beforeEach(async function () {
    [admin, manufacturer, distributor, wholesaler, pharmacy, customer] = await ethers.getSigners();

    PharmaSupplyChain = await ethers.getContractFactory("PharmaSupplyChain");
    pharmaSupplyChain = await PharmaSupplyChain.deploy();
    await pharmaSupplyChain.waitForDeployment();

    ADMIN_ROLE = await pharmaSupplyChain.ADMIN_ROLE();
    MANUFACTURER_ROLE = await pharmaSupplyChain.MANUFACTURER_ROLE();
    DISTRIBUTOR_ROLE = await pharmaSupplyChain.DISTRIBUTOR_ROLE();
    WHOLESALER_ROLE = await pharmaSupplyChain.WHOLESALER_ROLE();
    PHARMACY_ROLE = await pharmaSupplyChain.PHARMACY_ROLE();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await pharmaSupplyChain.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Participant Registration", function () {
    it("Should allow admin to register participants", async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Manufacturer Inc.", MANUFACTURER_ROLE);
      
      const participant = await pharmaSupplyChain.participants(manufacturer.address);
      expect(participant.authorized).to.be.true;
      expect(participant.organizationName).to.equal("Manufacturer Inc.");
      expect(await pharmaSupplyChain.hasRole(MANUFACTURER_ROLE, manufacturer.address)).to.be.true;
    });

    it("Should fail if non-admin tries to register participant", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerParticipant(distributor.address, "Distributor Inc.", DISTRIBUTOR_ROLE)
      ).to.be.revertedWithCustomError(pharmaSupplyChain, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Medicine Registration and Transfer", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Manufacturer Inc.", MANUFACTURER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(distributor.address, "Distributor Inc.", DISTRIBUTOR_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(wholesaler.address, "Wholesaler Inc.", WHOLESALER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy.address, "Pharmacy Inc.", PHARMACY_ROLE);
    });

    it("Should allow manufacturer to register a medicine", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (30 * 24 * 60 * 60); // 30 days from now

      await expect(pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001",
        "Paracetamol",
        now,
        expiry,
        "QmTestHash"
      )).to.emit(pharmaSupplyChain, "MedicineRegistered").withArgs("BATCH001", "Paracetamol", manufacturer.address);

      const medicine = await pharmaSupplyChain.medicines("BATCH001");
      expect(medicine.medicineName).to.equal("Paracetamol");
      expect(medicine.status).to.equal(0); // REGISTERED
      expect(medicine.currentOwner).to.equal(manufacturer.address);
    });

    it("Should fail if non-manufacturer tries to register", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (30 * 24 * 60 * 60);

      await expect(
        pharmaSupplyChain.connect(distributor).registerMedicine("BATCH002", "Ibuprofen", now, expiry, "QmTestHash")
      ).to.be.revertedWithCustomError(pharmaSupplyChain, "AccessControlUnauthorizedAccount");
    });

    it("Should allow supply chain transfers", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (30 * 24 * 60 * 60);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine("BATCH001", "Paracetamol", now, expiry, "QmTestHash");

      // Transfer to Distributor
      await expect(pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1"))
        .to.emit(pharmaSupplyChain, "MedicineTransferred")
        .withArgs("BATCH001", manufacturer.address, distributor.address, 2); // AT_DISTRIBUTOR (2)
      
      let medicine = await pharmaSupplyChain.medicines("BATCH001");
      expect(medicine.currentOwner).to.equal(distributor.address);

      // Transfer to Wholesaler
      await expect(pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", wholesaler.address, "TX2"))
        .to.emit(pharmaSupplyChain, "MedicineTransferred");

      // Transfer to Pharmacy
      await expect(pharmaSupplyChain.connect(wholesaler).transferMedicine("BATCH001", pharmacy.address, "TX3"))
        .to.emit(pharmaSupplyChain, "MedicineTransferred");

      medicine = await pharmaSupplyChain.medicines("BATCH001");
      expect(medicine.currentOwner).to.equal(pharmacy.address);
      expect(medicine.status).to.equal(4); // AT_PHARMACY
    });

    it("Should fail invalid transfer path", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (30 * 24 * 60 * 60);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine("BATCH001", "Paracetamol", now, expiry, "QmTestHash");

      // Direct transfer from manufacturer to pharmacy should fail
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", pharmacy.address, "TX_INVALID")
      ).to.be.revertedWith("Invalid supply chain transition");
    });
  });

  describe("Recall and Verification", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Manufacturer Inc.", MANUFACTURER_ROLE);
    });

    it("Should allow admin to recall", async function () {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + (30 * 24 * 60 * 60);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine("BATCH001", "Paracetamol", now, expiry, "QmTestHash");
      
      await expect(pharmaSupplyChain.connect(admin).recallMedicine("BATCH001"))
        .to.emit(pharmaSupplyChain, "MedicineRecalled")
        .withArgs("BATCH001");

      const medicine = await pharmaSupplyChain.medicines("BATCH001");
      expect(medicine.status).to.equal(6); // RECALLED
    });
  });
});
