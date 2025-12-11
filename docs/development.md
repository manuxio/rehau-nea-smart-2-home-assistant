# Developer Tools

This document describes developer tools and utilities available in the project.

## Parser Tools

This project includes standalone parsers for REHAU API responses:

```bash
# Parse user data from JSON file
npm run parseUserData -- user-data.json
npm run parseUserData -- user-data.json --summary

# Parse installation data from JSON file
npm run parseInstallationData -- installation-data.json
npm run parseInstallationData -- installation-data.json --summary
```

These tools are useful for:
- Debugging API responses from users
- Analyzing installation configurations
- Testing parser logic independently

## Parser Documentation

For detailed information about the parser tools and CLI usage, see:
- [Parser Documentation](../rehau-nea-smart-mqtt-bridge/src/parsers/README.md)

## Project Structure

```
rehau-nea-smart-mqtt-bridge/
├── src/
│   ├── climate-controller.ts    # Main climate control logic
│   ├── config-validator.ts      # Configuration validation
│   ├── index.ts                 # Application entry point
│   ├── logger.ts                # Logging utilities
│   ├── mqtt-bridge.ts           # MQTT bridge implementation
│   ├── rehau-auth.ts            # REHAU authentication
│   ├── types.ts                  # TypeScript type definitions
│   └── parsers/                  # API response parsers
│       ├── README.md
│       └── ...
├── test/                         # Test files
├── docs/                         # Additional documentation
└── package.json                  # Dependencies and scripts
```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build TypeScript:**
   ```bash
   npm run build
   ```

3. **Run in development mode:**
   ```bash
   npm start
   ```

4. **Run parser tools:**
   ```bash
   npm run parseUserData -- path/to/user-data.json
   npm run parseInstallationData -- path/to/installation-data.json
   ```

## Contributing

Interested in contributing? Here's how to get started:

1. **Check existing issues** on GitHub for areas that need work
2. **Review the codebase** to understand the architecture
3. **Test your changes** thoroughly before submitting
4. **Submit a pull request** with a clear description of changes

For more information about planned features and contributions, see the [Future Enhancements](./future-enhancements.md) guide.

## Related Documentation

- [Parser Documentation](../rehau-nea-smart-mqtt-bridge/src/parsers/README.md) - Detailed parser usage
- [CHANGELOG](../rehau-nea-smart-mqtt-bridge/CHANGELOG.md) - Version history
- [Future Enhancements](./future-enhancements.md) - Planned features
