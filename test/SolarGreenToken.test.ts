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

  it("token contract should be created", async function () {
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

  it("tokens should be burned", async function () {
    const { token, deployer } = await loadFixture(deploy);
    const initialSupply = await token.totalSupply();
    const amount = await token.withDecimals(10);
    const tx1 = await token.burn(amount);
    await tx1.wait();
    await expect(tx1).to.changeTokenBalance(token, deployer, -amount);
    expect(await token.totalSupply()).to.eq(initialSupply - amount);
  });

  it("tokens should be transferred", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);
    const tx = await token.grantBlackListerRole(user1);
    await tx.wait();
    const amount = await token.withDecimals(10);
    const tx1 = await token.transfer(user1, amount);
    await tx1.wait();
    await expect(tx1).to.changeTokenBalances(
      token,
      [deployer, user1],
      [-amount, amount]
    );

    const tx2 = await token.connect(user1).transfer(user2, amount / 2n);
    await tx2.wait();
    await expect(tx2).to.changeTokenBalances(
      token,
      [user1, user2],
      [-amount / 2n, amount / 2n]
    );
    const tx3 = await token.connect(user2).transfer(deployer, amount / 2n);
    await tx3.wait();
    await expect(tx3).to.changeTokenBalances(
      token,
      [user2, deployer],
      [-amount / 2n, amount / 2n]
    );
  });

  it("tokens should be burned only with DEFAULT_ADMIN_ROLE", async function () {
    const { token, user1, user2 } = await loadFixture(deploy);

    const tx = await token.grantBlackListerRole(user1);
    await tx.wait();

    const amount = await token.withDecimals(10);
    const tx1 = await token.transfer(user1, amount);
    await tx1.wait();
    const tx2 = await token.transfer(user1, amount);
    await tx2.wait();
    await expect(
      token.connect(user1).burn(amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user2).burn(amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("tokens should be burned from address(it needs approve by address owner)", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();
    const tx = await token.transfer(user1, amount);
    await tx.wait();

    await expect(token.burnFrom(user1, amount)).to.be.revertedWithCustomError(
      token,
      "ERC20InsufficientAllowance"
    );

    const txApprove = await token.connect(user1).approve(deployer, amount);
    await txApprove.wait();

    const txBurn = await token.burnFrom(user1, amount);
    await txBurn.wait();
    await expect(txBurn).to.changeTokenBalance(token, user1, -amount);
    expect(await token.totalSupply()).to.eq(initialSupply - amount);
  });

  it("tokens should be burned from address only with DEFAULT_ADMIN_ROLE", async function () {
    const { token, user1, user2 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();
    await (await token.grantBlackListerRole(user1)).wait();

    await (await token.transfer(user1, amount)).wait();
    await (await token.transfer(user2, amount)).wait();
    await (await token.connect(user1).approve(user2, amount)).wait();
    await (await token.connect(user2).approve(user2, amount)).wait();
    await expect(
      token.connect(user2).burnFrom(user1, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user1).burnFrom(user2, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("tokens should not be burned if not enough", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();

    await expect(token.burn(initialSupply + 1n)).to.be.revertedWithCustomError(
      token,
      "ERC20InsufficientBalance"
    );

    await (await token.transfer(user1, amount)).wait();

    await (await token.connect(user1).approve(deployer, amount + 1n)).wait();
    await expect(
      token.burnFrom(user1, amount + 1n)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
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
