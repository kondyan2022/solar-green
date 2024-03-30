// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {SolarGreenSale} from "./SolarGreenSale.sol";

error InvalidSum(uint sum);
error InsufficientTokens(uint requested, uint available);
error InsufficientFunds(uint requested, uint available);
error WalletLimit(uint requested, uint available);
error VestingLockedTime(uint requested, uint available);
error SalesEnds(uint currentTime, uint endSalesTime);

contract SolarGreenSaleUSDT is SolarGreenSale {
    IERC20Metadata private immutable usdtToken;
    IERC20Metadata private immutable token;
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

    function setAggregator(AggregatorV3Interface _dataFeed) external onlyOwner {
        dataFeed = _dataFeed;
    }
    function getAmountForPushcase(
        uint value
    ) public view override returns (uint) {
        uint usdtRate = uint(getRateUSDT());
        return (value * usdtRate * 10 ** token.decimals()) / (_price * 10 ** 8);
    }
}
