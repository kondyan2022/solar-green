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
      await USDTtoken.transfer(user1, ethers.parseUnits("10000", 18))
    ).wait();

    await (
      await USDTtoken.transfer(user2, ethers.parseUnits("10000", 18))
    ).wait();
    await (
      await USDTtoken.transfer(user3, ethers.parseUnits("10000", 18))
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
        ethers.parseUnits("70000", 18)
      );
      expect(await USDTtoken.balanceOf(user1)).to.be.eq(
        ethers.parseUnits("10000", 18)
      );
      expect(await USDTtoken.balanceOf(user2)).to.be.eq(
        ethers.parseUnits("10000", 18)
      );
      expect(await USDTtoken.balanceOf(user3)).to.be.eq(
        ethers.parseUnits("10000", 18)
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
  });
  describe("Sales", function () {
    it("should have price and rate", async function () {
      const { shop } = await loadFixture(deploy);
      expect(await shop.price()).to.be.eq(ethers.parseEther("160"));
      expect(await shop.getRateUSDT()).to.be.eq(ethers.parseUnits("3456", 8));
      expect(await shop.getAmountForBuy(ethers.parseUnits("1", 18))).to.be.eq(
        ethers.parseUnits("21.6", 18)
      );
    });
    describe("ETH", function () {
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
              (elem.sum * usdtRate * 10n ** tokenDecimals) /
              (price * 10n ** 8n),
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
    describe("USDT", function () {
      it("tokens should be sold to users", async function () {
        const { shop, token, USDTtoken, user1, user2, user3 } =
          await loadFixture(deploy);
        const price = await shop.price(); //160* 10**18 USDT
        const tokenDecimals = await token.decimals(); //18
        const usdtRate = await shop.getRateUSDT(); //3456*10**8
        const users = [
          {
            user: user1,
            pay: { amount: 216, decimals: 1 },
            sum: ethers.parseUnits("3456", 18),
            tokens: ethers.parseUnits("21.6", 18),
          }, //21.6 token =1 ETH = 3456USDT
          {
            user: user2,
            pay: { amount: 108, decimals: 1 },
            sum: ethers.parseUnits("1728", 18),
            tokens: ethers.parseUnits("10.8", 18),
          }, //10.8 token = 0.5 ETH = 1728USDT
          {
            user: user3,
            pay: { amount: 108, decimals: 3 },
            sum: ethers.parseUnits("17.28", 18),
            tokens: ethers.parseUnits("0.108", 18),
          }, //0.108 token = 0.005 ETH = 17.28USDT
        ];
        const totalTokens = users.reduce((acc, elem) => acc + elem.tokens, 0n);
        const totalSum = users.reduce((acc, elem) => acc + elem.sum, 0n);

        for (let [
          index,
          {
            user,
            sum,
            pay: { amount, decimals },
            tokens,
          },
        ] of users.entries()) {
          await (await USDTtoken.connect(user).approve(shop, sum)).wait();

          const tx = await shop.connect(user).buyForUSDT(amount, decimals);

          await tx.wait();
          await expect(tx).to.be.changeTokenBalances(
            USDTtoken,
            [shop, user],
            [sum, -sum]
          );

          expect(await shop.vestingBalanceOf(user)).to.be.eq(tokens);
        }

        expect(await shop.vestingTokens()).to.be.eq(totalTokens);

        expect(await shop.balanceUSDT()).to.be.eq(totalSum);
      });
      it("tokens should not be sold to users after the final sales date ", async function () {
        const { shop, user1 } = await loadFixture(deploy);

        await time.setNextBlockTimestamp(
          Math.floor(Date.now() / 1000 + +5 * 7 * 24 * 60 * 60 + 10)
        );
        await expect(
          shop.connect(user1).buyForUSDT(1, 0)
        ).to.be.revertedWithCustomError(shop, "SalesEnds");
      });
      it("should not be sold 0 tokens", async function () {
        const { shop, user1 } = await loadFixture(deploy);

        await expect(shop.connect(user1).buyForUSDT(0, 10)).to.be.revertedWith(
          "invalid amount"
        );
      });

      it("should not be sold more than 50K tokens per wallet", async function () {
        const { shop, user1, user2, USDTtoken } = await loadFixture(deploy);
        const price = ethers.parseUnits("0.001", 18); //1token = 0.001 usdt
        (await shop.setPrice(price)).wait();
        await (
          await USDTtoken.connect(user1).approve(
            shop,
            ethers.parseUnits("51", 18)
          )
        ).wait();
        await shop.connect(user1).buyForUSDT(40000, 0);

        await expect(
          shop.connect(user1).buyForUSDT(10001, 0)
        ).to.be.revertedWithCustomError(shop, "WalletLimit");
        await expect(
          shop.connect(user2).buyForUSDT(50001, 0)
        ).to.be.revertedWithCustomError(shop, "WalletLimit");
      });

      it("should be revert when not enough free tokens", async function () {
        const { token, shop, user1, user2, USDTtoken } = await loadFixture(
          deploy
        );
        const price = ethers.parseUnits("0.001", 18); //1ETH = 10000 token

        (await shop.setPrice(price)).wait();
        await (
          await USDTtoken.connect(user1).approve(
            shop,
            ethers.parseUnits("40", 18)
          )
        ).wait();
        await shop.connect(user1).buyForUSDT(40000, 0);
        const revertTokens = await token.withDecimals(49950000);

        (await shop["withdrawTokens(uint256)"](revertTokens)).wait();

        await expect(
          shop.connect(user2).buyForUSDT(40000, 0)
        ).to.be.revertedWithCustomError(shop, "InsufficientTokens");
      });
      it("should be revert when not have approval", async function () {
        const { shop, user2 } = await loadFixture(deploy);

        await expect(
          shop.connect(user2).buyForUSDT(5, 0)
        ).to.be.revertedWithCustomError(shop, "InsufficientAllowance");
      });
      it("should be revert when not have enough USDT", async function () {
        const { token, shop, user1, user2, USDTtoken } = await loadFixture(
          deploy
        );
        await (
          await USDTtoken.connect(user1).approve(
            shop,
            ethers.parseUnits("6400000", 18)
          )
        ).wait();
        await expect(
          shop.connect(user1).buyForUSDT(40000, 0)
        ).to.be.revertedWithCustomError(shop, "InsufficientFunds");
      });
    });
  });
  describe("Withdraw USDT by owner", function () {
    it("owner should withdraw", async function () {
      const { shop, USDTtoken, deployer, user1 } = await loadFixture(deploy);
      const totalSum = ethers.parseUnits("3456", 18);
      await (await USDTtoken.connect(user1).approve(shop, totalSum)).wait();
      await (await shop.connect(user1).buyForUSDT(216, 1)).wait();

      const shopBalance = await USDTtoken.balanceOf(shop);

      expect(await USDTtoken.balanceOf(shop)).to.be.eq(
        ethers.parseUnits("3456", 18)
      );

      const tx1 = await shop["withdrawUSDT(uint256,address)"](
        1000000000n,
        user1
      );
      await tx1.wait();

      await expect(tx1).to.be.changeTokenBalances(
        USDTtoken,
        [shop, user1],
        [-1000000000n, 1000000000n]
      );
      const tx2 = await shop["withdrawUSDT(uint256)"](2000000000n);
      await tx2.wait();

      await expect(tx2).to.be.changeTokenBalances(
        USDTtoken,
        [shop, deployer],
        [-2000000000n, 2000000000n]
      );

      const withdrawSum = totalSum - 1000000000n - 2000000000n;

      const tx3 = await shop["withdrawUSDT()"]();
      await tx3.wait();

      await expect(tx3).to.be.changeTokenBalances(
        USDTtoken,
        [shop, deployer],
        [-withdrawSum, withdrawSum]
      );
    });
    it("should not be withdrawing USDT if they are not enough or zero receiver", async function () {
      const { shop, USDTtoken, user1 } = await loadFixture(deploy);
      const totalSum = ethers.parseUnits("3456", 18);
      await (await USDTtoken.connect(user1).approve(shop, totalSum)).wait();
      await (await shop.connect(user1).buyForUSDT(216, 1)).wait();
      await expect(
        shop["withdrawUSDT(uint256,address)"](1n, ethers.ZeroAddress)
      ).to.be.revertedWith("zero address");

      await (await shop["withdrawUSDT()"]()).wait();

      await expect(shop["withdrawUSDT()"]()).to.be.revertedWith("no funds");
      await expect(
        shop["withdrawUSDT(uint256)"](1n)
      ).to.be.revertedWithCustomError(shop, "InsufficientFunds");
      await expect(
        shop["withdrawUSDT(uint256,address)"](1n, user1)
      ).to.be.revertedWithCustomError(shop, "InsufficientFunds");
    });
    it("should withdraw only by owner", async function () {
      const { shop, USDTtoken, user1 } = await loadFixture(deploy);
      const totalSum = ethers.parseUnits("3456", 18);
      await (await USDTtoken.connect(user1).approve(shop, totalSum)).wait();
      await (await shop.connect(user1).buyForUSDT(216, 1)).wait();
      await expect(shop.connect(user1)["withdrawUSDT()"]()).to.be.revertedWith(
        "not a owner"
      );

      await expect(
        shop.connect(user1)["withdrawUSDT(uint256)"](1n)
      ).to.be.revertedWith("not a owner");
      await expect(
        shop.connect(user1)["withdrawUSDT(uint256,address)"](1n, user1)
      ).to.be.revertedWith("not a owner");
      await expect(
        shop
          .connect(user1)
          ["withdrawTokens(uint256,address)"](1n, ethers.ZeroAddress)
      ).to.be.revertedWith("not a owner");
    });
  });
});
