// test_raw_stream.cjs
// A low-level test script to log the RAW data stream from an MCP server.
// This version correctly calls a tool that the server provides.

"use strict";

const axios = require("axios");

// --- Configuration ---
const TARGET_SERVER_URL = "https://mcp.deepwiki.com/sse";
const BASE_URL = "https://mcp.deepwiki.com";

// --- Main Test Function ---
async function runRawStreamTest() {
  console.log("--- Starting Raw SSE Stream Test ---");
  console.log(`[ACTION] Making low-level GET request to: ${TARGET_SERVER_URL}`);

  try {
    const response = await axios({
      method: "get",
      url: TARGET_SERVER_URL,
      responseType: "stream",
    });

    const stream = response.data;
    let rpcPath = null;
    let testState = "AwaitingHandshake"; // We'll use this to track our progress

    console.log(
      "[STATUS] Connection successful. Listening for raw data chunks..."
    );

    stream.on("data", (chunk) => {
      const rawData = chunk.toString();
      console.log("\n================================================");
      console.log(
        `[RAW STREAM DATA @ ${new Date().toLocaleTimeString()}] ---->`
      );
      process.stdout.write(rawData); // Write the exact chunk to the console
      console.log("<---- [END OF CHUNK]");
      console.log("================================================");

      // --- Simple parser to drive the test forward ---

      // Step 1: Look for the handshake to get the RPC path
      if (
        testState === "AwaitingHandshake" &&
        rawData.includes("event: endpoint")
      ) {
        const match = rawData.match(/data: (.*)/);
        if (match && match[1]) {
          rpcPath = match[1].trim();
          console.log(`\n[PARSED INFO] Extracted RPC Path: ${rpcPath}`);
          // Trigger the tools/list call
          listTools(rpcPath);
        }
      }
      // Step 2: Look for the tool list response and decide which tool to call next
      else if (
        testState === "AwaitingToolList" &&
        rawData.includes('"tools"')
      ) {
        console.log("\n[PARSED INFO] Received tool list response.");
        try {
          // Extract the JSON part of the data
          const jsonString = rawData.match(/data: (.*)/s)[1];
          const responseJson = JSON.parse(jsonString);
          const availableTools = responseJson.result?.tools || [];

          // Find the 'ask_question' tool from the list
          const toolToCall = availableTools.find(
            (t) => t.name === "ask_question"
          );

          if (toolToCall) {
            console.log(
              `[INFO] Found tool '${toolToCall.name}'. Now triggering a tool call...`
            );
            // Call the tool with the correct parameters
            callTool(rpcPath, toolToCall.name, {
              repoName: "facebook/react",
              question: "What are React Hooks?",
            });
          } else {
            console.log(
              "[INFO] Could not find a suitable tool to call in the list. Ending test."
            );
            stream.destroy();
          }
        } catch (e) {
          console.error(
            "[ERROR] Failed to parse tool list to find a tool to call.",
            e
          );
          stream.destroy();
        }
      }
      // Step 3: Look for the tool call response and end the test
      else if (
        testState === "AwaitingToolResult" &&
        (rawData.includes('"content"') || rawData.includes('"error"'))
      ) {
        console.log("\n[PARSED INFO] Received tool call result.");
        console.log("--------------------------------------");
        console.log("[SUCCESS] Full test sequence completed successfully!");
        stream.destroy(); // End the connection
        process.exit(0);
      }
    });

    stream.on("end", () => {
      console.log("\n[STATUS] The stream has been closed by the server.");
    });

    stream.on("error", (err) => {
      console.error("\n[ERROR] A stream error occurred:", err);
    });

    // --- Test Step Functions ---

    async function listTools(path) {
      const fullRpcUrl = `${BASE_URL}${path}`;
      const payload = {
        jsonrpc: "2.0",
        id: "raw-test-list-1",
        method: "tools/list",
        params: {},
      };

      console.log(`\n[ACTION] Sending 'tools/list' command to ${fullRpcUrl}`);
      testState = "AwaitingToolList";
      await axios.post(fullRpcUrl, payload);
    }

    async function callTool(path, toolName, argsObject) {
      const fullRpcUrl = `${BASE_URL}${path}`;
      const payload = {
        jsonrpc: "2.0",
        id: "raw-test-call-1",
        method: "tools/call",
        params: { name: toolName, arguments: argsObject },
      };

      console.log(
        `\n[ACTION] Sending 'tools/call' for '${toolName}' to ${fullRpcUrl}`
      );
      console.log(`[INFO]   With arguments: ${JSON.stringify(argsObject)}`);
      testState = "AwaitingToolResult";
      await axios.post(fullRpcUrl, payload);
    }
  } catch (error) {
    console.error("[ERROR] Could not establish initial connection.");
    console.error(error.message);
  }
}

// Run the test
runRawStreamTest();
