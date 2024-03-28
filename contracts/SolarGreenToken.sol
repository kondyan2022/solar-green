// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SolarGreenToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant BLACKLISTER_ROLE = keccak256("BLACKLISTER_ROLE");
    mapping(address => bool) blacklist;

    event EventBlacklistChange(
        address indexed blacklister,
        address indexed user,
        bool blacklisted
    );

    modifier senderNotBlacklisted() {
        require(!isBlacklisted(msg.sender), "sender blacklisted");
        _;
    }

    modifier addressNotBlacklisted(address _address) {
        require(!isBlacklisted(_address), "address blacklisted");
        _;
    }

    function isBlacklisted(address _account) public view returns (bool) {
        return blacklist[_account];
    }

    function withDecimals(uint _amount) public view returns (uint) {
        return _amount * 10 ** decimals();
    }

    constructor(uint initialMint) ERC20("Solar Green", "SGR") {
        _mint(msg.sender, withDecimals(initialMint));
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BLACKLISTER_ROLE, msg.sender);
    }

    function mint(
        address to,
        uint amount
    ) public onlyRole(DEFAULT_ADMIN_ROLE) addressNotBlacklisted(to) {
        _mint(to, amount);
    }

    function burn(uint value) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        super.burn(value);
    }

    function burnFrom(
        address account,
        uint value
    )
        public
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
        addressNotBlacklisted(account)
    {
        super.burnFrom(account, value);
    }

    function transfer(
        address to,
        uint value
    )
        public
        override
        senderNotBlacklisted
        addressNotBlacklisted(to)
        returns (bool)
    {
        return super.transfer(to, value);
    }

    function transferFrom(
        address from,
        address to,
        uint value
    )
        public
        override
        senderNotBlacklisted
        addressNotBlacklisted(to)
        addressNotBlacklisted(from)
        returns (bool)
    {
        return super.transferFrom(from, to, value);
    }

    function grantBlackListerRole(
        address _account
    ) public onlyRole(DEFAULT_ADMIN_ROLE) addressNotBlacklisted(_account) {
        _grantRole(BLACKLISTER_ROLE, _account);
    }

    function revokeBlackListerRole(
        address _account
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(BLACKLISTER_ROLE, _account);
    }

    function addToBlacklist(
        address _account
    ) public onlyRole(BLACKLISTER_ROLE) {
        require(
            !hasRole(DEFAULT_ADMIN_ROLE, _account),
            "unacceptable for ADMIN"
        );
        require(
            !hasRole(BLACKLISTER_ROLE, _account),
            "unacceptable for BLACKLISTER"
        );
        require(!isBlacklisted(_account), "already blacklisted");
        blacklist[_account] = true;
        emit EventBlacklistChange(msg.sender, _account, true);
    }

    function removeFromBlacklist(
        address _account
    ) public onlyRole(BLACKLISTER_ROLE) {
        require(isBlacklisted(_account), "not blacklisted");
        blacklist[_account] = false;
        emit EventBlacklistChange(msg.sender, _account, false);
    }
}
