# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2025-06-30

### Added

- **Remote Server Operation**: The project now runs as a persistent, remote HTTP server, allowing for continuous operation and connection from any authorized client.
- **Secure Public Endpoint**: Implemented a secure endpoint at `/mcp` protected by a bearer token. A new `MCP_SERVER_TOKEN` environment variable is now required for security.
- **MCP Protocol Compliance**: Added full compliance with the MCP JSON-RPC 2.0 protocol, with handlers for both `tools/list` and `tools/call` methods.
- **New Dependency**: Added `zod-to-json-schema` to correctly generate JSON schemas for the `tools/list` endpoint.

### Changed

- **BREAKING CHANGE**: The server no longer runs as a local `stdio` command invoked by a client. It must be run independently as a service (`node server.js`). MCP clients must now connect to its URL.
- **Startup Logic**: Refactored the entire server startup process to use Express.js for handling HTTP requests and routing.

### Fixed

- Fixed a critical crash that occurred when trying to access the list of available tools. This was resolved by implementing a custom tool registry that tracks all tool definitions.

### Removed

- Removed the `stdio` transport logic in favor of the new, more robust HTTP/JSON-RPC transport layer.

## [2.0.0] - 2025-05-26

### Changed

- Updated browser authentication to use API_TOKEN instead of previous authentication method
- BROWSER_ZONE is now an optional parameter, the deafult zone is `mcp_browser`
- Removed duplicate web*data* tools

## [1.9.2] - 2025-05-23

### Fixed

- Fixed GitHub references and repository settings

## [1.9.1] - 2025-05-21

### Fixed

- Fixed spelling errors and improved coding conventions
- Converted files back to Unix line endings for consistency

## [1.9.0] - 2025-05-21

### Added

- Added 23 new web data tools for enhanced data collection capabilities
- Added progress reporting functionality for better user feedback
- Added default parameter handling for improved tool usability

### Changed

- Improved coding conventions and file formatting
- Enhanced web data API endpoints integration

## [1.8.3] - 2025-05-21

### Added

- Added Bright Data MCP with Claude demo video to README.md

### Changed

- Updated documentation with video demonstrations

## [1.8.2] - 2025-05-13

### Changed

- Bumped FastMCP version for improved performance
- Updated README.md with additional documentation

## [1.8.1] - 2025-05-05

### Added

- Added 12 new WSAPI endpoints for enhanced functionality
- Changed to polling mechanism for better reliability

### Changed

- Applied dos2unix formatting for consistency
- Updated Docker configuration
- Updated smithery.yaml configuration

## [1.8.0] - 2025-05-03

### Added

- Added domain-based browser sessions to avoid navigation limit issues
- Added automatic creation of required unlocker zone when not present

### Fixed

- Fixed browser context maintenance across tool calls with current domain tracking
- Minor lint fixes

## [1.0.0] - 2025-04-29

### Added

- Initial release of Bright Data MCP server
- Browser automation capabilities with Bright Data integration
- Core web scraping and data collection tools
- Smithery.yaml configuration for deployment in Smithery.ai
- MIT License
- Demo materials and documentation

### Documentation

- Created comprehensive README.md
- Added demo.md with usage examples
- Created examples/README.md for sample implementations
- Added Tools.md documentation for available tools
