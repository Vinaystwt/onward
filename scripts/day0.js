import { ethers } from "ethers";
import {
  build,
  contractAt,
  parseEvent,
  readDeployments,
  waitFor,
  wallet,
  writeJson
} from "./lib.js";

async function main() {
  build();
  const deployments = readDeployments();
  const signer = wallet();
  const primitive = contractAt(
    "PrimitiveSpike.sol",
    "PrimitiveSpike",
    deployments.contracts.PrimitiveSpike.address,
    signer
  );

  const jsonDeposit = await primitive.requiredJsonDeposit();
  const priceStart = Date.now();
  const priceReceipt = await (await primitive.requestBitcoinPrice({ value: jsonDeposit })).wait();
  const priceEvent = parseEvent(primitive, priceReceipt, "PriceRequested");
  const priceRequestId = priceEvent.args.requestId;
  console.log(`BTC price request ${priceRequestId}`);

  await waitFor(
    async () => {
      const pending = await primitive.pendingRequests(priceRequestId);
      if (!pending) return true;
      return false;
    },
    "BTC primitive callback"
  );
  const latestPrice = await primitive.latestBtcPrice();
  if (latestPrice === 0n) throw new Error("BTC primitive callback finished without a price");
  const priceEnd = Date.now();
  const requestedAt = await primitive.latestPriceRequestedAt();
  const receivedAt = await primitive.latestPriceReceivedAt();

  const inferenceDeposit = await primitive.requiredInferenceDeposit();
  const inferReceiptA = await (await primitive.requestDeterministicInference({ value: inferenceDeposit })).wait();
  const inferReceiptB = await (await primitive.requestDeterministicInference({ value: inferenceDeposit })).wait();
  const inferRequestA = parseEvent(primitive, inferReceiptA, "InferRequested").args.requestId;
  const inferRequestB = parseEvent(primitive, inferReceiptB, "InferRequested").args.requestId;
  console.log(`inference requests ${inferRequestA}, ${inferRequestB}`);

  await waitFor(async () => !(await primitive.pendingRequests(inferRequestA)), "first inference callback");
  await waitFor(async () => !(await primitive.pendingRequests(inferRequestB)), "second inference callback");

  const outputA = await primitive.inferOutputs(inferRequestA);
  const outputB = await primitive.inferOutputs(inferRequestB);
  const rawA = await primitive.rawOutputs(inferRequestA);
  const rawB = await primitive.rawOutputs(inferRequestB);
  if (!outputA || !outputB) throw new Error("Inference callback finished without both outputs");

  const result = {
    generatedAt: new Date().toISOString(),
    primitive: deployments.contracts.PrimitiveSpike.address,
    btcPriceRequestId: priceRequestId.toString(),
    btcPriceScaled8: latestPrice.toString(),
    callbackLatencySecondsWallClock: Math.round((priceEnd - priceStart) / 1000),
    callbackLatencySecondsBlockClock: (receivedAt - requestedAt).toString(),
    inferRequestIds: [inferRequestA.toString(), inferRequestB.toString()],
    inferOutputs: [outputA, outputB],
    inferRawOutputs: [rawA, rawB],
    byteIdentical: rawA === rawB,
    jsonDepositStt: ethers.formatEther(jsonDeposit),
    inferenceDepositStt: ethers.formatEther(inferenceDeposit)
  };

  writeJson("day0-results.json", result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
