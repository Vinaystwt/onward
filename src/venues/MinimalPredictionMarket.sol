// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "../lib/OwnableLite.sol";

contract MinimalPredictionMarket is OwnableLite {
    struct Market {
        string question;
        bool open;
        bool resolved;
        bool outcome;
        uint256 yesCollateral;
        uint256 noCollateral;
    }

    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesShares;
    mapping(uint256 => mapping(address => uint256)) public noShares;

    event MarketCreated(uint256 indexed marketId, string question);
    event PositionBought(uint256 indexed marketId, address indexed buyer, bool yes, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);

    function createMarket(string calldata question) external onlyOwner returns (uint256 marketId) {
        marketId = nextMarketId++;
        markets[marketId] = Market({
            question: question,
            open: true,
            resolved: false,
            outcome: false,
            yesCollateral: 0,
            noCollateral: 0
        });
        emit MarketCreated(marketId, question);
    }

    function buyYes(uint256 marketId) external payable {
        Market storage market = markets[marketId];
        require(market.open, "MARKET_CLOSED");
        require(msg.value > 0, "NO_VALUE");
        yesShares[marketId][msg.sender] += msg.value;
        market.yesCollateral += msg.value;
        emit PositionBought(marketId, msg.sender, true, msg.value);
    }

    function buyNo(uint256 marketId) external payable {
        Market storage market = markets[marketId];
        require(market.open, "MARKET_CLOSED");
        require(msg.value > 0, "NO_VALUE");
        noShares[marketId][msg.sender] += msg.value;
        market.noCollateral += msg.value;
        emit PositionBought(marketId, msg.sender, false, msg.value);
    }

    function resolve(uint256 marketId, bool outcome) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.open, "MARKET_CLOSED");
        market.open = false;
        market.resolved = true;
        market.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }
}
