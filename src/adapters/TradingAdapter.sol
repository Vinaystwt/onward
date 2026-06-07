// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "../lib/OnwardTypes.sol";
import {IVenueAdapter} from "../interfaces/IVenueAdapter.sol";
import {ConstantProductAMM} from "../venues/ConstantProductAMM.sol";

contract TradingAdapter is IVenueAdapter {
    address public immutable override venue;

    constructor(address venue_) {
        venue = venue_;
    }

    function domain() external pure override returns (bytes32) {
        return OnwardTypes.DOMAIN_TRADING;
    }

    function encodeAction(address, uint256, uint256 amount, bytes calldata params)
        external
        view
        override
        returns (address target, uint256 value, bytes memory data)
    {
        uint256 minOut = params.length == 0 ? 0 : abi.decode(params, (uint256));
        return (venue, amount, abi.encodeWithSelector(ConstantProductAMM.buyToken.selector, minOut));
    }
}
