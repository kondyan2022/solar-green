import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { SolarGreenSale, SolarGreenToken } from "../typechain-types";

describe("Solar Green Token Shop", function () {
  const initialMint = 100000000n;
  const toSaleAmount = 50000000n;
  const startPrice = 5n * 10n ** 16n; //1ETH = 20 token

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
      const { token, shop } = await loadFixture(deploy);

      expect(await token.getAddress()).to.be.properAddress;
      expect(await shop.getAddress()).to.be.properAddress;
    });

    it("should set end sale date + 5 weeks after deployment", async function () {
      const { shop } = await loadFixture(deploy);
      const tx = shop.deploymentTransaction();
      const block = await ethers.provider.getBlock(Number(tx?.blockNumber));
      const timestamp = block?.timestamp || 0;
      expect(await shop.endSaleTime()).to.be.eq(
        timestamp + 5 * 7 * 24 * 60 * 60 //+ 5 weeks
      );
    });

    it("should had 01.01.2025 as unlock time of vesting list ", async function () {
      const { shop } = await loadFixture(deploy);

      expect(await shop.unlockTime()).to.be.eq(
        Math.floor(Date.parse("01 Jan 2025") / 1000)
      );
    });

    it("should had 50% tokens of initial mint for sale", async function () {
      const { shop, token, deployer } = await loadFixture(deploy);

      expect(await token.balanceOf(shop)).to.be.eq(
        await token.withDecimals(initialMint / 2n)
      );
    });
  });

  describe("Sales", function () {
    it("only owner should set sell price in wei", async function () {
      const { shop, user1 } = await loadFixture(deploy);
      const priceInWei = 2n * 10n ** 18n;
      (await shop.setPriceInWei(priceInWei)).wait();

      expect(await shop.priceInWei()).to.be.eq(priceInWei);

      await expect(
        shop.connect(user1).setPriceInWei(startPrice)
      ).to.be.revertedWith("not a owner");
    });

    it("end sales date should be set least 10 minutes later from the current one", async function () {
      const { shop } = await loadFixture(deploy);
      await expect(
        shop.setEndSalesTime(Math.floor(Date.now() / 1000 + 590))
      ).to.be.revertedWith("invalid datetime");

      const endSaleTime = Math.floor(Date.now() / 1000) + 660;
      (await shop.setEndSalesTime(endSaleTime)).wait();
      expect(await shop.endSaleTime()).to.be.eq(endSaleTime);
    });

    it("end sales date should be set only by owner", async function () {
      const { shop, user1 } = await loadFixture(deploy);
      await expect(
        shop.connect(user1).setEndSalesTime(Math.floor(Date.now() / 1000 + 660))
      ).to.be.revertedWith("not a owner");
    });

    it("tokens should be sold to users ", async function () {
      const { shop, token, user1, user2, user3 } = await loadFixture(deploy);
      const price = await shop.priceInWei();
      const tokenDecimals = await token.decimals();
      const users = [
        { user: user1, pay: "1" },
        { user: user2, pay: "0.5" },
        { user: user3, pay: "0.005" },
      ]
        .map((elem) => ({ ...elem, sum: ethers.parseEther(elem.pay) }))
        .map((elem) => ({
          ...elem,
          tokens: (elem.sum * 10n ** tokenDecimals) / price,
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
    it("tokens should not be sold to users after end of sale ", async function () {
      const { shop, user1 } = await loadFixture(deploy);
      await time.setNextBlockTimestamp(
        Math.floor(Date.now() / 1000 + +5 * 7 * 24 * 60 * 60)
      );
      await expect(
        shop.connect(user1).buy({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(shop, "SalesEnds");
    });
    it("should not be sold less than smallest token part", async function () {
      const { shop, user1 } = await loadFixture(deploy);
      const priceInWei = 2n * 10n ** 18n;
      (await shop.setPriceInWei(priceInWei)).wait(); //2ETH = 1 token)
      await expect(
        shop.connect(user1).buy({ value: 1 })
      ).to.be.revertedWithCustomError(shop, "InvalidSum");
    });

    it("should not be sold more than 50K tokens per wallet", async function () {
      const { shop, user1, user2 } = await loadFixture(deploy);
      const priceInWei = 10n ** 14n; //1ETH = 10000 token
      (await shop.setPriceInWei(priceInWei)).wait(); //2ETH = 1 token)

      await shop.connect(user1).buy({ value: ethers.parseEther("4") });

      await expect(
        shop.connect(user1).buy({ value: ethers.parseEther("1.000000001") })
      ).to.be.revertedWithCustomError(shop, "WalletLimit");
      await expect(
        shop.connect(user2).buy({ value: ethers.parseEther("5.000000001") })
      ).to.be.revertedWithCustomError(shop, "WalletLimit");
    });

    it("should be revert when not enough free tokens", async function () {
      const { token, shop, user1, user2 } = await loadFixture(deploy);
      const priceInWei = 10n ** 14n; //1ETH = 10000 token

      (await shop.setPriceInWei(priceInWei)).wait();
      await shop.connect(user1).buy({ value: ethers.parseEther("4") });
      const revertTokens = await token.withDecimals(49950000);

      (await shop["withdrawTokens(uint256)"](revertTokens)).wait();

      await expect(
        shop.connect(user2).buy({ value: ethers.parseEther("4") })
      ).to.be.revertedWithCustomError(shop, "InsufficientTokens");
    });
  });

  describe("Token transfer by buyer", function () {
    it("should not be transfer before 01.01.2025", async function () {
      const { shop, deployer, user1 } = await loadFixture(deploy);
      await (await shop.buy({ value: ethers.parseEther("1") })).wait();
      await (
        await shop.connect(user1).buy({ value: ethers.parseEther("2") })
      ).wait();

      await expect(
        shop.connect(user1).transferTokens(1000000n)
      ).to.be.revertedWithCustomError(shop, "VestingLockedTime");
      await expect(shop.transferTokens(1000000n)).to.be.revertedWithCustomError(
        shop,
        "VestingLockedTime"
      );
    });

    it("should be transfer after or equal 01.01.2025", async function () {
      const { shop, token, user1, user2 } = await loadFixture(deploy);
      await (await shop.buy({ value: ethers.parseEther("1") })).wait();
      await (
        await shop.connect(user1).buy({ value: ethers.parseEther("2") })
      ).wait();
      time.setNextBlockTimestamp(Math.floor(Date.parse("01 Jan 2025") / 1000));
      await expect(
        shop.connect(user1).transferTokens(1000000n)
      ).to.be.changeTokenBalances(token, [shop, user1], [-1000000n, 1000000n]);
      await expect(
        shop.connect(user1).transferTokensTo(user2, 1000000n)
      ).to.be.changeTokenBalances(token, [shop, user2], [-1000000n, 1000000n]);
    });

    it("should not transferred when amount is over", async function () {
      const { shop, token, user1, user2 } = await loadFixture(deploy);
      await (
        await shop.connect(user1).buy({ value: ethers.parseEther("1") })
      ).wait();

      time.setNextBlockTimestamp(Math.floor(Date.parse("01 Jan 2025") / 1000));
      await expect(
        shop.connect(user1).transferTokens((await token.withDecimals(20)) + 1n)
      ).to.be.revertedWithCustomError(shop, "InsufficientTokens");
      await expect(
        shop
          .connect(user1)
          .transferTokensTo(user2, (await token.withDecimals(20)) + 1n)
      ).to.be.revertedWithCustomError(shop, "InsufficientTokens");
    });

    it("should not transferred when address is zero", async function () {
      const { shop, token, user1 } = await loadFixture(deploy);
      await (
        await shop.connect(user1).buy({ value: ethers.parseEther("1") })
      ).wait();

      time.setNextBlockTimestamp(Math.floor(Date.parse("01 Jan 2025") / 1000));
      await expect(
        shop
          .connect(user1)
          .transferTokensTo(ethers.ZeroAddress, await token.withDecimals(20))
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });
  describe("withdraw funds by owner", function () {
    it("owner should be withdraw", async function () {
      const { shop, deployer, user1, user2 } = await loadFixture(deploy);

      const amount = ethers.parseEther("0.5"); //0.5 ether = 10token
      await (await shop.connect(user1).buy({ value: amount })).wait();
      const tx1 = await shop["withdraw(uint256,address)"](100000n, user2);
      await tx1.wait();

      await expect(tx1).to.changeEtherBalances(
        [await shop.getAddress(), user2],
        [-100000n, 100000n]
      );
      const tx2 = await shop["withdraw(uint256)"](500000000n);
      await tx2.wait();

      await expect(tx2).to.changeEtherBalances(
        [await shop.getAddress(), deployer],
        [-500000000n, 500000000n]
      );

      const currentBalance = await ethers.provider.getBalance(shop);
      const tx3 = await shop["withdraw()"]();
      await tx3.wait();

      await expect(tx3).to.changeEtherBalances(
        [await shop.getAddress(), deployer],
        [-currentBalance, currentBalance]
      );

      await expect(shop["withdraw()"]()).to.be.revertedWith("zero funds");
      await expect(shop["withdraw(uint256)"](1n)).to.be.revertedWithCustomError(
        shop,
        "InsufficientFunds"
      );
    });

    it("only owner should be withdraw", async function () {
      const { shop, user1, user2 } = await loadFixture(deploy);

      const amount = ethers.parseEther("0.5"); //0.5 ether = 10token
      await (await shop.connect(user1).buy({ value: amount })).wait();

      await expect(
        shop.connect(user1)["withdraw(uint256,address)"](100000n, user2)
      ).to.be.revertedWith("not a owner");
      await expect(
        shop.connect(user2)["withdraw(uint256)"](1n)
      ).to.be.revertedWith("not a owner");
    });
  });
  describe("withdraw tokens by owner", function () {
    it("owner should be withdraw tokens", async function () {
      const { shop, token, deployer, user1, user2, user3 } = await loadFixture(
        deploy
      );
      const users = [
        { user: user1, pay: "1" },
        { user: user2, pay: "0.5" },
        { user: user3, pay: "0.005" },
      ].map((elem) => ({ ...elem, sum: ethers.parseEther(elem.pay) }));

      for (let [index, { user, sum }] of users.entries()) {
        await (await shop.connect(user).buy({ value: sum })).wait();
      }

      const tx1 = await shop["withdrawTokens(uint256,address)"](
        1000000000n,
        user1
      );
      await tx1.wait();

      await expect(tx1).to.be.changeTokenBalances(
        token,
        [shop, user1],
        [-1000000000n, 1000000000n]
      );
      const tx2 = await shop["withdrawTokens(uint256)"](2000000000n);
      await tx2.wait();

      await expect(tx2).to.be.changeTokenBalances(
        token,
        [shop, deployer],
        [-2000000000n, 2000000000n]
      );

      const freeTokens = await shop.availableTokens();
      const tx3 = await shop["withdrawTokens()"]();
      await tx3.wait();

      await expect(tx3).to.be.changeTokenBalances(
        token,
        [shop, deployer],
        [-freeTokens, freeTokens]
      );
    });
  });
});
