# Timeline Free Plotter

An infinite canvas flowchart and timeline planning tool built with Electron, React, and TypeScript.

## Features

- **Infinite Canvas**: Pan by dragging and zoom with scroll wheel (10% to 400%)
- **Flexible Cells**: Create, edit, move, and resize cells however you like
- **Timeline Cells**: Create timeline cells with custom number ranges and orientations
- **Connections**: Draw connections between cells with multiple styles and weights
- **Pinned Locations**: Save and quickly navigate to specific canvas positions and zoom levels
- **Rich Styling**: Color presets, custom colors, fonts, and borders
- **Keyboard Shortcuts**: Full support for undo/redo, copy/paste, and more
- **Auto-save**: Automatic backup every 3 minutes
- **Export**: Save as .timeline files or export to PNG/JSON

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This will start both the Vite development server and Electron.

## Building

Build the application for your platform:

```bash
# Build for all platforms
npm run package

# Build for macOS
npm run package:mac

# Build for Windows
npm run package:win
```

## How To Use: 

- **Create Cell**: Double-click on empty canvas, or right-click > Add new cell
- **Edit Cell**: Double-click on a cell
- **Select**: Click on a cell, Shift+Click for multi-select
- **Move**: Drag selected cells
- **Resize**: Drag the blue resize handle on selected cells
- **Pan Canvas**: Drag empty space
- **Zoom**: Scroll wheel or use zoom controls (bottom-right corner)
- **Pin Location**: Right-click > Pin Location to save current view position and zoom
- **Navigate to Pinned Location**: Click the 📍 button (next to Reset button) to view and navigate to pinned locations
- **Manage Pinned Locations**: Settings (⚙️) > Pinned Locations tab to reorder, recolor, and delete pinned locations
- **Context Menu**: Right-click for styling, connection options, and more
- **Delete**: Select cells and press Delete or Backspace

### Keyboard Shortcuts

- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z`: Redo
- `Cmd/Ctrl + C`: Copy
- `Cmd/Ctrl + X`: Cut
- `Cmd/Ctrl + V`: Paste
- `Cmd/Ctrl + Shift + V`: Paste without formatting
- `Cmd/Ctrl + S`: Save
- `Cmd/Ctrl + O`: Open
- `Cmd/Ctrl + N`: New

## Project Structure

```
Timeline-Builder/
├── electron/          # Electron main process
│   ├── main.ts       # Main process entry
│   └── preload.ts    # Preload script
├── src/              # React application
│   ├── components/   # React components
│   ├── store.ts      # Zustand state management
│   ├── types.ts      # TypeScript definitions
│   ├── App.tsx       # Main app component
│   └── main.tsx      # React entry point
├── package.json
└── tsconfig.json
```

## License

MIT
