#!/usr/bin/env node
"use strict"; /*jslint node:true es9:true*/
console.log("Starting MCP Server...");

// Imports
import express from "express";
import cors from "cors";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import axios from "axios";
import { tools as browser_tools } from "./browser_tools.js";
import { createRequire } from "node:module";
import pino from "pino";

// --- Logger Setup ---
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
  },
});

// --- Express Server Setup ---
const app = express();
const PORT = process.env.PORT || 9000;
app.use(cors());
app.use(express.json());

// --- Environment & Config ---
const mcp_server_token = process.env.MCP_SERVER_TOKEN;
if (!mcp_server_token) {
  throw new Error("MCP_SERVER_TOKEN is not defined in your .env file.");
}

const require = createRequire(import.meta.url);
const package_json = require("./package.json");
const api_token = process.env.API_TOKEN;
const unlocker_zone = process.env.WEB_UNLOCKER_ZONE || "mcp_unlocker";

const sseSessions = new Map();
const toolRegistry = {};
const underlyingToolExecutors = {};

// --- SSE Message Sending Function ---
const encoder = new TextEncoder();
function sendSseMessage(res, data, eventName) {
  if (res.writableEnded) {
    return;
  }
  let payload = "";
  if (eventName) {
    payload += `event: ${eventName}\n`;
  }
  const dataString =
    typeof data === "object" && data !== null ? JSON.stringify(data) : data;
  payload += `data: ${dataString}\n\n`;
  res.write(encoder.encode(payload));
}

// --- Authentication ---
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: Missing Bearer token");
  }
  const token = authHeader.substring(7);
  if (token !== mcp_server_token) {
    return res.status(403).send("Forbidden: Invalid token");
  }
  next();
};

// --- Tool Registration & Helpers ---
function addTool(toolDef) {
  toolRegistry[toolDef.name] = toolDef;
}

function tool_fn(name, fn) {
  return async (data, ctx) => {
    logger.info({ toolName: name, args: data }, "Executing tool");
    return fn(data, ctx);
  };
}

const api_headers = () => ({
  "user-agent": `${package_json.name}/${package_json.version}`,
  authorization: `Bearer ${api_token}`,
});

// --- Base Tool Definitions ---
addTool({
  name: "search_engine",
  description: "Scrape search results from Google, Bing or Yandex.",
  parameters: z.object({
    query: z.string(),
    engine: z.enum(["google", "bing", "yandex"]).optional().default("google"),
  }),
  execute: tool_fn("search_engine", async ({ query, engine }) => {
    const search_url = `https://${engine}.com/search?q=${encodeURIComponent(
      query
    )}`;
    let response = await axios({
      url: "https://api.brightdata.com/request",
      method: "POST",
      data: {
        url: search_url,
        zone: unlocker_zone,
        format: "raw",
        data_format: "markdown",
      },
      headers: api_headers(),
      responseType: "text",
    });
    return response.data;
  }),
});
addTool({
  name: "scrape",
  description:
    "Scrape a single webpage URL, returning content in markdown or HTML.",
  parameters: z.object({
    url: z.string().url(),
    format: z.enum(["markdown", "html"]).default("markdown"),
  }),
  execute: tool_fn("scrape", async ({ url, format }) => {
    let response = await axios({
      url: "https://api.brightdata.com/request",
      method: "POST",
      data: { url, zone: unlocker_zone, format: "raw", data_format: format },
      headers: api_headers(),
      responseType: "text",
    });
    return response.data;
  }),
});

// --- Super-Grouping Tool Architecture ---
const datasets = [
  {
    id: "amazon_product",
    group: "e_commerce",
    site: "amazon",
    task_desc: "Get data for a single product.",
    inputs: ["url"],
  },
  {
    id: "amazon_product_reviews",
    group: "e_commerce",
    site: "amazon",
    task_desc: "Get reviews for a product.",
    inputs: ["url"],
  },
  {
    id: "walmart_product",
    group: "e_commerce",
    site: "walmart",
    task_desc: "Get data from a Walmart product page.",
    inputs: ["url"],
  },
  {
    id: "ebay_product",
    group: "e_commerce",
    site: "ebay",
    task_desc: "Get data from an eBay product page.",
    inputs: ["url"],
  },
  {
    id: "linkedin_person_profile",
    group: "social_professional",
    site: "linkedin",
    task_desc: "Get data from a LinkedIn user profile.",
    inputs: ["url"],
  },
  {
    id: "linkedin_company_profile",
    group: "social_professional",
    site: "linkedin",
    task_desc: "Get data from a LinkedIn company profile.",
    inputs: ["url"],
  },
  {
    id: "instagram_posts",
    group: "social_professional",
    site: "instagram",
    task_desc: "Get data for an Instagram post.",
    inputs: ["url"],
  },
  {
    id: "facebook_posts",
    group: "social_professional",
    site: "facebook",
    task_desc: "Get data for a Facebook post.",
    inputs: ["url"],
  },
  {
    id: "tiktok_posts",
    group: "social_professional",
    site: "tiktok",
    task_desc: "Get data for a TikTok post.",
    inputs: ["url"],
  },
  {
    id: "x_posts",
    group: "social_professional",
    site: "x",
    task_desc: "Get data for an X (Twitter) post.",
    inputs: ["url"],
  },
  {
    id: "youtube_videos",
    group: "social_professional",
    site: "youtube",
    task_desc: "Get data for a YouTube video.",
    inputs: ["url"],
  },
  {
    id: "Maps_reviews",
    group: "business_data",
    site: "Maps",
    task_desc: "Get reviews for a business from Google Maps.",
    inputs: ["url"],
  },
  {
    id: "crunchbase_company",
    group: "business_data",
    site: "crunchbase",
    task_desc: "Get structured data for a company from Crunchbase.",
    inputs: ["url"],
  },
  {
    id: "yahoo_finance_business",
    group: "business_data",
    site: "yahoo_finance",
    task_desc:
      "Get structured financial data for a business from Yahoo Finance.",
    inputs: ["url"],
  },
];

const superGroups = datasets.reduce((acc, tool) => {
  if (!acc[tool.group]) {
    acc[tool.group] = {
      sites: {},
      allParams: {},
      description: `Performs data scraping from ${tool.group.replace(
        "_",
        " "
      )} sites.\n\n`,
    };
  }
  if (!acc[tool.group].sites[tool.site]) {
    acc[tool.group].sites[tool.site] = [];
  }
  acc[tool.group].sites[tool.site].push(tool);
  tool.inputs.forEach(
    (input) =>
      (acc[tool.group].allParams[input] = (
        input === "url" ? z.string().url() : z.string()
      ).optional())
  );
  return acc;
}, {});

for (const groupName in superGroups) {
  const group = superGroups[groupName];
  const siteNames = Object.keys(group.sites);

  let groupDescription =
    group.description + "You must specify the `site` and `task` to perform.\n";

  const taskEnumsBySite = {};
  for (const siteName of siteNames) {
    taskEnumsBySite[siteName] = group.sites[siteName].map((t) =>
      t.id.replace(`${siteName}_`, "")
    );
    groupDescription += `\nFor site '${siteName}', available tasks are: [${taskEnumsBySite[
      siteName
    ].join(", ")}].`;
    for (const subTool of group.sites[siteName]) {
      underlyingToolExecutors[subTool.id] = async (data) => {
        // In a real implementation, this would have the full polling logic
        return `Data for ${subTool.id} with args ${JSON.stringify(data)}`;
      };
    }
  }

  const groupToolName = `${groupName}_data`;
  const groupParameters = z.object({
    site: z.enum(siteNames),
    task: z
      .string()
      .describe(`The specific task to perform on the site. Varies by site.`),
    ...group.allParams,
  });

  addTool({
    name: groupToolName,
    description: groupDescription,
    parameters: groupParameters,
    execute: tool_fn(groupToolName, async (data) => {
      const { site, task, ...args } = data;
      const validTasks = taskEnumsBySite[site];
      if (!validTasks || !validTasks.includes(task)) {
        throw new Error(
          `Invalid task '${task}' for site '${site}'. Available tasks are: [${validTasks.join(
            ", "
          )}]`
        );
      }
      const executorId = `${site}_${task}`;
      const executor = underlyingToolExecutors[executorId];
      if (!executor) {
        throw new Error(
          `Internal error: No executor found for '${executorId}'`
        );
      }
      return executor(args);
    }),
  });
}

for (let tool of browser_tools) {
  addTool(tool);
}

// --- Core MCP Logic ---
async function handleRpcMessage(message, session) {
  if (Array.isArray(message)) {
    for (const rpcMessage of message) {
      await handleRpcMessage(rpcMessage, session);
    }
    return;
  }

  const { method, params, id } = message;
  const sessionLogger = logger.child({ sessionId: session.id, rpcId: id });

  // --- Ultra-Flexible Handshake Logic ---
  // If the session is new and the first request isn't 'initialize',
  // we create and initialize the session on-the-fly for maximum compatibility.
  if (session.state === "uninitialized" && method !== "initialize") {
    sessionLogger.warn(
      `Received method '${method}' before 'initialize'. Implicitly creating and initializing session.`
    );
    session.state = "initialized"; // Jump directly to initialized state
  }
  // Also handle clients that initialize but don't send 'notifications/initialized'
  else if (
    session.state === "pending_ack" &&
    method !== "notifications/initialized"
  ) {
    sessionLogger.warn(
      `Received method '${method}' before 'notifications/initialized'. Implicitly completing handshake.`
    );
    session.state = "initialized";
  }

  switch (method) {
    case "initialize":
      sessionLogger.info({ params }, "Received initialize request");
      const initializeResponse = {
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: {
            name: "BrightData-MCP-Server",
            version: package_json.version,
          },
          capabilities: { tools: { listChanged: false } },
        },
      };
      sendSseMessage(session.res, initializeResponse, "message");
      session.state = "pending_ack";
      break;

    case "notifications/initialized":
      if (session.state === "pending_ack" || session.state === "initialized") {
        sessionLogger.info("Client handshake complete. Session is now active.");
        session.state = "initialized";
      }
      break;

    case "tools/list":
      sessionLogger.info("Received tools/list request");
      try {
        const tools = Object.values(toolRegistry).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.parameters, {
            $refStrategy: "none",
          }),
        }));
        const listResponse = { jsonrpc: "2.0", id: id, result: { tools } };
        sessionLogger.info(`Sending list of ${tools.length} tools.`);
        sendSseMessage(session.res, listResponse, "message");
      } catch (error) {
        sessionLogger.fatal(
          { err: error },
          "An error occurred while generating the tool list"
        );
        sendSseMessage(
          session.res,
          {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32000,
              message: "An error occurred while generating the tool list.",
            },
          },
          "message"
        );
      }
      break;

    case "tools/call":
      sessionLogger.info(
        { toolName: params.name, args: params.arguments },
        "Received tools/call"
      );
      const tool = toolRegistry[params.name];
      if (!tool) {
        return sendSseMessage(
          session.res,
          {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${params.name}` },
          },
          "message"
        );
      }
      try {
        const result = await tool.execute(params.arguments, {});

        // Log success upon completion
        sessionLogger.info(
          { toolName: params.name },
          "Tool executed successfully"
        );

        sendSseMessage(
          session.res,
          {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: String(result) }] },
          },
          "message"
        );
      } catch (error) {
        // This existing log correctly captures failures
        sessionLogger.error(
          { err: error, toolName: params.name },
          "Tool execution failed"
        );
        sendSseMessage(
          session.res,
          {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Tool execution error: ${error.message}`,
            },
          },
          "message"
        );
      }
      break;

    default:
      sessionLogger.warn(`Method not found: ${method}`);
      if (id) {
        sendSseMessage(
          session.res,
          {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          },
          "message"
        );
      }
      break;
  }
}

// --- Routes ---
app.get("/sse", authMiddleware, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  logger.info("Client connected to /sse");
  res.write(":ok\n");

  const sessionId = uuidv4();
  const session = { id: sessionId, res: res, state: "uninitialized" };
  sseSessions.set(sessionId, session);
  const rpcPath = `/sse/message?sessionId=${sessionId}`;

  setTimeout(() => {
    if (!res.writableEnded) {
      logger.info({ sessionId }, "Sending endpoint event");
      sendSseMessage(res, rpcPath, "endpoint");
    }
  }, 10);

  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      sendSseMessage(res, "ping", "ping");
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 25000);

  req.on("close", () => {
    logger.info({ sessionId }, "Client disconnected");
    clearInterval(keepAliveInterval);
    sseSessions.delete(sessionId);
  });
});

app.post("/sse/message", authMiddleware, async (req, res) => {
  const { sessionId } = req.query;
  const session = sseSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Invalid or expired session ID" });
  }
  await handleRpcMessage(req.body, session);
  res.status(204).send();
});

// --- Start Server ---
app.listen(PORT, () => {
  logger.info(`MCP-compliant server running on http://localhost:${PORT}`);
});
