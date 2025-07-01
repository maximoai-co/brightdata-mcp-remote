<p align="center">
  <a href="https://www.maximoai.co/">
    <h3 align="center">An Enhanced Fork by Maximo AI</h3>
  </a>
</p>
<p align="center">
  Based on the Official
  <a href="https://brightdata.com/">
    <img src="https://mintlify.s3.us-west-1.amazonaws.com/brightdata/logo/light.svg" width="250" alt="Bright Data Logo">
  </a>
</p>

<h1 align="center">Remote-Enabled Bright Data MCP Server</h1>
<h3 align-center">Enhance AI Agents with a Standalone, Real-Time Web Data Server</h3>

## 🌟 Overview

This project is an enhanced version of the official [Bright Data Model Context Protocol (MCP) Server](https://github.com/brightdata-com/brightdata-mcp), modified by the team at [Maximo AI](https://www.maximoai.co) to be deployed as a standalone, remote HTTP service.

The primary contribution of this fork is to refactor the original `stdio`-based application into a persistent server that:

- Runs continuously as a standalone service (`node server.js`).
- Communicates over a secure HTTP/SSE endpoint.
- Implements a flexible MCP JSON-RPC 2.0 protocol for remote connections.
- Intelligently groups its large toolset to remain compatible with all clients.

This allows for easier deployment, management, and connection from various distributed AI agents and applications.

### Core Features (from Bright Data)

- **Real-time Web Access**: Access up-to-date information directly from the web.
- **Web Unlocker**: Navigate websites with bot detection protection.
- **Browser Control**: Optional remote browser automation capabilities.
- **Seamless Integration**: Works with all MCP-compatible AI assistants.

## Table of Content

- [🚀 Running as a Standalone Server](#-running-as-a-standalone-server)
- [🔌 Connecting MCP Clients](#-connecting-mcp-clients)
- [🔧 Configuration](#-configuration)
- [🔧 Available Tools](#-available-tools)
- [⚠️ Security Best Practices](#%EF%B8%8F-security-best-practices)
- [💰 Maximo AI Billing Model (when `HOSTING_MODE=maximo`)](#-maximo-ai-billing-model-when-hosting_mode=maximo)
- [💡 Usage Examples](#-usage-examples)
- [⚠️ Troubleshooting](#%EF%B8%8F-troubleshooting)

## 🚀 Running as a Standalone Server

This server is designed to be run as a standalone Node.js service.

### 1. **Install Dependencies**

First, ensure all required npm packages are installed by running:

```bash
npm install
```

### 2\. **Configure Environment**

Create a file named `.env` in the project root. This file will hold your secret keys.

```
# .env file

# Your secret API Token from brightdata.com
API_TOKEN="YOUR_BRIGHTDATA_API_TOKEN"

# A new, secure, and secret token you create to protect your public MCP server
MCP_SERVER_TOKEN="CREATE_YOUR_OWN_SECRET_TOKEN_HERE"

# The URL of your Maximo AI backend server that handles billing and usage tracking
# Required if HOSTING_MODE is 'maximo'
MAXIMO_API_URL="[https://rad.huddlz.xyz/v1/mcp/charge](https://rad.huddlz.xyz/v1/mcp/charge)"

# Set to 'self' for standalone operation (default) or 'maximo' to enable Maximo AI for billing
HOSTING_MODE="maximo"
```

### 3\. **Start the Server**

Launch the server from your terminal:

```bash
node server.js
```

If successful, you will see output confirming that the server is running:

```
MCP-compliant server running on http://localhost:9000
Handshake endpoint at: GET /sse
```

## 🔌 Connecting MCP Clients

This server uses a stateful SSE (Server-Sent Events) connection for all communication. Clients must first establish a persistent connection and then perform the MCP handshake.

**Step 1: Initiate SSE Connection**
The client makes a `GET` request to the `/sse` endpoint. The server will keep this connection open for the duration of the session.

```bash
# Connect to the SSE endpoint to start the session
curl -N -X GET \
  http://localhost:9000/sse \
  -H "Authorization: Bearer YOUR_MCP_SERVER_TOKEN"
```

**Step 2: Receive Session RPC Endpoint**
The server's first message on the stream will be a unique RPC URL containing a session ID.
`data: /sse/message?sessionId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Step 3: Perform MCP Handshake & Send Commands**
The client sends all subsequent JSON-RPC commands (like `initialize`, `tools/list`, and `tools/call`) via standard `POST` requests to this new session URL (e.g., `http://localhost:9000/sse/message?sessionId=...`).

**Step 4: Receive Results**
The results of the `POST` commands will be sent as new `message` events on the original, still-open `/sse` stream from Step 1.

## 🔧 Configuration

The server is configured using environment variables, ideally set in your `.env` file.

- `API_TOKEN`: **(Required)** Your API key from your [Bright Data user settings page](https://brightdata.com/cp/setting/users).
- `MCP_SERVER_TOKEN`: **(Required)** A secret token you create to secure your server endpoint.
- `PORT`: (Optional) The port for the server to run on. Defaults to `9000`.
- `WEB_UNLOCKER_ZONE`: (Optional) The name of your Web Unlocker zone. Defaults to `mcp_unlocker`.
- `BROWSER_ZONE`: (Optional) The name of your Browser API zone for browser control tools. Defaults to `mcp_browser`.
- `RATE_LIMIT`: (Optional) Controls API usage with the format `limit/time+unit`. Examples: `100/1h`, `50/30m`.
- `MAXIMO_API_URL`: **(Required for 'maximo' HOSTING_MODE)** The URL of your Maximo AI backend server that handles billing and usage tracking (e.g., `https://rad.huddlz.xyz/v1/mcp/charge`).
- `HOSTING_MODE`: (Optional) Set to `'self'` for standalone operation (default) or `'maximo'` to enable Maximo AI for billing and usage tracking.

## 🔧 Available Tools

To ensure compatibility with all clients, this server uses a "super-grouping" architecture. Instead of exposing 50+ individual tools, it provides a small, stable list of high-level tools.

### Base Tools

- **`search_engine`**: Performs a general web search using Google, Bing, or Yandex.
- **`scrape`**: Scrapes the full content of a single URL, returning either Markdown or raw HTML.

### Grouped Data Tools

Specialized data collection tools are bundled into thematic groups. To use them, you must provide a **`site`** and a **`task`** parameter. The available options for these parameters are found in the tool's description.

**Example Group Tools:**

- `e_commerce_data`
- `social_professional_data`
- `business_data`

#### Example Usage of a Grouped Tool

To get reviews for an Amazon product, an AI would follow this logic:

1.  **Call `tools/list`** and see the `e_commerce_data` tool.
2.  **Read its description**, which says for `site: 'amazon'`, one of the available `task`s is `'product_reviews'`.
3.  **Call the tool** with the correct parameters:

<!-- end list -->

```json
{
  "tool_name": "e_commerce_data",
  "parameters": {
    "site": "amazon",
    "task": "product_reviews",
    "url": "[https://www.amazon.com/dp/B08P2H5L72](https://www.amazon.com/dp/B08P2H5L72)"
  }
}
```

## ⚠️ Security Best Practices

- **Protect Your `MCP_SERVER_TOKEN`**: Your `MCP_SERVER_TOKEN` is the key to your server. Keep it secret and do not expose it in client-side code. It should only be used by trusted back-end clients.
- **Treat Scraped Content as Untrusted**: Always treat scraped web content as untrusted data. Sanitize it before use.

## 💰 Maximo AI Billing Model (when `HOSTING_MODE=maximo`)

When running the server in `maximo` hosting mode, all interactions with the MCP server (including handshake, tool listing, and tool calls) are routed through your configured Maximo AI backend for billing and usage tracking.

The billing model is as follows:

- **Free Tier**: The first **50 requests** per user are completely free of charge.
- **Paid Requests**: After the free tier is exhausted, each subsequent request will incur a fixed charge of **10 credits**.
  - **Cost per Credit**: 100 credits cost $0.20, therefore 1 credit costs $0.002.

This model provides a generous free usage tier while ensuring fair compensation for continued service. All API calls, regardless of their nature (e.g., `initialize`, `tools/list`, `tools/call`), contribute to the request count for the free tier.

**Note**: In `maximo` mode, the individual `cost` defined for tools within `server.js` is informational only and is _not_ used for actual credit deduction. The Maximo AI backend (`MAXIMO_API_URL`) is the single source of truth for billing.

### Maximo AI API Key & Usage

To use the Maximo AI billing model, you will need a Maximo AI API Key.

- **Get your API Key**: Log in or sign up at [https://maximoai.co](https://maximoai.co), open the user menu, and click on "Get Your API Key", or visit the direct link: [https://maximoai.co/platform](https://maximoai.co/platform).
- **Track API Usage**: Monitor your API usage and credit consumption at [https://maximoai.co/apiusage](https://maximoai.co/apiusage).

### Buying Maximo AI Credits

Credits are required for paid requests.

- **Buy Credits**: Visit [https://maximoai.co/buycredits](https://maximoai.co/buycredits) to purchase credits.
- **Payment Method**: Currently, only crypto payment methods are supported. You will need to create and fund your Maximo AI crypto wallet first.
- **Create Maximo AI Crypto Wallet**: Create your wallet here: [https://maximoai.co/menu](https://maximoai.co/menu). After funding, head to the buy credits page.

## ⚠️ Troubleshooting

### Connection Errors

If your client cannot connect, check the following:

- Is the server running (`node server.js`)?
- Are you using the correct IP address and port?
- Is your `Authorization` header correct and using the right `MCP_SERVER_TOKEN`?
- Is there a firewall blocking the connection?

### Timeouts

Some tools can involve reading large amounts of web data. To ensure that your agent can consume the data, set a high enough timeout in your agent's settings (e.g., `180s`).

```

```
