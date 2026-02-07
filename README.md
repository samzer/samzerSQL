# samzerSQL

A cross-platform desktop SQL client for Snowflake, MySQL, and PostgreSQL with a clean, and minimalistic UI. 

![samzerSQL Screenshot](src/renderer/assets/screenshot.png)

## Features

- **Multi-Database Support**: Connect to Snowflake, MySQL, PostgreSQL, SQLite, Salesforce, and MotherDuck (DuckDB) databases
- **SQL Editor**: Full-featured editor with syntax highlighting powered by CodeMirror 6
- **Schema Browser**: Explore databases, schemas, tables, and columns with lazy loading
- **Auto-Complete**: Context-aware autocomplete for schemas, tables, and columns
  - In SELECT/WHERE clauses: suggests columns from tables in your FROM clause
  - In FROM clause: suggests schemas and tables
- **Query Management**: Organize queries in folders, save and load queries
- **Query History**: Track executed queries with execution time and row counts
- **Results Panel**: View query results in a virtualized table that handles large datasets
- **Export**: Export results to CSV or JSON
- **SQL Formatting**: Format your SQL with proper indentation and uppercase keywords

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast bundling and HMR
- **Zustand** - Lightweight state management
- **CodeMirror 6** - SQL editor with syntax highlighting
- **Tailwind CSS** - Styling with custom pastel theme
- **sql-formatter** - SQL formatting

## Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as distributable
npm run package
```

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Run Query | `Cmd+Enter` | `Ctrl+Enter` |
| Save Query | `Cmd+S` | `Ctrl+S` |
| Format SQL | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Accept Autocomplete | `Tab` | `Tab` |

## Usage

### Connecting to a Database

1. Click **Add Connection** in the sidebar
2. Select your database type (Snowflake, MySQL, PostgreSQL, SQLite, Salesforce, or MotherDuck)
3. Enter connection details
4. Click **Test Connection** to verify
5. Click **Save** to add the connection

### Writing Queries

1. Click on a connection to connect
2. Write your SQL in the editor
3. Press `Cmd/Ctrl+Enter` or click **Run** to execute
4. View results in the bottom panel

### Auto-Complete

- Type a schema name and press `.` to see tables
- Type a table name and press `.` to see columns (in SELECT/WHERE)
- Press `Tab` to accept the first suggestion
- Press `Ctrl+Space` to manually trigger autocomplete

### Organizing Queries

- Right-click in the **Queries** section to create folders
- Right-click on a folder to create new queries
- Double-click to rename queries or folders
- Drag to reorder (coming soon)

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── database/         # Database adapters
│   │   ├── postgres.ts
│   │   ├── mysql.ts
│   │   ├── snowflake.ts
│   │   └── motherduck.ts
│   ├── storage/          # Local storage for queries
│   └── index.ts          # Main entry point
├── renderer/             # React frontend
│   ├── components/       # UI components
│   ├── stores/           # Zustand stores
│   └── assets/           # Images and icons
└── shared/               # Shared types
```

## Building

```bash
# Build for current platform
npm run package
```

Output will be in the `release/` folder:
- **macOS**: `.dmg` installer and `.app` bundle
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`

## Testing

The test suite uses [Vitest](https://vitest.dev/) and covers all database adapters, the connection manager, query storage, SQL utilities, and export functions (98 tests across 9 test files). All tests use mocked dependencies — no real database connections are needed.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npx vitest run src/main/database/__tests__/postgres.test.ts
```

### Test Structure

Tests live in `__tests__/` directories alongside the source code they cover:

```
src/
  main/
    database/__tests__/
      connection-manager.test.ts
      postgres.test.ts
      mysql.test.ts
      snowflake.test.ts
      salesforce.test.ts
      sqlite.test.ts
      motherduck.test.ts
    storage/__tests__/
      query-storage.test.ts
  shared/__tests__/
    sql-utils.test.ts
  renderer/utils/__tests__/
    export.test.ts
```

## Contributing

1. Fork the repository and create a feature branch from `main`
2. Make your changes
3. Run `npm test` and ensure all tests pass
4. Run `npm run build` to verify the build succeeds
5. Submit a pull request

### Code Style

- TypeScript strict mode is enabled
- Use existing patterns in the codebase as a guide
- Keep changes minimal and focused

### Writing Tests

- Place test files in a `__tests__/` directory next to the source file
- Use `vi.mock()` with factory functions to mock external dependencies
- Use `vi.hoisted()` for mock variables referenced inside `vi.mock()` factories
- Use class-based mocks when mocking constructors (e.g., `class MockPool { ... }`)
- Reset mock state in `beforeEach` with `vi.clearAllMocks()`

### Adding a New Database Adapter

1. Create the adapter in `src/main/database/` implementing the `DatabaseAdapter` interface
2. Register it in the `ConnectionManager` factory
3. Add the connection type to `ConnectionConfig` in `src/shared/types.ts`
4. Write tests in `src/main/database/__tests__/`
5. Use `await import()` for lazy-loading optional SDK dependencies (not `require()`)

## License

MIT

## Author

Samir Madhavan
