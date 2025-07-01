// test_local_server.cjs
// A dedicated script to test YOUR local MCP server's SSE and RPC implementation.

"use strict";

const axios = require("axios");

// --- EventSource Polyfill (as provided) ---
(function (global) {
  if (global.EventSource) {
    return;
  }
  var EventSource = function (url, options) {
    if (!url || typeof url != "string") {
      throw new SyntaxError("Not enough arguments");
    }
    this.url = url;
    this.withCredentials = options ? options.withCredentials : false;
    this.listeners = {};
    this.xhr = null;
    this.readyState = this.CLOSED;
    this.lastEventId = "";
    var self = this;
    var headers = options ? options.headers : undefined;
    var stream = function () {
      self.readyState = self.CONNECTING;
      var xhr = new XMLHttpRequest();
      self.xhr = xhr;
      xhr.open("GET", self.url, true);
      if (headers) {
        for (var i in headers) {
          if (headers.hasOwnProperty(i)) {
            xhr.setRequestHeader(i, headers[i]);
          }
        }
      }
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      if (self.lastEventId) {
        xhr.setRequestHeader("Last-Event-ID", self.lastEventId);
      }
      xhr.onreadystatechange = function () {
        if (
          this.readyState == 3 ||
          (this.readyState == 4 && this.status == 200)
        ) {
          if (self.readyState == self.CONNECTING) {
            self.readyState = self.OPEN;
            self.dispatchEvent("open", { type: "open" });
          }
          var text = this.responseText;
          var last = self.xhr.last || 0;
          var parts = text.slice(last).split("\n");
          self.xhr.last = text.length;
          parts.forEach(function (part) {
            if (part.trim().length === 0) return;
            var event = { id: null, type: "message", data: "", retry: null };
            part.replace(
              /^(data|id|event|retry): ?(.*)$/gm,
              function (match, type, value) {
                if (type === "data") {
                  event.data += (event.data ? "\n" : "") + value;
                } else {
                  event[type] = value;
                }
              }
            );
            if (event.id) self.lastEventId = event.id;
            if (event.data) self.dispatchEvent(event.type, event);
          });
        } else if (this.readyState == 4) {
          self.readyState = self.CLOSED;
          self.dispatchEvent("error", { type: "error", status: this.status });
        }
      };
      xhr.send();
    };
    setTimeout(stream, 0);
  };
  EventSource.prototype = {
    CLOSED: 0,
    CONNECTING: 1,
    OPEN: 2,
    addEventListener: function (type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      if (this.listeners[type].indexOf(listener) == -1) {
        this.listeners[type].push(listener);
      }
    },
    removeEventListener: function (type, listener) {
      if (!this.listeners[type]) return;
      var filtered = [],
        i = 0,
        len = this.listeners[type].length;
      for (; i < len; ++i) {
        if (this.listeners[type][i] != listener) {
          filtered.push(this.listeners[type][i]);
        }
      }
      this.listeners[type] = filtered;
    },
    dispatchEvent: function (type, event) {
      var listeners = this.listeners[type];
      if (listeners) {
        let i = 0,
          len = listeners.length;
        for (; i < len; ++i) {
          listeners[i].call(this, event);
        }
      }
      if (this.onmessage) {
        this.onmessage.call(this, event);
      }
    },
    close: function () {
      if (this.readyState != this.CLOSED) {
        this.xhr.abort();
        this.readyState = this.CLOSED;
      }
    },
  };
  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  global.EventSource = EventSource;
})(typeof window == "undefined" ? global : window);
// --- End of Embedded Polyfill ---

// --- Configuration ---
const SERVER_BASE_URL = "http://localhost:9000";
// !!! IMPORTANT: Replace this with the token from your .env file !!!
const MCP_TOKEN = process.env.MCP_SERVER_TOKEN;

// --- Main Test Function ---
async function runLocalTest() {
  console.log("--- Starting Local MCP Server Test ---");

  if (MCP_TOKEN === "YOUR_MCP_SERVER_TOKEN_HERE") {
    console.error(
      "\n[ERROR] Please update the 'MCP_TOKEN' variable in this script before running."
    );
    return;
  }

  const sseUrl = `${SERVER_BASE_URL}/sse`;
  const headers = {
    Authorization: `Bearer ${MCP_TOKEN}`,
  };

  let rpcPath = null;
  let testState = "AwaitingHandshake";

  console.log(`[ACTION] Making GET request to: ${sseUrl}`);
  const eventSource = new EventSource(sseUrl, { headers });

  eventSource.onopen = () => {
    console.log("[STATUS] Connection successful. Listening for events...");
  };

  eventSource.onerror = (err) => {
    if (err && err.type === "error" && err.status === undefined) {
      return;
    }
    console.error("\n[ERROR] A stream error occurred:", err);
    eventSource.close();
  };

  // Unified handler to log all incoming events from the stream
  eventSource.onmessage = async (event) => {
    console.log("\n================================================");
    console.log(`[RAW STREAM DATA @ ${new Date().toLocaleTimeString()}] ---->`);
    // Manually construct the raw string to log it accurately
    if (event.type !== "message") {
      process.stdout.write(`event: ${event.type}\n`);
    }
    process.stdout.write(`data: ${event.data}\n\n`);
    console.log("<---- [END OF CHUNK]");
    console.log("================================================");

    // --- Logic to drive the test forward ---

    // Step 1: Handle the 'endpoint' handshake
    if (event.type === "endpoint") {
      rpcPath = event.data;
      console.log(`\n[PARSED INFO] Extracted RPC Path: ${rpcPath}`);
      await listTools(rpcPath);
    }

    // Step 2: Handle the 'ping' keep-alive (just log it)
    else if (event.type === "ping") {
      console.log(`\n[PARSED INFO] Keep-alive ping received.`);
    }

    // Step 3: Handle default messages containing JSON-RPC results
    else if (event.type === "message") {
      try {
        const result = JSON.parse(event.data);

        // Check for progress notifications from a tool call
        if (result.method === "notifications/progress") {
          console.log(
            `\n[PARSED INFO] Received tool progress notification: "${result.params.message}"`
          );
        }
        // Check for a tool list result
        else if (result.result?.tools) {
          console.log("\n[PARSED INFO] Received tool list response.");
          await callSearchTool(rpcPath);
        }
        // Check for a final tool call result
        else if (result.result?.content) {
          console.log("\n[PARSED INFO] Received final tool call result.");
          console.log("--------------------------------------");
          console.log("[SUCCESS] Full test sequence completed successfully!");
          eventSource.close();
        }
        // Check for an error
        else if (result.error) {
          console.error(
            "[FAIL]   Test failed. Server returned an error:",
            result.error.message
          );
          eventSource.close();
        }
      } catch (e) {
        // Ignore parsing errors for non-JSON messages
      }
    }
  };

  // --- Test Step Functions ---

  async function listTools(path) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.0",
      id: "local-test-list-1",
      method: "tools/list",
      params: {},
    };

    console.log(`\n[ACTION] Sending 'tools/list' command to ${fullRpcUrl}`);
    testState = "AwaitingToolList";
    await axios.post(fullRpcUrl, payload, { headers });
  }

  async function callSearchTool(path) {
    const fullRpcUrl = `${SERVER_BASE_URL}${path}`;
    const payload = {
      jsonrpc: "2.0",
      id: "local-test-call-1",
      method: "tools/call",
      params: {
        name: "search_engine",
        arguments: { query: "What is the Model Context Protocol?" },
      },
    };

    console.log(
      `\n[ACTION] Sending 'tools/call' for 'search_engine' to ${fullRpcUrl}`
    );
    testState = "AwaitingToolResult";
    await axios.post(fullRpcUrl, payload, { headers });
  }
}

// Run the test
runLocalTest();
