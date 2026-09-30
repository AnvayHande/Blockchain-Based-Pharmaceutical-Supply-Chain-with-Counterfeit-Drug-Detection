import { expect } from "chai";
import hardhat from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
const { ethers } = hardhat;

/**
 * PharmaSupplyChain — comprehensive test suite
 * Covers M10 requirements: all happy paths, invalid paths, edge cases, events.
 */
describe("PharmaSupplyChain", function () {
  let pharmaSupplyChain;
  let admin, manufacturer, manufacturer2, distributor, wholesaler, pharmacy, pharmacy2, customer;
  let ADMIN_ROLE, MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, WHOLESALER_ROLE, PHARMACY_ROLE;

  // Helper: a keccak256 hash that acts as a fake metadata hash
  const FAKE_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-metadata"));
  const FAKE_HASH2 = ethers.keccak256(ethers.toUtf8Bytes("test-metadata-2"));

  const now = () => Math.floor(Date.now() / 1000);
  const futureTs = (days = 30) => now() + days * 24 * 60 * 60;

  beforeEach(async function () {
    [admin, manufacturer, manufacturer2, distributor, wholesaler, pharmacy, pharmacy2, customer] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaSupplyChain");
    pharmaSupplyChain = await Factory.deploy();
    await pharmaSupplyChain.waitForDeployment();

    ADMIN_ROLE        = await pharmaSupplyChain.ADMIN_ROLE();
    MANUFACTURER_ROLE = await pharmaSupplyChain.MANUFACTURER_ROLE();
    DISTRIBUTOR_ROLE  = await pharmaSupplyChain.DISTRIBUTOR_ROLE();
    WHOLESALER_ROLE   = await pharmaSupplyChain.WHOLESALER_ROLE();
    PHARMACY_ROLE     = await pharmaSupplyChain.PHARMACY_ROLE();
  });

  // ─────────────────────────── Deployment ──────────────────────────────
  describe("Deployment", function () {
    it("deployer gets ADMIN_ROLE", async function () {
      expect(await pharmaSupplyChain.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("role constants are correct keccak256 values", async function () {
      expect(MANUFACTURER_ROLE).to.equal(ethers.id("MANUFACTURER_ROLE"));
      expect(DISTRIBUTOR_ROLE ).to.equal(ethers.id("DISTRIBUTOR_ROLE"));
      expect(WHOLESALER_ROLE  ).to.equal(ethers.id("WHOLESALER_ROLE"));
      expect(PHARMACY_ROLE    ).to.equal(ethers.id("PHARMACY_ROLE"));
    });
  });

  // ──────────────────── Participant Registration ────────────────────────
  describe("Participant Registration", function () {
    it("admin can register a manufacturer", async function () {
      await pharmaSupplyChain
        .connect(admin)
        .registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);

      const p = await pharmaSupplyChain.participants(manufacturer.address);
      expect(p.authorized).to.be.true;
      expect(p.organizationName).to.equal("Pharma Inc.");
      expect(await pharmaSupplyChain.hasRole(MANUFACTURER_ROLE, manufacturer.address)).to.be.true;
    });

    it("admin can register distributor, wholesaler, and pharmacy", async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(distributor.address, "Dist Co", DISTRIBUTOR_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(wholesaler.address, "Whole Co", WHOLESALER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy.address, "Pharm Co", PHARMACY_ROLE);

      expect(await pharmaSupplyChain.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.be.true;
      expect(await pharmaSupplyChain.hasRole(WHOLESALER_ROLE,  wholesaler.address)).to.be.true;
      expect(await pharmaSupplyChain.hasRole(PHARMACY_ROLE,    pharmacy.address)).to.be.true;
    });

    it("non-admin cannot register a participant", async function () {
      await expect(
        pharmaSupplyChain
          .connect(manufacturer)
          .registerParticipant(distributor.address, "Dist Co", DISTRIBUTOR_ROLE)
      ).to.be.revertedWithCustomError(pharmaSupplyChain, "AccessControlUnauthorizedAccount");
    });

    it("invalid role is rejected", async function () {
      const badRole = ethers.id("BAD_ROLE");
      await expect(
        pharmaSupplyChain.connect(admin).registerParticipant(customer.address, "Nobody", badRole)
      ).to.be.revertedWith("Invalid role");
    });

    it("duplicate participant is rejected", async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
      await expect(
        pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Other Inc.", MANUFACTURER_ROLE)
      ).to.be.revertedWith("Participant already registered");
    });

    it("emits ParticipantRegistered event", async function () {
      await expect(
        pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE)
      ).to.emit(pharmaSupplyChain, "ParticipantRegistered")
        .withArgs(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
    });
  });

  // ──────────────────── Medicine Registration ────────────────────────────
  describe("Medicine Registration", function () {
    beforeEach(async () => {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
    });

    it("manufacturer can register a medicine", async function () {
      const mfgTs = now();
      const expTs = futureTs(365);

      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH001", "Paracetamol", mfgTs, expTs, 100, FAKE_HASH, ""
        )
      ).to.emit(pharmaSupplyChain, "MedicineRegistered")
        .withArgs("BATCH001", "BATCH001", "Paracetamol", manufacturer.address);

      const m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.medicineName).to.equal("Paracetamol");
      expect(m.quantity).to.equal(100n);
      expect(m.metadataHash).to.equal(FAKE_HASH);
      expect(m.status).to.equal(0); // REGISTERED
      expect(m.currentOwner).to.equal(manufacturer.address);
      expect(m.exists).to.be.true;
    });

    it("non-manufacturer cannot register", async function () {
      await expect(
        pharmaSupplyChain.connect(distributor).registerMedicine(
          "BATCH002", "Ibuprofen", now(), futureTs(), 50, FAKE_HASH, ""
        )
      ).to.be.revertedWithCustomError(pharmaSupplyChain, "AccessControlUnauthorizedAccount");
    });

    it("duplicate batch ID is rejected", async function () {
      const mfgTs = now();
      const expTs = futureTs();
      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001", "Paracetamol", mfgTs, expTs, 100, FAKE_HASH, ""
      );
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH001", "Other", mfgTs, expTs, 50, FAKE_HASH2, ""
        )
      ).to.be.revertedWith("Batch ID already registered");
    });

    it("expiry <= manufacture date is rejected", async function () {
      const mfgTs = now();
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH003", "Drug", mfgTs, mfgTs, 10, FAKE_HASH, ""
        )
      ).to.be.revertedWith("Expiry must be after manufacture date");

      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH003", "Drug", mfgTs, mfgTs - 100, 10, FAKE_HASH, ""
        )
      ).to.be.revertedWith("Expiry must be after manufacture date");
    });

    it("quantity 0 is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH004", "Drug", now(), futureTs(), 0, FAKE_HASH, ""
        )
      ).to.be.revertedWith("Quantity must be > 0");
    });

    it("empty batchId is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "", "Drug", now(), futureTs(), 10, FAKE_HASH, ""
        )
      ).to.be.revertedWith("Batch ID required");
    });

    it("empty medicine name is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).registerMedicine(
          "BATCH005", "", now(), futureTs(), 10, FAKE_HASH, ""
        )
      ).to.be.revertedWith("Medicine name required");
    });

    it("verifyMedicine for unknown ID returns exists==false (never reverts)", async function () {
      const m = await pharmaSupplyChain.verifyMedicine("UNKNOWN-BATCH");
      expect(m.exists).to.be.false;
    });

    it("getBatchSummary for unknown ID returns exists==false", async function () {
      const m = await pharmaSupplyChain.getBatchSummary("UNKNOWN");
      expect(m.exists).to.be.false;
    });
  });

  // ──────────────────── Supply Chain Transfers ──────────────────────────
  describe("Supply Chain Transfers", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(distributor.address, "Dist Co", DISTRIBUTOR_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(wholesaler.address, "Whole Co", WHOLESALER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy.address, "Pharm Co", PHARMACY_ROLE);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001", "Paracetamol", now(), futureTs(365), 100, FAKE_HASH, ""
      );
    });

    it("valid path M→D→P succeeds (skip wholesaler)", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1")
      ).to.emit(pharmaSupplyChain, "MedicineTransferred")
        .withArgs("BATCH001", "BATCH001", manufacturer.address, distributor.address, 2); // AT_DISTRIBUTOR

      let m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.currentOwner).to.equal(distributor.address);
      expect(m.status).to.equal(2); // AT_DISTRIBUTOR

      await expect(
        pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", pharmacy.address, "TX2")
      ).to.emit(pharmaSupplyChain, "MedicineTransferred");

      m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.currentOwner).to.equal(pharmacy.address);
      expect(m.status).to.equal(4); // AT_PHARMACY
    });

    it("valid path M→D→W→P succeeds (with wholesaler)", async function () {
      await pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1");
      await pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", wholesaler.address, "TX2");
      await pharmaSupplyChain.connect(wholesaler).transferMedicine("BATCH001", pharmacy.address, "TX3");

      const m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.currentOwner).to.equal(pharmacy.address);
      expect(m.status).to.equal(4); // AT_PHARMACY
    });

    it("invalid path M→P directly is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", pharmacy.address, "INVALID")
      ).to.be.revertedWith("Invalid supply chain transition");
    });

    it("invalid path M→W directly is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", wholesaler.address, "INVALID")
      ).to.be.revertedWith("Invalid supply chain transition");
    });

    it("D→D same role is rejected", async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer2.address, "Dist2", DISTRIBUTOR_ROLE);
      await pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1");
      await expect(
        pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", manufacturer2.address, "INVALID")
      ).to.be.revertedWith("Invalid supply chain transition");
    });

    it("transfer by non-owner is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", pharmacy.address, "INVALID")
      ).to.be.revertedWith("You are not the current owner");
    });

    it("transfer to unregistered address is rejected", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", customer.address, "INVALID")
      ).to.be.revertedWith("Receiver is not authorized");
    });

    it("transfer blocked after recall", async function () {
      await pharmaSupplyChain.connect(admin).recallMedicine("BATCH001");
      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX")
      ).to.be.revertedWith("Medicine has been recalled");
    });

    it("transfer blocked after sold", async function () {
      await pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1");
      await pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", pharmacy.address, "TX2");
      await pharmaSupplyChain.connect(pharmacy).sellMedicine("BATCH001");

      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy2.address, "Pharm2", PHARMACY_ROLE);
      await expect(
        pharmaSupplyChain.connect(pharmacy).transferMedicine("BATCH001", pharmacy2.address, "INVALID")
      ).to.be.revertedWith("Medicine has been sold");
    });

    it("transfer blocked after expiry", async function () {
      // Register a batch with near-expiry
      const mfgTs = now();
      const expTs = mfgTs + 60; // expires in 60 seconds
      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH-EXP", "Drug", mfgTs, expTs, 10, FAKE_HASH, ""
      );

      // Fast-forward time past expiry
      await time.increase(120);

      await expect(
        pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH-EXP", distributor.address, "TX")
      ).to.be.revertedWith("Medicine is expired");
    });

    it("getTransferHistory returns records in order", async function () {
      await pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1");
      await pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", pharmacy.address, "TX2");

      const history = await pharmaSupplyChain.getTransferHistory("BATCH001");
      expect(history.length).to.equal(2);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[1].from).to.equal(distributor.address);
      expect(history[1].to).to.equal(pharmacy.address);
    });
  });

  // ──────────────────── Sell Medicine ──────────────────────────────────
  describe("sellMedicine", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(distributor.address, "Dist Co", DISTRIBUTOR_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy.address, "Pharm Co", PHARMACY_ROLE);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001", "Paracetamol", now(), futureTs(365), 100, FAKE_HASH, ""
      );
      await pharmaSupplyChain.connect(manufacturer).transferMedicine("BATCH001", distributor.address, "TX1");
      await pharmaSupplyChain.connect(distributor).transferMedicine("BATCH001", pharmacy.address, "TX2");
    });

    it("pharmacy can sell a batch it owns", async function () {
      await expect(pharmaSupplyChain.connect(pharmacy).sellMedicine("BATCH001"))
        .to.emit(pharmaSupplyChain, "MedicineStatusChanged")
        .withArgs("BATCH001", "BATCH001", 5n); // SOLD

      const m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.status).to.equal(5); // SOLD
    });

    it("non-pharmacy role cannot sell", async function () {
      await expect(
        pharmaSupplyChain.connect(distributor).sellMedicine("BATCH001")
      ).to.be.revertedWithCustomError(pharmaSupplyChain, "AccessControlUnauthorizedAccount");
    });

    it("pharmacy cannot sell a batch it does not own", async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(pharmacy2.address, "Pharm2", PHARMACY_ROLE);
      await expect(
        pharmaSupplyChain.connect(pharmacy2).sellMedicine("BATCH001")
      ).to.be.revertedWith("You are not the current owner");
    });
  });

  // ──────────────────── Recall ──────────────────────────────────────────
  describe("Recall", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer2.address, "Other Pharma", MANUFACTURER_ROLE);

      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001", "Paracetamol", now(), futureTs(365), 100, FAKE_HASH, ""
      );
    });

    it("admin can recall any batch", async function () {
      await expect(pharmaSupplyChain.connect(admin).recallMedicine("BATCH001"))
        .to.emit(pharmaSupplyChain, "MedicineRecalled")
        .withArgs("BATCH001", "BATCH001");

      const m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.status).to.equal(6); // RECALLED
    });

    it("the batch manufacturer can recall its own batch", async function () {
      await expect(pharmaSupplyChain.connect(manufacturer).recallMedicine("BATCH001"))
        .to.emit(pharmaSupplyChain, "MedicineRecalled");

      const m = await pharmaSupplyChain.medicines("BATCH001");
      expect(m.status).to.equal(6); // RECALLED
    });

    it("a different manufacturer cannot recall another's batch", async function () {
      await expect(
        pharmaSupplyChain.connect(manufacturer2).recallMedicine("BATCH001")
      ).to.be.revertedWith("Only admin or the batch manufacturer can recall");
    });
  });

  // ──────────────────── isExpired view ─────────────────────────────────
  describe("isExpired", function () {
    beforeEach(async function () {
      await pharmaSupplyChain.connect(admin).registerParticipant(manufacturer.address, "Pharma Inc.", MANUFACTURER_ROLE);
    });

    it("returns false for a fresh batch", async function () {
      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH001", "Drug", now(), futureTs(30), 10, FAKE_HASH, ""
      );
      expect(await pharmaSupplyChain.isExpired("BATCH001")).to.be.false;
    });

    it("returns true after expiry time has passed", async function () {
      const mfgTs = now();
      const expTs = mfgTs + 60;
      await pharmaSupplyChain.connect(manufacturer).registerMedicine(
        "BATCH-EXP", "Drug", mfgTs, expTs, 10, FAKE_HASH, ""
      );
      await time.increase(120);
      expect(await pharmaSupplyChain.isExpired("BATCH-EXP")).to.be.true;
    });

    it("returns false for unknown batch (exists==false)", async function () {
      expect(await pharmaSupplyChain.isExpired("UNKNOWN")).to.be.false;
    });
  });

  // ──────────────────── reportCounterfeit ──────────────────────────────
  describe("reportCounterfeit", function () {
    it("emits CounterfeitReported event", async function () {
      await expect(
        pharmaSupplyChain.connect(customer).reportCounterfeit("BATCH001", "Packaging mismatch")
      ).to.emit(pharmaSupplyChain, "CounterfeitReported")
        .withArgs("BATCH001", "BATCH001", "Packaging mismatch", customer.address);
    });

    it("rejects details longer than 280 chars", async function () {
      const longStr = "x".repeat(281);
      await expect(
        pharmaSupplyChain.connect(customer).reportCounterfeit("BATCH001", longStr)
      ).to.be.revertedWith("Details too long (max 280 chars)");
    });

    it("rejects empty details", async function () {
      await expect(
        pharmaSupplyChain.connect(customer).reportCounterfeit("BATCH001", "")
      ).to.be.revertedWith("Details required");
    });

    it("accepts exactly 280 chars", async function () {
      const maxStr = "x".repeat(280);
      await expect(
        pharmaSupplyChain.connect(customer).reportCounterfeit("BATCH001", maxStr)
      ).to.emit(pharmaSupplyChain, "CounterfeitReported");
    });
  });
});
