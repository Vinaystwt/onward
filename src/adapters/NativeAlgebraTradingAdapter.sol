// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVenueAdapter} from "../interfaces/IVenueAdapter.sol";
import {OnwardTypes} from "../lib/OnwardTypes.sol";

interface IAlgebraExactInputRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

contract NativeAlgebraTradingAdapter is IVenueAdapter {
    bytes4 public constant EXACT_INPUT_SELECTOR = IAlgebraExactInputRouter.exactInput.selector;
    uint256 public constant DEFAULT_DEADLINE_BUFFER = 10 minutes;

    address public immutable override venue;
    address public immutable recipient;

    constructor(address router_, address recipient_) {
        require(router_ != address(0), "BAD_ROUTER");
        require(recipient_ != address(0), "BAD_RECIPIENT");
        venue = router_;
        recipient = recipient_;
    }

    function domain() external pure override returns (bytes32) {
        return OnwardTypes.DOMAIN_TRADING;
    }

    function encodeAction(address, uint256, uint256 value, bytes calldata params)
        external
        view
        override
        returns (address target, uint256 callValue, bytes memory data)
    {
        (bytes memory path, uint256 amountOutMinimum, uint256 deadline) = abi.decode(params, (bytes, uint256, uint256));
        require(value > 0, "ZERO_VALUE");
        require(path.length >= 60, "PATH_TOO_SHORT");
        require((path.length - 20) % 40 == 0, "BAD_PATH_STRIDE");

        uint256 swapDeadline = deadline == 0 ? block.timestamp + DEFAULT_DEADLINE_BUFFER : deadline;
        data = abi.encodeWithSelector(
            IAlgebraExactInputRouter.exactInput.selector,
            IAlgebraExactInputRouter.ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: swapDeadline,
                amountIn: value,
                amountOutMinimum: amountOutMinimum
            })
        );
        return (venue, value, data);
    }
}
