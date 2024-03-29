// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error InvalidSum(uint sum);
error InsufficientTokens(uint requested, uint available);
error InsufficientFunds(uint requested, uint available);
error WalletLimit(uint requested, uint available);
error VestingLockedTime(uint requested, uint available);
error SalesEnds(uint currentTime, uint endSalesTime);

contract SolarGreenSale {
    uint _priceInWei;
    // uint priceInUSDT;
    IERC20Metadata private immutable token;
    address payable public owner;
    uint public constant unlockTime = 1735682400; // 01.01.2025
    uint public endSaleTime;
    uint public immutable walletLimit;
    uint public vestingTokens;
    mapping(address => uint) vestingList;

    event Sale(
        address indexed buyer,
        uint amount,
        uint indexed price,
        uint total
    );

    event TransferTokens(
        address indexed buyer,
        address indexed to,
        uint amount
    );
    event PriceChanged(uint timestamp, uint newprice);

    modifier onlyOwner() {
        require(msg.sender == owner, "not a owner");
        _;
    }

    function priceInWei() external view returns (uint256) {
        return _priceInWei;
    }

    function setEndSalesTime(uint newTime) external onlyOwner {
        require(newTime > block.timestamp + 10 minutes, "invalid datetime");
        endSaleTime = newTime;
    }

    function vestingBalanceOf(address account) external view returns (uint256) {
        return vestingList[account];
    }

    function availableTokens() external view returns (uint) {
        return token.balanceOf(address(this)) - vestingTokens;
    }

    constructor(IERC20Metadata _token, uint startPrice) {
        token = _token;
        endSaleTime = block.timestamp + 5 weeks;
        walletLimit = 50000 * 10 ** token.decimals();
        _priceInWei = startPrice;
        vestingTokens = 0;
        owner = payable(msg.sender);
    }

    function setPriceInWei(uint newPrice) external onlyOwner {
        _priceInWei = newPrice;
    }

    function buy() public payable {
        if (block.timestamp > endSaleTime) {
            revert SalesEnds(block.timestamp, endSaleTime);
        }

        uint amount = (msg.value * 10 ** token.decimals()) / _priceInWei;
        if (amount < 1) {
            revert InvalidSum(msg.value);
        }
        uint totalBuy = amount + vestingList[msg.sender];
        if (totalBuy > walletLimit) {
            revert WalletLimit(totalBuy, walletLimit);
        }
        uint freeTokens = token.balanceOf(address(this)) - vestingTokens;
        if (amount > freeTokens) {
            revert InsufficientTokens(amount, freeTokens);
        }
        vestingList[msg.sender] += amount;
        vestingTokens += amount;
        emit Sale(msg.sender, amount, _priceInWei, msg.value);
    }

    receive() external payable {
        buy();
    }

    function transferTokensTo(address account, uint amount) public {
        if (amount > vestingList[msg.sender]) {
            revert InsufficientTokens(amount, vestingList[msg.sender]);
        }

        if (block.timestamp < unlockTime) {
            revert VestingLockedTime(block.timestamp, unlockTime);
        }
        token.transfer(account, amount);
        vestingList[msg.sender] -= amount;
        vestingTokens -= amount;
        emit TransferTokens(msg.sender, account, amount);
    }

    function transferTokens(uint amount) external {
        transferTokensTo(msg.sender, amount);
    }

    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "zero funds");
        payable(owner).transfer(address(this).balance);
    }

    function withdraw(uint _amount) external onlyOwner {
        if (address(this).balance < _amount) {
            revert InsufficientFunds(_amount, address(this).balance);
        }
        payable(owner).transfer(_amount);
    }

    function withdraw(uint _amount, address payable _to) external onlyOwner {
        require(_to != address(0), "zero address");
        if (address(this).balance < _amount) {
            revert InsufficientFunds(_amount, address(this).balance);
        }
        bool sent = _to.send(_amount);
        require(sent, "Failed to send Ether");
    }

    function withdrawTokens() external onlyOwner {
        uint available = token.balanceOf(address(this)) - vestingTokens;
        require(available > 0, "zero free tokens");
        withdrawTokens(available, msg.sender);
    }

    function withdrawTokens(uint amount) external onlyOwner {
        withdrawTokens(amount, msg.sender);
    }

    function withdrawTokens(uint amount, address _to) public onlyOwner {
        require(_to != address(0), "zero address");
        uint available = token.balanceOf(address(this)) - vestingTokens;
        if (amount > available) {
            revert InsufficientTokens(amount, available);
        }
        token.transfer(_to, amount);
    }
}
