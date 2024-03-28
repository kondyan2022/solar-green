import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { SolarGreenSale, SolarGreenToken } from "../typechain-types";

describe("Solar Green Token Shop", function () {
  const initialMint = 100000000n;
  const toSaleAmount = 50000000n;
  const startPrice = 5n * 10n ** 16n;

  async function deploy() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("SolarGreenToken");
    const token: SolarGreenToken = await TokenFactory.deploy(initialMint);
    await token.waitForDeployment();

    const ShopFactory = await ethers.getContractFactory("SolarGreenSale");
    const shop: SolarGreenSale = await ShopFactory.deploy(token, startPrice);
    await shop.waitForDeployment();

    const tx = await token.transfer(
      shop,
      await token.withDecimals(toSaleAmount)
    );

    return { token, shop, deployer, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("should created", async function () {
      const { token, shop, deployer, user1 } = await loadFixture(deploy);
    });
  });
});
