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
  const startPrice = 160n * 10n ** 18n; //1token = 160USDT (18 numbers)

  async function deploy() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    const AggregatorFactory = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const aggregator: MockV3Aggregator = await AggregatorFactory.deploy(
      8,
      345600000000
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

    await (await shop.setAggregator(aggregator)).wait();

    await (
      await token.transfer(shop, await token.withDecimals(toSaleAmount))
    ).wait();
    await (
      await USDTtoken.transfer(user1, ethers.parseUnits("1000", 18))
    ).wait();

    await (
      await USDTtoken.transfer(user2, ethers.parseUnits("1000", 18))
    ).wait();
    await (
      await USDTtoken.transfer(user3, ethers.parseUnits("1000", 18))
    ).wait();

    return {
      aggregator,
      token,
      USDTtoken,
      shop,
      deployer,
      user1,
      user2,
      user3,
    };
  }

  describe("Deployment", function () {
    it("should created", async function () {
      const { shop, token, USDTtoken, deployer, user1, user2, user3 } =
        await loadFixture(deploy);
      expect(await shop.getAddress()).to.be.properAddress;
      expect(await token.getAddress()).to.be.properAddress;
      expect(await USDTtoken.getAddress()).to.be.properAddress;
      expect(await USDTtoken.balanceOf(deployer)).to.be.eq(
        ethers.parseUnits("97000", 18)
      );
      expect(await USDTtoken.balanceOf(user1)).to.be.eq(
        ethers.parseUnits("1000", 18)
      );
      expect(await USDTtoken.balanceOf(user2)).to.be.eq(
        ethers.parseUnits("1000", 18)
      );
      expect(await USDTtoken.balanceOf(user3)).to.be.eq(
        ethers.parseUnits("1000", 18)
      );
    });

    it("should be set aggregator only by owner", async function () {
      const { shop, user1 } = await loadFixture(deploy);
      await expect(
        shop
          .connect(user1)
          .setAggregator("0x694aa1769357215de4fac081bf1f309adc325306")
      ).to.be.rejectedWith("not a owner");
    });

    it("should have price and rate", async function () {
      const { shop, token } = await loadFixture(deploy);
      expect(await shop.price()).to.be.eq(ethers.parseEther("160"));
      expect(await shop.getRateUSDT()).to.be.eq(ethers.parseUnits("3456", 8));
      expect(await shop.getAmountForBuy(ethers.parseUnits("1", 18))).to.be.eq(
        ethers.parseUnits("21.6", 18)
      );
    });

    it("tokens should be sold to users for ETH ", async function () {
      const { shop, token, user1, user2, user3 } = await loadFixture(deploy);
      const price = await shop.price(); //160* 10**18 USDT
      const tokenDecimals = await token.decimals(); //18
      const usdtRate = await shop.getRateUSDT(); //3456*10**8
      const users = [
        { user: user1, pay: "1" }, //21.6 token
        { user: user2, pay: "0.5" }, //10.8 token
        { user: user3, pay: "0.005" }, //0.108 token
      ]
        .map((elem) => ({ ...elem, sum: ethers.parseEther(elem.pay) }))
        .map((elem) => ({
          ...elem,
          tokens:
            (elem.sum * usdtRate * 10n ** tokenDecimals) / (price * 10n ** 8n),
        }));

      const totalTokens = users.reduce((acc, elem) => acc + elem.tokens, 0n);

      for (let [index, { user, sum, tokens }] of users.entries()) {
        const tx =
          index !== 2
            ? await shop.connect(user).buy({ value: sum })
            : await user.sendTransaction({
                to: await shop.getAddress(),
                value: sum,
              });
        await tx.wait();
        await expect(tx).to.be.changeEtherBalances([shop, user], [sum, -sum]);
        expect(await shop.vestingBalanceOf(user)).to.be.eq(tokens);
      }

      expect(await shop.vestingTokens()).to.be.eq(totalTokens);

      for (let [index, { user, sum, tokens }] of users.entries()) {
        const tx =
          index !== 2
            ? await shop.connect(user).buy({ value: sum })
            : await user.sendTransaction({
                to: await shop.getAddress(),
                value: sum,
              });
        await tx.wait();
        await expect(tx).to.be.changeEtherBalances([shop, user], [sum, -sum]);
        expect(await shop.vestingBalanceOf(user)).to.be.eq(tokens * 2n);
      }
      expect(await shop.vestingTokens()).to.be.eq(totalTokens * 2n);
      expect(await shop.availableTokens()).to.be.eq(
        (await token.withDecimals(toSaleAmount)) - totalTokens * 2n
      );
    });
  });
});
