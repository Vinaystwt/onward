// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJsonApiAgent {
    function fetchString(string calldata url, string calldata selector) external returns (string memory);
    function fetchUint(string calldata url, string calldata selector, uint8 decimals) external returns (uint256);
    function fetchInt(string calldata url, string calldata selector, uint8 decimals) external returns (int256);
    function fetchBool(string calldata url, string calldata selector) external returns (bool);
}

interface ILLMAgent {
    struct OnchainTool {
        string signature;
        string description;
    }

    function inferString(
        string calldata prompt,
        string calldata system,
        bool chainOfThought,
        string[] calldata allowedValues
    ) external returns (string memory response);

    function inferNumber(
        string calldata prompt,
        string calldata system,
        int256 minValue,
        int256 maxValue,
        bool chainOfThought
    ) external returns (int256 response);
}

interface IParseWebsiteAgent {
    function ExtractANumber(
        string memory key,
        string memory description,
        uint256 min,
        uint256 max,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (uint256);

    function ExtractString(
        string memory key,
        string memory description,
        string[] calldata options,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (string memory);
}
