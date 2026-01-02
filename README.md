# Timeline Free Plotter

An infinite canvas flowchart and timeline planning tool built with Electron, React, and TypeScript.

## Features

- **Infinite Canvas**: Pan by dragging and zoom with scroll wheel (10% to 400%)
- **Flexible Cells**: Create, edit, move, and resize cells with ease
- **Timeline Cells**: Create timeline cells with custom number ranges and orientations
- **Connections**: Draw connections between cells with multiple styles
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

## Usage

- **Create Cell**: Double-click on empty canvas
- **Edit Cell**: Double-click on a cell
- **Select**: Click on a cell, Shift+Click for multi-select
- **Move**: Drag selected cells
- **Resize**: Drag the blue resize handle on selected cells
- **Pan Canvas**: Drag empty space
- **Zoom**: Scroll wheel
- **Context Menu**: Right-click for styling and connection options
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
