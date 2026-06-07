// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MiniLendingPool {
    mapping(address => uint256) public supplied;
    mapping(address => uint256) public borrowed;
    uint256 public totalSupplied;
    uint256 public totalBorrowed;

    event Supplied(address indexed supplier, uint256 amount);
    event Withdrawn(address indexed supplier, uint256 amount);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, uint256 amount);

    function supply() external payable {
        require(msg.value > 0, "NO_VALUE");
        supplied[msg.sender] += msg.value;
        totalSupplied += msg.value;
        emit Supplied(msg.sender, msg.value);
    }

    function withdrawSupply(uint256 amount) external {
        require(supplied[msg.sender] >= amount, "SUPPLY");
        require(address(this).balance >= amount, "POOL_LIQUIDITY");
        supplied[msg.sender] -= amount;
        totalSupplied -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "WITHDRAW_FAILED");
        emit Withdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        require(supplied[msg.sender] * 5000 / 10_000 >= borrowed[msg.sender] + amount, "COLLATERAL");
        require(address(this).balance >= amount, "POOL_LIQUIDITY");
        borrowed[msg.sender] += amount;
        totalBorrowed += amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "BORROW_FAILED");
        emit Borrowed(msg.sender, amount);
    }

    function repay() external payable {
        require(msg.value > 0, "NO_VALUE");
        require(borrowed[msg.sender] >= msg.value, "TOO_MUCH");
        borrowed[msg.sender] -= msg.value;
        totalBorrowed -= msg.value;
        emit Repaid(msg.sender, msg.value);
    }
}
