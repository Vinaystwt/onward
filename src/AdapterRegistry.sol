// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableLite} from "./lib/OwnableLite.sol";

contract AdapterRegistry is OwnableLite {
    mapping(bytes32 => address) public adapters;

    event AdapterSet(bytes32 indexed domain, address indexed adapter);

    function setAdapter(bytes32 domain, address adapter) external onlyOwner {
        require(domain != bytes32(0), "BAD_DOMAIN");
        require(adapter != address(0), "BAD_ADAPTER");
        adapters[domain] = adapter;
        emit AdapterSet(domain, adapter);
    }

    function adapterFor(bytes32 domain) external view returns (address adapter) {
        adapter = adapters[domain];
        require(adapter != address(0), "ADAPTER_MISSING");
    }
}
