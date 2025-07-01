// test_brightdata_mcp.js
// A test script to connect to the Bright Data MCP SSE endpoint, perform the handshake, list tools, and call a tool.

"use strict";

const axios = require("axios");

// --- EventSource Polyfill for Node.js ---
// This is a corrected polyfill that properly handles SSE event framing.
(function (global) {
  if (global.EventSource) return;

  const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

  global.EventSource = function (url, options) {
    this.url = url;
    this.listeners = {};
    this.xhr = new XMLHttpRequest();
    this.readyState = this.CONNECTING;
    this.lastEventId = "";

    let lastPosition = 0;
    const self = this;

    function dispatchEvent(type, event) {
      if (self.listeners[type]) {
        self.listeners[type].forEach((listener) => listener.call(self, event));
      }
      if (self[`on${type}`]) {
        self[`on${type}`].call(self, event);
      }
    }

    this.xhr.open("GET", url, true);
    if (options && options.headers) {
      for (const i in options.headers) {
        this.xhr.setRequestHeader(i, options.headers[i]);
      }
    }
    this.xhr.setRequestHeader("Accept", "text/event-stream");
    this.xhr.setRequestHeader("Cache-Control", "no-cache");

    this.xhr.onreadystatechange = () => {
      if (self.readyState === self.CLOSED) return;

      if (this.xhr.readyState === 4) {
        self.readyState = self.CLOSED;
        dispatchEvent("error", { type: "error", status: this.xhr.status });
        return;
      }

      if (this.xhr.readyState >= 3 && self.readyState === self.CONNECTING) {
        self.readyState = self.OPEN;
        dispatchEvent("open", { type: "open" });
      }

      if (this.xhr.readyState >= 3) {
        const newText = this.xhr.responseText.substring(lastPosition);
        if (lastPosition === this.xhr.responseText.length) return;
        lastPosition = this.xhr.responseText.length;

        // SSE events are separated by double newlines.
        const events = newText.split(/\n\n/);

        for (const eventText of events) {
          if (eventText.trim().length === 0) continue;

          const event = { type: "message", data: [], id: null };

          for (const line of eventText.split("\n")) {
            // Ignore comment lines
            if (line.startsWith(":")) continue;

            const match = /^(id|event|data|retry): ?(.*)$/.exec(line);
            if (!match) continue;

            const field = match[1];
            const value = match[2];

            if (field === "event") {
              event.type = value;
            } else if (field === "data") {
              event.data.push(value);
            } else if (field === "id") {
              event.id = value;
              self.lastEventId = value;
            }
          }

          event.data = event.data.join("\n");
          // Only dispatch if we have some data to process
          if (event.data) {
            dispatchEvent(event.type, event);
          }
        }
      }
    };

    this.xhr.send();
  };

  global.EventSource.prototype = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
    addEventListener: function (type, listener) {
      if (!this.listeners[type]) this.listeners[type] = [];
      if (this.listeners[type].indexOf(listener) === -1) {
        this.listeners[type].push(listener);
      }
    },
    close: function () {
      this.readyState = this.CLOSED;
      this.xhr.abort();
    },
  };
})(typeof window == "undefined" ? global : window);
// --- End of Polyfill ---

// --- ⚙️ Configuration ---
const SERVER_BASE_URL = "https://brightdata-mcp.maximoai.co";
// ❗ IMPORTANT: Replace this with your actual authentication token!
const MCP_TOKEN = process.env.MCP_SERVER_TOKEN;

// --- Main Test Function ---
async function runTest() {
  console.log("--- Starting Bright Data MCP Test ---");

  const sseUrl = `${SERVER_BASE_URL}/sse`;
  const headers = {
    Authorization: `Bearer ${MCP_TOKEN}`,
  };

  let rpcPath = null;
  let handshakeComplete = false;

  console.log(`[ACTION] Connecting to SSE endpoint: ${sseUrl}`);
  const eventSource = new EventSource(sseUrl, { headers });

  eventSource.onopen = () => {
    console.log("[✅ STATUS] Connection successful. Awaiting handshake...");
  };

  eventSource.onerror = (err) => {
    if (err && err.type === "error" && err.status === undefined) {
      return;
    }
    console.error(
      "\n[❌ ERROR] A stream error occurred. This is often due to an invalid token."
    );
    console.error("Server response status:", err.status || "Not available");
    eventSource.close();
  };

  const eventHandler = async (event) => {
    console.log("\n================================================");
    console.log(`[STREAM DATA @ ${new Date().toLocaleTimeString()}]`);
    console.log(`EVENT: ${event.type}`);
    console.log(`DATA:  ${event.data}`);
    console.log("================================================");

    // Step 1: Handle the 'endpoint' event to get the RPC path
    if (event.type === "endpoint" && !rpcPath) {
      rpcPath = event.data;
      console.log(`\n[INFO] Extracted RPC Path: ${rpcPath}`);
      console.log(`\n[ACTION] Sending 'initialize' command...`);
      await sendInitialize(rpcPath);
    }

    // Step 2: Handle incoming 'message' events (which contain JSON-RPC)
    else if (event.type === "message") {
      try {
        const result = JSON.parse(event.data);

        // Handle the response to our 'initialize' command
        if (result.id === "test-init-1" && !handshakeComplete) {
          console.log(
            "\n[INFO] Received initialize response. Handshake step 1 complete."
          );
          console.log("\n[ACTION] Sending 'notifications/initialized'...");
          await sendInitializedNotification(rpcPath);
          handshakeComplete = true;
          console.log("\n[INFO] Handshake complete. Now requesting tool list.");
          await listTools(rpcPath);
        }

        // Handle tool progress notifications
        else if (result.method === "notifications/progress") {
          console.log(`\n[⏳ PROGRESS] ${result.params.message}`);
        }
        // Handle the response from 'tools/list'
        else if (result.id === "test-list-1") {
          console.log("\n[INFO] Received tool list.");
          const toolToCall = result.result.tools.find(
            (t) => t.name === "search_engine"
          );
          if (toolToCall) {
            await callTool(rpcPath, toolToCall.name, {
              query: "What is Bright Data?",
            });
          } else {
            console.error(
              "[❌ ERROR] Could not find 'search_engine' tool in the list."
            );
            eventSource.close();
          }
        }
        // Handle the final result from 'tools/call'
        else if (result.id === "test-call-1") {
          console.log("\n[✅ SUCCESS] Received final tool call result.");
          console.log("--------------------------------------");
          console.log(result.result.content[0].text);
          console.log("--------------------------------------");
          console.log("Test sequence completed successfully!");
          eventSource.close();
        }
        // Handle any errors from the server
        else if (result.error) {
          console.error(
            `[❌ ERROR] Test failed. Server returned an error: ${result.error.message}`
          );
          eventSource.close();
        }
      } catch (e) {
        console.warn(
          "[⚠️ WARNING] Could not parse incoming data as JSON. Data:",
          event.data
        );
      }
    }
  };

  eventSource.addEventListener("endpoint", eventHandler);
  eventSource.addEventListener("message", eventHandler);
  eventSource.onping = () => console.log("\n[INFO] Server ping received.");

  // --- Helper functions to make RPC calls ---

  async function sendInitialize(path) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.0",
      id: "test-init-1",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
      },
    };
    try {
      await axios.post(fullRpcUrl, payload, { headers });
    } catch (e) {
      console.error(`[❌ ERROR] Failed to post 'initialize': ${e.message}`);
      eventSource.close();
    }
  }

  async function sendInitializedNotification(path) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    };
    try {
      await axios.post(fullRpcUrl, payload, { headers });
    } catch (e) {
      console.error(
        `[❌ ERROR] Failed to post 'notifications/initialized': ${e.message}`
      );
      eventSource.close();
    }
  }

  async function listTools(path) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.0",
      id: "test-list-1",
      method: "tools/list",
      params: {},
    };

    console.log(`\n[ACTION] Sending 'tools/list' command to ${fullRpcUrl}`);
    try {
      await axios.post(fullRpcUrl, payload, { headers });
    } catch (e) {
      console.error(`[❌ ERROR] Failed to post 'tools/list': ${e.message}`);
      eventSource.close();
    }
  }

  async function callTool(path, toolName, argsObject) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.c",
      id: "test-call-1",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: argsObject,
      },
    };

    console.log(
      `\n[ACTION] Sending 'tools/call' for '${toolName}' with query: "${argsObject.query}"`
    );
    try {
      await axios.post(fullRpcUrl, payload, { headers });
    } catch (e) {
      console.error(`[❌ ERROR] Failed to post 'tools/call': ${e.message}`);
      eventSource.close();
    }
  }
}

// Run the test
runTest();
