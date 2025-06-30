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
<h3 align="center">Enhance AI Agents with a Standalone, Real-Time Web Data Server</h3>

## 🌟 Overview

This project is an enhanced version of the official [Bright Data Model Context Protocol (MCP) Server](https://github.com/brightdata-com/brightdata-mcp), modified by the team at [Maximo AI](https://www.maximoai.co) to be deployed as a standalone, remote HTTP service.

The primary contribution of this fork is to refactor the original `stdio`-based application into a persistent server that:

- Runs continuously as a standalone service (`node server.js`).
- Communicates over a secure HTTP endpoint.
- Implements the full MCP JSON-RPC 2.0 protocol for remote connections.

This allows for easier deployment, management, and connection from various distributed AI agents and applications. All the powerful, original features from the Bright Data server are preserved.

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
- [🎮 Try the Official Bright Data Playground](#-try-the-official-bright-data-playground)
- [💡 Usage Examples](#-usage-examples)
- [⚠️ Troubleshooting](#%EF%B8%8F-troubleshooting)
- [👨‍💻 Contributing](#-contributing)
- [📞 Support](#-support)

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
```

### 3\. **Start the Server**

Launch the server from your terminal:

```bash
node server.js
```

If successful, you will see output confirming that the server is running:

```
MCP-compliant server running on http://localhost:9000
JSON-RPC endpoint available at: POST /mcp
```

## 🔌 Connecting MCP Clients

Any MCP-compatible client or agent can connect to your server by pointing to its endpoint and providing the correct security token.

- **Endpoint URL**: `http://<your-server-ip>:9000/mcp`
- **HTTP Method**: `POST`
- **Required Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_mcp_server_token>`

### Example `curl` Request

Here is how you would call the `tools/list` method using `curl`:

```bash
curl -X POST \
  http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MCP_SERVER_TOKEN" \
  -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list"
      }'
```

## 🔧 Configuration

The server is configured using environment variables, ideally set in your `.env` file.

- `API_TOKEN`: **(Required)** Your API key from your [Bright Data user settings page](https://brightdata.com/cp/setting/users).
- `MCP_SERVER_TOKEN`: **(Required)** A secret token you create to secure your server endpoint.
- `PORT`: (Optional) The port for the server to run on. Defaults to `9000`.
- `WEB_UNLOCKER_ZONE`: (Optional) The name of your Web Unlocker zone. Defaults to `mcp_unlocker`.
- `BROWSER_ZONE`: (Optional) The name of your Browser API zone for browser control tools. Defaults to `mcp_browser`.
- `RATE_LIMIT`: (Optional) Controls API usage with the format `limit/time+unit`. Examples: `100/1h`, `50/30m`.

## 🔧 Available Tools

This server supports the full suite of tools available in the original Bright Data MCP project.

[List of Available Tools (from original Bright Data repo)](https://github.com/brightdata-com/brightdata-mcp/blob/main/assets/Tools.md)

## ⚠️ Security Best Practices

- **Protect Your `MCP_SERVER_TOKEN`**: Your `MCP_SERVER_TOKEN` is the key to your server. Keep it secret and do not expose it in client-side code. It should only be used by trusted clients.
- **Treat Scraped Content as Untrusted**: Always treat scraped web content as untrusted data. Never use raw scraped content directly in LLM prompts to avoid potential prompt injection risks.
- **Use Structured Data**: Prefer using the structured data extraction tools (`web_data_*`) over raw text scraping when possible.

## 🎮 Try the Official Bright Data Playground

To explore the capabilities of the core tools without any setup, you can use the official playground hosted by Bright Data on Smithery.

**Note:** This playground uses the official Bright Data package and does not reflect the standalone server architecture of this fork.

[](https://smithery.ai/server/@luminati-io/brightdata-mcp/tools)

## 💡 Usage Examples

Some example queries that this MCP server will be able to help with:

- "Google some movies that are releasing soon in [your area]"
- "What's Tesla's current market cap?"
- "What's the Wikipedia article of the day?"
- "What's the 7-day weather forecast in [your location]?"

## ⚠️ Troubleshooting

### Connection Errors

If your client cannot connect, check the following:

- Is the server running (`node server.js`)?
- Are you using the correct IP address and port?
- Is your `Authorization` header correct and using the right `MCP_SERVER_TOKEN`?
- Is there a firewall blocking the connection?

### Timeouts when using certain tools

Some tools can involve reading large amounts of web data. To ensure that your agent can consume the data, set a high enough timeout in your agent's settings (e.g., `180s`).

## 👨‍💻 Contributing

This project is now open source\! We at Maximo AI welcome contributions to help improve the remote server functionality.

1.  **Report Issues**: If you encounter bugs specific to the remote server implementation, please [open an issue](https://www.google.com/search?q=https://github.com/Maximo-AI/brightdata-mcp-remote/issues) on our GitHub repository.
2.  **Submit Pull Requests**: Feel free to fork the repository and submit pull requests with enhancements or bug fixes.

## 📞 Support

- For issues related to the **remote server implementation, security, or HTTP/JSON-RPC layer**, please open an issue on this project's GitHub repository.
- For issues related to the **core Bright Data tools, the Web Unlocker, or your Bright Data account**, please refer to the official [Bright Data support channels](https://www.google.com/search?q=https://brightdata.com/contact-us).
