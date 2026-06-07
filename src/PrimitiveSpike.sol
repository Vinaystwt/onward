// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAgentRequester, IAgentRequesterHandler, Request, Response, ResponseStatus} from "./interfaces/IAgentRequester.sol";
import {IJsonApiAgent, ILLMAgent} from "./interfaces/IBaseAgents.sol";
import {AgentCodec} from "./lib/AgentCodec.sol";

contract PrimitiveSpike is IAgentRequesterHandler {
    enum RequestKind {
        None,
        BtcPrice,
        InferString
    }

    IAgentRequester public immutable platform;
    address public owner;

    uint256 public latestBtcPrice;
    uint256 public latestPriceRequestId;
    uint256 public latestPriceRequestedAt;
    uint256 public latestPriceReceivedAt;

    mapping(uint256 => bool) public pendingRequests;
    mapping(uint256 => RequestKind) public requestKinds;
    mapping(uint256 => string) public inferOutputs;
    mapping(uint256 => bytes) public rawOutputs;

    event PriceRequested(uint256 indexed requestId);
    event PriceReceived(uint256 indexed requestId, uint256 price, uint256 latencySeconds);
    event InferRequested(uint256 indexed requestId);
    event InferReceived(uint256 indexed requestId, string output);
    event RequestFailed(uint256 indexed requestId, ResponseStatus status);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address platform_) {
        platform = IAgentRequester(platform_);
        owner = msg.sender;
    }

    receive() external payable {}

    function requestBitcoinPrice() external payable onlyOwner returns (uint256 requestId) {
        uint256 deposit = requiredJsonDeposit();
        require(msg.value >= deposit, "UNDERFUNDED");
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            "bitcoin.usd",
            uint8(8)
        );
        requestId = platform.createRequest{value: deposit}(
            AgentCodec.JSON_API_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );
        latestPriceRequestId = requestId;
        latestPriceRequestedAt = block.timestamp;
        pendingRequests[requestId] = true;
        requestKinds[requestId] = RequestKind.BtcPrice;
        _refundExtra(msg.value, deposit);
        emit PriceRequested(requestId);
    }

    function requestDeterministicInference() external payable onlyOwner returns (uint256 requestId) {
        uint256 deposit = requiredInferenceDeposit();
        require(msg.value >= deposit, "UNDERFUNDED");
        string[] memory allowed = new string[](2);
        allowed[0] = "yes";
        allowed[1] = "no";
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            "Return yes if 2 plus 2 equals 4. Return no otherwise.",
            "You are a deterministic classifier. Return only an allowed value.",
            false,
            allowed
        );
        requestId = platform.createRequest{value: deposit}(
            AgentCodec.LLM_INFERENCE_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );
        pendingRequests[requestId] = true;
        requestKinds[requestId] = RequestKind.InferString;
        _refundExtra(msg.value, deposit);
        emit InferRequested(requestId);
    }

    function requiredJsonDeposit() public view returns (uint256) {
        return platform.getRequestDeposit() + AgentCodec.JSON_PRICE_PER_AGENT * AgentCodec.SUBCOMMITTEE_SIZE;
    }

    function requiredInferenceDeposit() public view returns (uint256) {
        return platform.getRequestDeposit() + AgentCodec.LLM_PRICE_PER_AGENT * AgentCodec.SUBCOMMITTEE_SIZE;
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external override {
        require(msg.sender == address(platform), "ONLY_PLATFORM");
        require(pendingRequests[requestId], "UNKNOWN_REQUEST");
        pendingRequests[requestId] = false;

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit RequestFailed(requestId, status);
            return;
        }

        rawOutputs[requestId] = responses[0].result;
        if (requestKinds[requestId] == RequestKind.BtcPrice) {
            latestBtcPrice = abi.decode(responses[0].result, (uint256));
            latestPriceReceivedAt = block.timestamp;
            emit PriceReceived(requestId, latestBtcPrice, latestPriceReceivedAt - latestPriceRequestedAt);
            return;
        }

        string memory output = abi.decode(responses[0].result, (string));
        inferOutputs[requestId] = output;
        emit InferReceived(requestId, output);
    }

    function _refundExtra(uint256 paid, uint256 deposit) internal {
        if (paid > deposit) {
            (bool ok,) = msg.sender.call{value: paid - deposit}("");
            require(ok, "REFUND_FAILED");
        }
    }
}
