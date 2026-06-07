// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnwardTypes} from "../lib/OnwardTypes.sol";
import {IVenueAdapter} from "../interfaces/IVenueAdapter.sol";
import {MiniLendingPool} from "../venues/MiniLendingPool.sol";

contract LendingAdapter is IVenueAdapter {
    address public immutable override venue;

    constructor(address venue_) {
        venue = venue_;
    }

    function domain() external pure override returns (bytes32) {
        return OnwardTypes.DOMAIN_LENDING;
    }

    function encodeAction(address, uint256, uint256 amount, bytes calldata)
        external
        view
        override
        returns (address target, uint256 value, bytes memory data)
    {
        return (venue, amount, abi.encodeWithSelector(MiniLendingPool.supply.selector));
    }
}
