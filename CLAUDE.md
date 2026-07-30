# CLAUDE.md

## ActionBoard fork rules — read first

This checkout is **ActionBoard** (github.com/it-pal-net/actionboard), a fork of
Excalidraw. Before changing anything, read [ACTIONBOARD.md](./ACTIONBOARD.md) —
the branch model, upstream-sync procedure, and divergence rules live there.

The rule that shapes every change: **replace, don't rewrite**. Never modify an
upstream component or module in place — copy it into an ActionBoard-owned
location (e.g. `packages/excalidraw/actionboard/`, `packages/actionboard-*/`),
change the copy, and switch the import at the fewest possible call sites. When
an in-place edit is truly unavoidable, keep it to a one-line hook point that
delegates into an ActionBoard module, and log the touched file in
ACTIONBOARD.md's divergence log. This keeps upstream merges conflict-free.

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
