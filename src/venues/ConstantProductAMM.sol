// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "../lib/OwnableLite.sol";
import {OnwardToken} from "./OnwardToken.sol";

contract ConstantProductAMM is OwnableLite {
    OnwardToken public immutable token;
    uint256 public nativeReserve;
    uint256 public tokenReserve;

    event LiquiditySeeded(uint256 nativeAmount, uint256 tokenAmount);
    event TokenBought(address indexed buyer, uint256 nativeIn, uint256 tokenOut);

    constructor(address token_) {
        token = OnwardToken(token_);
    }

    receive() external payable {}

    function seed(uint256 tokenAmount) external payable onlyOwner {
        require(nativeReserve == 0 && tokenReserve == 0, "ALREADY_SEEDED");
        require(msg.value > 0 && tokenAmount > 0, "BAD_SEED");
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "TOKEN_TRANSFER");
        nativeReserve = msg.value;
        tokenReserve = tokenAmount;
        emit LiquiditySeeded(msg.value, tokenAmount);
    }

    function buyToken(uint256 minOut) external payable returns (uint256 amountOut) {
        require(msg.value > 0, "NO_VALUE");
        require(nativeReserve > 0 && tokenReserve > 0, "NO_LIQUIDITY");
        uint256 amountInWithFee = msg.value * 997;
        amountOut = (amountInWithFee * tokenReserve) / (nativeReserve * 1000 + amountInWithFee);
        require(amountOut >= minOut, "SLIPPAGE");
        nativeReserve += msg.value;
        tokenReserve -= amountOut;
        require(token.transfer(msg.sender, amountOut), "TOKEN_TRANSFER");
        emit TokenBought(msg.sender, msg.value, amountOut);
    }
}
