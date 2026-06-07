// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    ConsensusType,
    IAgentRequester,
    IAgentRequesterHandler,
    Request,
    Response,
    ResponseStatus
} from "../../src/interfaces/IAgentRequester.sol";

contract MockAgentPlatform is IAgentRequester {
    struct StoredRequest {
        uint256 id;
        uint256 agentId;
        address requester;
        address callbackAddress;
        bytes4 callbackSelector;
        bytes payload;
        uint256 value;
    }

    uint256 public nextRequestId = 1;
    uint256 public deposit = 0.03 ether;
    uint256 public lastRequestId;
    mapping(uint256 => StoredRequest) public storedRequests;

    function setDeposit(uint256 deposit_) external {
        deposit = deposit_;
    }

    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId) {
        requestId = nextRequestId++;
        lastRequestId = requestId;
        storedRequests[requestId] = StoredRequest({
            id: requestId,
            agentId: agentId,
            requester: msg.sender,
            callbackAddress: callbackAddress,
            callbackSelector: callbackSelector,
            payload: payload,
            value: msg.value
        });
        address[] memory subcommittee = new address[](1);
        subcommittee[0] = address(0xBEEF);
        emit RequestCreated(requestId, agentId, msg.value, payload, subcommittee);
    }

    function createAdvancedRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload,
        uint256,
        uint256,
        ConsensusType,
        uint256
    ) external payable returns (uint256 requestId) {
        requestId = this.createRequest{value: msg.value}(agentId, callbackAddress, callbackSelector, payload);
    }

    function getRequest(uint256 requestId) external view returns (Request memory request) {
        StoredRequest storage stored = storedRequests[requestId];
        request.id = stored.id;
        request.requester = stored.requester;
        request.callbackAddress = stored.callbackAddress;
        request.callbackSelector = stored.callbackSelector;
        request.status = ResponseStatus.Pending;
        request.createdAt = block.timestamp;
        request.deadline = block.timestamp + 15 minutes;
    }

    function hasRequest(uint256 requestId) external view returns (bool) {
        return storedRequests[requestId].id != 0;
    }

    function getRequestDeposit() external view returns (uint256) {
        return deposit;
    }

    function getAdvancedRequestDeposit(uint256 subcommitteeSize) external view returns (uint256) {
        return deposit * subcommitteeSize / 3;
    }

    function fulfillUint(uint256 requestId, uint256 value) external {
        _fulfill(requestId, abi.encode(value), ResponseStatus.Success);
    }

    function fulfillString(uint256 requestId, string calldata value) external {
        _fulfill(requestId, abi.encode(value), ResponseStatus.Success);
    }

    function fail(uint256 requestId, ResponseStatus status) external {
        require(status != ResponseStatus.Success, "USE_FULFILL");
        _fulfill(requestId, "", status);
    }

    function _fulfill(uint256 requestId, bytes memory result, ResponseStatus status) internal {
        StoredRequest storage stored = storedRequests[requestId];
        Response[] memory responses = new Response[](status == ResponseStatus.Success ? 1 : 0);
        if (status == ResponseStatus.Success) {
            responses[0] = Response({
                validator: address(0xBEEF),
                result: result,
                status: ResponseStatus.Success,
                receipt: 1,
                timestamp: block.timestamp,
                executionCost: 0.01 ether
            });
        }

        Request memory request;
        request.id = requestId;
        request.requester = stored.requester;
        request.callbackAddress = stored.callbackAddress;
        request.callbackSelector = stored.callbackSelector;
        request.status = status;

        IAgentRequesterHandler(stored.callbackAddress).handleResponse(requestId, responses, status, request);
    }
}
