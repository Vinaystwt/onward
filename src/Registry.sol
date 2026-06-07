// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";

contract Registry is OwnableLite {
    mapping(bytes32 => bool) public eventTypes;
    mapping(bytes32 => bool) public actionTypes;

    event EventTypeSet(bytes32 indexed eventType, bool supported);
    event ActionTypeSet(bytes32 indexed actionType, bool supported);

    constructor() {
        _setEventType(keccak256("PRICE_JSON"), true);
        _setEventType(keccak256("LLM_CLASSIFY"), true);
        _setEventType(keccak256("WEB_PARSE"), true);
        _setActionType(keccak256("PREDICTION_BUY_YES"), true);
        _setActionType(keccak256("TRADING_BUY_TOKEN"), true);
        _setActionType(keccak256("LENDING_SUPPLY"), true);
    }

    function setEventType(bytes32 eventType, bool supported) external onlyOwner {
        _setEventType(eventType, supported);
    }

    function setActionType(bytes32 actionType, bool supported) external onlyOwner {
        _setActionType(actionType, supported);
    }

    function _setEventType(bytes32 eventType, bool supported) internal {
        eventTypes[eventType] = supported;
        emit EventTypeSet(eventType, supported);
    }

    function _setActionType(bytes32 actionType, bool supported) internal {
        actionTypes[actionType] = supported;
        emit ActionTypeSet(actionType, supported);
    }
}
