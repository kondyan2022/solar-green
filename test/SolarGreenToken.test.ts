import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { SolarGreenToken } from "../typechain-types";

describe("Solar Green Token", function () {
  const initialMint = 100000000n;

  async function deploy() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    const SampleFactory = await ethers.getContractFactory("SolarGreenToken");
    const token: SolarGreenToken = await SampleFactory.deploy(initialMint);
    await token.waitForDeployment();

    return { token, deployer, user1, user2, user3 };
  }

  it("token should be created", async function () {
    const { token, deployer } = await loadFixture(deploy);

    expect(await token.totalSupply()).to.eq(
      await token.withDecimals(initialMint)
    );
    expect(await token.getAddress()).to.be.properAddress;
    expect(await token.name()).to.be.eq("Solar Green");
    expect(await token.symbol()).to.be.eq("SGR");

    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    const BLACKLISTER_ROLE = await token.BLACKLISTER_ROLE();
    expect(await token.hasRole(DEFAULT_ADMIN_ROLE, deployer)).to.be.true;
    expect(await token.hasRole(BLACKLISTER_ROLE, deployer)).to.be.true;
  });

  it("tokens should be minted", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);

    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();
    const tx1 = await token.mint(deployer, amount);
    tx1.wait();
    await expect(tx1).to.changeTokenBalance(token, deployer, amount);

    const tx2 = await token.mint(user1, amount);
    tx2.wait();

    expect(await token.balanceOf(user1)).to.eq(amount);
    expect(await token.totalSupply()).to.eq(initialSupply + amount + amount);
  });

  it("tokens should be minted only with DEFAULT_ADMIN_ROLE", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);

    const amount = await token.withDecimals(10);
    const tx = await token.grantBlackListerRole(user1);
    await tx.wait();

    await expect(
      token.connect(user1).mint(deployer, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user1).mint(user1, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user1).mint(user2, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user2).mint(deployer, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user2).mint(user1, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user2).mint(user2, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("token should be burned", async function () {
    const { token, deployer } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const tx = await token.burn(amount);
    await tx.wait();
    await expect(tx).to.changeTokenBalance(token, deployer, -amount);
  });

  //   it("token should be transferred", async function () {
  //     const { token, deployer, user1 } = await loadFixture(deploy);
  //     const decimals = await token.decimals();
  //     const amount = BigInt(10);
  //     const tx = await token.transfer(user1, amount);
  //     await tx.wait();
  //     const user1Balance = await token.balanceOf(user1);
  //     const deployerBalance = await token.balanceOf(deployer);
  //     expect(user1Balance).to.eq(amount);
  //     expect(deployerBalance).to.eq(
  //       (await token.withDecimals(initialMint)) - amount
  //     );
  //   });

  //   it("should be to call transferFrom func", async function () {
  //     const { token, deployer, user1, user2 } = await loadFixture(deploy);
  //     const decimals = Number(await token.decimals());
  //     const totalAmount = 10;
  //     const transferAmount = 8;
  //     const txApprove = await token.approve(user1, totalAmount);
  //     txApprove.wait();

  //     const txTransfer = await token
  //       .connect(user1)
  //       .transferFrom(deployer, user2, transferAmount);
  //     txTransfer.wait();

  //     expect(await token.allowance(deployer, user1)).to.eq(
  //       totalAmount - transferAmount
  //     );
  //     expect(await token.balanceOf(user2)).to.eq(transferAmount);
  //   });

  //   it("tokens should be minted", async function () {
  //     const { token, deployer, user1, user2 } = await loadFixture(deploy);

  //     const amount = await token.withDecimals(10);
  //     const initialSupply = await token.totalSupply();
  //     const tx = await token.mint(user2, amount);
  //     tx.wait();

  //     expect(await token.balanceOf(user2)).to.eq(amount);
  //     expect(await token.totalSupply()).to.eq(BigInt(initialSupply) + amount);
  //   });

  //   it("tokens should be burned", async function () {
  //     const { token, deployer, user1, user2 } = await loadFixture(deploy);
  //     const amount = await token.withDecimals(10);
  //     const initialSupply = await token.totalSupply();
  //     const tx = await token.burn(amount);
  //     tx.wait();

  //     expect(await token.balanceOf(deployer)).to.eq(initialSupply - amount);
  //     expect(await token.totalSupply()).to.eq(initialSupply - amount);
  //   });
});
