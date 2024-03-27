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
    const tx = await token.mint(deployer, amount);
    tx.wait();
    await expect(tx).to.changeTokenBalance(token, deployer, amount);

    await (await token.mint(user1, amount)).wait();

    expect(await token.balanceOf(user1)).to.eq(amount);
    expect(await token.totalSupply()).to.eq(initialSupply + amount + amount);
  });

  it("tokens should be minted only with DEFAULT_ADMIN_ROLE", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);

    const amount = await token.withDecimals(10);
    await (await token.grantBlackListerRole(user1)).wait();

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
    const tx = await token.burn(amount);
    await tx.wait();
    await expect(tx).to.changeTokenBalance(token, deployer, -amount);
    expect(await token.totalSupply()).to.eq(initialSupply - amount);
  });

  it("tokens should be transferred", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);
    await (await token.grantBlackListerRole(user1)).wait();
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

    await (await token.grantBlackListerRole(user1)).wait();

    const amount = await token.withDecimals(10);
    await (await token.transfer(user1, amount)).wait();
    await (await token.transfer(user1, amount)).wait();
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
    await (await token.transfer(user1, amount)).wait();

    await expect(token.burnFrom(user1, amount)).to.be.revertedWithCustomError(
      token,
      "ERC20InsufficientAllowance"
    );

    await (await token.connect(user1).approve(deployer, amount)).wait();

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

  it("tokens should not be transferred if not enough", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();

    await expect(
      token.transfer(user1, initialSupply + 1n)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

    await (await token.transfer(user1, amount)).wait();

    await expect(
      token.connect(user1).transfer(deployer, amount + 1n)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("token should be transferred by transferFrom func (it needs approve by address owner) ", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();

    await (await token.transfer(user1, amount * 2n)).wait();

    await expect(
      token.transferFrom(user1, user2, amount)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

    await (await token.connect(user1).approve(deployer, amount)).wait();

    const tx = await token.transferFrom(user1, user2, amount);
    await tx.wait();

    await expect(tx).to.be.changeTokenBalances(
      token,
      [user1, user2],
      [-amount, amount]
    );
    await (await token.connect(user1).approve(user2, amount)).wait();

    const tx1 = await token
      .connect(user2)
      .transferFrom(user1, deployer, amount);
    await tx1.wait();

    await expect(tx1).to.be.changeTokenBalances(
      token,
      [user1, deployer],
      [-amount, amount]
    );

    await (await token.approve(user1, amount)).wait();

    const tx2 = await token
      .connect(user1)
      .transferFrom(deployer, user2, amount);
    await tx2.wait();

    await expect(tx2).to.be.changeTokenBalances(
      token,
      [deployer, user2],
      [-amount, amount]
    );
  });

  it("token should not be transferred by transferFrom func if not enough", async function () {
    const { token, deployer, user1, user2 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    const initialSupply = await token.totalSupply();

    await (await token.connect(user1).approve(deployer, amount)).wait();

    await expect(
      token.transferFrom(user1, user2, amount)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("BLACKLISTER_ROLE should be granted and revoked", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);
    const BLACKLISTER_ROLE = await token.BLACKLISTER_ROLE();
    expect(await token.hasRole(BLACKLISTER_ROLE, user1)).to.be.false;
    await (await token.grantBlackListerRole(user1)).wait();
    expect(await token.hasRole(BLACKLISTER_ROLE, user1)).to.be.true;
    await (await token.revokeBlackListerRole(user1)).wait();
    expect(await token.hasRole(BLACKLISTER_ROLE, user1)).to.be.false;
    //
    await (await token.revokeBlackListerRole(deployer)).wait();
    expect(await token.hasRole(BLACKLISTER_ROLE, deployer)).to.be.false;
    await (await token.grantBlackListerRole(deployer)).wait();
    expect(await token.hasRole(BLACKLISTER_ROLE, deployer)).to.be.true;
  });

  it("only DEFAULT_ADMIN_ROLE should be granted and revoked BLACKLISTER_ROLE", async function () {
    const { token, user1, user2, user3 } = await loadFixture(deploy);
    const BLACKLISTER_ROLE = await token.BLACKLISTER_ROLE();
    expect(await token.hasRole(BLACKLISTER_ROLE, user1)).to.be.false;
    await (await token.grantBlackListerRole(user1)).wait();
    expect(await token.hasRole(BLACKLISTER_ROLE, user1)).to.be.true;

    await expect(
      token.connect(user1).grantBlackListerRole(user2)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user3).grantBlackListerRole(user2)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

    await (await token.grantBlackListerRole(user2)).wait();
    await expect(
      token.connect(user3).revokeBlackListerRole(user2)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(
      token.connect(user1).revokeBlackListerRole(user2)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("BLACKLISTER_ROLE should be added address to blacklist and removed it", async function () {
    const { token, user1, user2, user3 } = await loadFixture(deploy);
    await (await token.grantBlackListerRole(user1)).wait();
    await (await token.connect(user1).addToBlacklist(user2)).wait();
    expect(await token.isBlacklisted(user2)).to.be.true;
    await (await token.connect(user1).removeFromBlacklist(user2)).wait();
    expect(await token.isBlacklisted(user2)).to.be.false;
  });

  it("only BLACKLISTER_ROLE should be changed blacklist", async function () {
    const { token, user1, user2, user3 } = await loadFixture(deploy);

    await (await token.addToBlacklist(user3)).wait();
    await expect(
      token.connect(user1).addToBlacklist(user2)
    ).to.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

    await expect(
      token.connect(user1).removeFromBlacklist(user3)
    ).to.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("should be reverted with error if add exist or remove absent for blacklist ", async function () {
    const { token, user3 } = await loadFixture(deploy);

    await (await token.addToBlacklist(user3)).wait();
    await expect(token.addToBlacklist(user3)).to.revertedWith(
      "already blacklisted"
    );
    await (await token.removeFromBlacklist(user3)).wait();
    await expect(token.removeFromBlacklist(user3)).to.revertedWith(
      "not blacklisted"
    );
  });

  it("should not be granted BLACKLISTER_ROLE for address from blacklist ", async function () {
    const { token, user3 } = await loadFixture(deploy);

    await (await token.addToBlacklist(user3)).wait();
    await expect(token.grantBlackListerRole(user3)).to.revertedWith(
      "address blacklisted"
    );
  });

  it("should not be added to blacklist ADMIN or BLACKLISTER", async function () {
    const { token, deployer, user1 } = await loadFixture(deploy);

    await (await token.grantBlackListerRole(user1)).wait();

    await expect(token.addToBlacklist(user1)).to.revertedWith(
      "unacceptable for BLACKLISTER"
    );

    await expect(token.connect(user1).addToBlacklist(deployer)).to.revertedWith(
      "unacceptable for ADMIN"
    );
  });

  it("should not be accepted transfer tokens if sender or address in blacklist ", async function () {
    const { token, deployer, user1, user2, user3 } = await loadFixture(deploy);
    const amount = await token.withDecimals(10);
    await (await token.grantBlackListerRole(user1)).wait();
    await (await token.transfer(user3, amount)).wait();
    await (await token.connect(user1).addToBlacklist(user3)).wait();

    await expect(token.connect(user3).transfer(user2, amount)).to.revertedWith(
      "sender blacklisted"
    );
    await expect(token.transfer(user3, amount)).to.revertedWith(
      "address blacklisted"
    );
    await expect(token.mint(user3, amount)).to.revertedWith(
      "address blacklisted"
    );

    await (await token.connect(user3).approve(deployer, amount)).wait();
    await expect(token.burnFrom(user3, amount)).to.revertedWith(
      "address blacklisted"
    );
    await expect(token.transferFrom(user3, user2, amount)).to.revertedWith(
      "address blacklisted"
    );
    await (await token.connect(user3).approve(user1, amount)).wait();
    await expect(
      token.connect(user1).transferFrom(user3, user2, amount)
    ).to.revertedWith("address blacklisted");
    await (await token.connect(user3).approve(user2, amount)).wait();
    await expect(
      token.connect(user2).transferFrom(user3, user2, amount)
    ).to.revertedWith("address blacklisted");
    await (await token.approve(user2, amount)).wait();
    await expect(token.transferFrom(user2, user3, amount)).to.revertedWith(
      "address blacklisted"
    );
    await (await token.connect(user2).approve(user3, amount)).wait();
    await expect(
      token.connect(user3).transferFrom(user2, user1, amount)
    ).to.revertedWith("sender blacklisted");
  });
});
