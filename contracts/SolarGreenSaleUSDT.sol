// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {SolarGreenSale} from "./SolarGreenSale.sol";

error InsufficientTokens(uint requested, uint available);
error InsufficientFunds(uint requested, uint available, string currency);
error InsufficientAllowance(uint requested, uint available);
error WalletLimit(uint requested, uint available);
error SalesEnds(uint currentTime, uint endSalesTime);

contract SolarGreenSaleUSDT is SolarGreenSale {
    IERC20Metadata private immutable usdtToken;
    AggregatorV3Interface internal dataFeed;

    constructor(
        IERC20Metadata _token,
        IERC20Metadata _usdtToken,
        uint startPrice
    ) SolarGreenSale(_token, startPrice) {
        dataFeed = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        );
        usdtToken = _usdtToken;
    }
    function getRateUSDT() public view returns (int) {
        (
            ,
            /* uint80 roundID */ int answer /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/,
            ,
            ,

        ) = dataFeed.latestRoundData();
        return answer;
    }

    function balanceUSDT() public view returns (uint) {
        return usdtToken.balanceOf(address(this));
    }

    function setAggregator(AggregatorV3Interface _dataFeed) external onlyOwner {
        dataFeed = _dataFeed;
    }
    function getAmountForBuy(uint value) public view override returns (uint) {
        uint usdtRate = uint(getRateUSDT());
        return (value * usdtRate * 10 ** token.decimals()) / (_price * 10 ** 8);
    }

    function buyForUSDT(
        uint tokenAmount,
        uint8 decimals_
    ) public beforeEndSaleTime {
        uint amount = (tokenAmount * 10 ** 18) / 10 ** decimals_;
        require(amount > 0, "invalid amount");

        uint totalBuy = amount + vestingList[msg.sender];
        if (totalBuy > walletLimit) {
            revert WalletLimit(totalBuy, walletLimit);
        }
        uint freeTokens = token.balanceOf(address(this)) - vestingTokens;
        if (amount > freeTokens) {
            revert InsufficientTokens(amount, freeTokens);
        }
        uint sum = (amount * _price) / (10 ** 18);

        uint allowance = usdtToken.allowance(msg.sender, address(this));
        if (allowance < sum) {
            revert InsufficientAllowance(sum, allowance);
        }
        uint balance = usdtToken.balanceOf(msg.sender);
        if (balance < sum) {
            revert InsufficientFunds(sum, balance, "USDT");
        }

        usdtToken.transferFrom(msg.sender, address(this), sum);

        vestingList[msg.sender] += amount;
        vestingTokens += amount;
        emit Sale(msg.sender, amount, _price, sum, "USDT");
    }
    function withdrawUSDT() external onlyOwner {
        uint available = usdtToken.balanceOf(address(this));
        require(available > 0, "no funds");
        withdrawUSDT(available, msg.sender);
    }

    function withdrawUSDT(uint amount) external onlyOwner {
        withdrawUSDT(amount, msg.sender);
    }

    function withdrawUSDT(uint amount, address _to) public onlyOwner {
        require(_to != address(0), "zero address");
        uint available = usdtToken.balanceOf(address(this));
        if (amount > available) {
            revert InsufficientFunds(amount, available, "USDT");
        }
        usdtToken.transfer(_to, amount);
    }
}
