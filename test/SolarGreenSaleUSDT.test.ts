import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import {
  AggregatorV3Interface,
  MockV3Aggregator,
  SolarGreenSaleUSDT,
  SolarGreenToken,
  USDTTestToken,
} from "../typechain-types";

describe("USDT Shop", function () {
  const initialMint = 100000000n;
  const toSaleAmount = 50000000n;
  const startPrice = 160n * 10n ** 18n; //1token = 160USDT

  async function deploy() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    const AggregatorFactory = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const aggregator: MockV3Aggregator = await AggregatorFactory.deploy(
      6,
      3456000000
    );
    await aggregator.waitForDeployment();

    const USDTTestTokenFactory = await ethers.getContractFactory(
      "USDTTestToken"
    );
    const USDTtoken: USDTTestToken = await USDTTestTokenFactory.deploy();
    await USDTtoken.waitForDeployment();

    const TokenFactory = await ethers.getContractFactory("SolarGreenToken");
    const token: SolarGreenToken = await TokenFactory.deploy(initialMint);
    await token.waitForDeployment();

    const ShopFactory = await ethers.getContractFactory("SolarGreenSaleUSDT");
    const shop: SolarGreenSaleUSDT = await ShopFactory.deploy(
      token,
      USDTtoken,
      startPrice
    );
    await shop.waitForDeployment();

    await shop.setAggregator(aggregator);

    await (
      await token.transfer(shop, await token.withDecimals(toSaleAmount))
    ).wait();

    return {
      aggregator,
      token,
      shop,
      deployer,
      user1,
      user2,
      user3,
    };
  }

  describe("Deployment", function () {
    it("should created", async function () {
      const { shop } = await loadFixture(deploy);
    });
  });
});
