import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { Cell, Connection } from '../types';
import CellComponent from './CellComponent';
import ConnectionComponent from './ConnectionComponent';
import ZoomControls from './ZoomControls';
import ContextMenu from './ContextMenu';
import TimelineModal from './TimelineModal';
import SearchPanel from './SearchPanel';
import StylePalette from './StylePalette';
import SettingsModal from './SettingsModal';

function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [connectionContextMenu, setConnectionContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const {
    cells,
    connections,
    selectedCellIds,
    offsetX,
    offsetY,
    zoom,
    canvasBackgroundColor,
    colorPresets,
    defaultCellStyle,
    setOffset,
    setZoom,
    addCell,
    updateCell,
    clearSelection,
    setSelectedCells,
    undo,
    redo,
    deleteCells,
    addConnection,
    saveHistory,
  } = useStore();

  const clipboardRef = useRef<{ cells: Cell[], connections: any[] }>({ cells: [], connections: [] });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Don't handle wheel events when modals/panels are open
      if (showSettingsModal || showSearchPanel) return;

      e.preventDefault();

      if (!canvasRef.current) return;

      // Detect pinch-to-zoom (ctrlKey is set for pinch gestures on trackpad)
      if (e.ctrlKey) {
        // Pinch-to-zoom
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - offsetX) / zoom;
        const worldY = (mouseY - offsetY) / zoom;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(4, zoom * delta));

        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;

        setZoom(newZoom);
        setOffset(newOffsetX, newOffsetY);
      } else {
        // Two-finger scroll - pan the canvas
        setOffset(offsetX - e.deltaX, offsetY - e.deltaY);
      }
    },
    [zoom, offsetX, offsetY, setZoom, setOffset, showSettingsModal, showSearchPanel]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / zoom;
      const y = (e.clientY - rect.top - offsetY) / zoom;

      setIsSelecting(true);
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      clearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / zoom;
      const y = (e.clientY - rect.top - offsetY) / zoom;

      setSelectionBox((prev) => prev ? { ...prev, endX: x, endY: y } : null);
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionBox) {
      // Select all cells within the selection box
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const selectedIds = cells
        .filter((cell) => {
          const cellRight = cell.x + cell.width;
          const cellBottom = cell.y + cell.height;

          // Check if cell intersects with selection box
          return !(cell.x > maxX || cellRight < minX || cell.y > maxY || cellBottom < minY);
        })
        .map((cell) => cell.id);

      if (selectedIds.length > 0) {
        setSelectedCells(selectedIds);
      }

      setIsSelecting(false);
      setSelectionBox(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const styleIndexStr = e.dataTransfer.getData('styleIndex');
    if (styleIndexStr && canvasRef.current) {
      const styleIndex = parseInt(styleIndexStr);
      const preset = colorPresets[styleIndex];
      if (preset) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - offsetX) / zoom;
        const y = (e.clientY - rect.top - offsetY) / zoom;

        const newCell: Cell = {
          id: `cell-${Date.now()}`,
          x,
          y,
          width: 200,
          height: 80,
          text: preset.name,
          backgroundColor: preset.bgColor,
          textColor: preset.textColor,
          borderColor: preset.borderColor || preset.textColor,
          borderThickness: preset.borderThickness ?? 1,
          borderRadius: preset.borderRadius ?? 8,
          fontFamily: defaultCellStyle.fontFamily,
          fontSize: defaultCellStyle.fontSize,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          styleName: preset.name, // Track which style was used
        };

        addCell(newCell);
        saveHistory();
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / zoom;
      const y = (e.clientY - rect.top - offsetY) / zoom;

      const newCell: Cell = {
        id: `cell-${Date.now()}`,
        x,
        y,
        width: 200,
        height: 60,
        text: 'New Cell',
        backgroundColor: '#fffdf5',
        textColor: '#000000',
        borderColor: '#000000',
        borderThickness: 0,
        borderRadius: 0,
        fontFamily: 'system-ui',
        fontSize: 14,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      };

      addCell(newCell);
    }
  };

  const [timelinePosition, setTimelinePosition] = useState<{ x: number; y: number }>({ x: 100, y: 100 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - offsetX) / zoom;
      const worldY = (e.clientY - rect.top - offsetY) / zoom;
      setTimelinePosition({ x: worldX, y: worldY });
    }

    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleConnectionContextMenu = (e: React.MouseEvent, connection: Connection) => {
    e.preventDefault();
    setConnectionContextMenu({ x: e.clientX, y: e.clientY, connectionId: connection.id });
    setContextMenu(null); // Close cell context menu if open
  };

  const handleCloseConnectionContextMenu = () => {
    setConnectionContextMenu(null);
  };

  const handleOpenTimelineModal = () => {
    setShowTimelineModal(true);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchPanel(true);
    };

    window.addEventListener('open-search', handleOpenSearch);
    return () => window.removeEventListener('open-search', handleOpenSearch);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Don't interfere with text editing, but allow Ctrl/Cmd+A for select all
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        // Allow Ctrl/Cmd+A for select all and let the browser handle text selection
        if (cmdOrCtrl && e.key === 'a') {
          return; // Let the browser handle it
        }
        return;
      }

      // Undo/Redo
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (cmdOrCtrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (cmdOrCtrl && (e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      // Copy
      else if (cmdOrCtrl && e.key === 'c') {
        e.preventDefault();
        const selectedCells = cells.filter((c) => selectedCellIds.includes(c.id));
        const selectedConnections = connections.filter(
          (conn) =>
            selectedCellIds.includes(conn.fromCellId) &&
            selectedCellIds.includes(conn.toCellId)
        );
        clipboardRef.current = {
          cells: JSON.parse(JSON.stringify(selectedCells)),
          connections: JSON.parse(JSON.stringify(selectedConnections)),
        };
      }
      // Cut
      else if (cmdOrCtrl && e.key === 'x') {
        e.preventDefault();
        const selectedCells = cells.filter((c) => selectedCellIds.includes(c.id));
        const selectedConnections = connections.filter(
          (conn) =>
            selectedCellIds.includes(conn.fromCellId) &&
            selectedCellIds.includes(conn.toCellId)
        );
        clipboardRef.current = {
          cells: JSON.parse(JSON.stringify(selectedCells)),
          connections: JSON.parse(JSON.stringify(selectedConnections)),
        };
        deleteCells(selectedCellIds);
      }
      // Paste
      else if (cmdOrCtrl && e.key === 'v' && !e.shiftKey) {
        e.preventDefault();
        if (clipboardRef.current.cells.length > 0) {
          const idMap = new Map<string, string>();
          const newCells = clipboardRef.current.cells.map((cell) => {
            const newId = `cell-${Date.now()}-${Math.random()}`;
            idMap.set(cell.id, newId);
            return {
              ...cell,
              id: newId,
              x: cell.x + 20,
              y: cell.y + 20,
            };
          });

          newCells.forEach((cell) => addCell(cell));

          clipboardRef.current.connections.forEach((conn) => {
            const newFromId = idMap.get(conn.fromCellId);
            const newToId = idMap.get(conn.toCellId);
            if (newFromId && newToId) {
              addConnection({
                ...conn,
                id: `conn-${Date.now()}-${Math.random()}`,
                fromCellId: newFromId,
                toCellId: newToId,
              });
            }
          });

          saveHistory();
        }
      }
      // Paste without formatting
      else if (cmdOrCtrl && e.key === 'v' && e.shiftKey) {
        e.preventDefault();
        if (clipboardRef.current.cells.length > 0) {
          const idMap = new Map<string, string>();
          const newCells = clipboardRef.current.cells.map((cell) => {
            const newId = `cell-${Date.now()}-${Math.random()}`;
            idMap.set(cell.id, newId);
            return {
              ...cell,
              id: newId,
              x: cell.x + 20,
              y: cell.y + 20,
              backgroundColor: '#fffdf5',
              textColor: '#000000',
              borderColor: '#000000',
              borderThickness: 0,
              borderRadius: 0,
              fontFamily: 'system-ui',
              fontSize: 14,
              bold: false,
              italic: false,
              underline: false,
              strikethrough: false,
            };
          });

          newCells.forEach((cell) => addCell(cell));

          clipboardRef.current.connections.forEach((conn) => {
            const newFromId = idMap.get(conn.fromCellId);
            const newToId = idMap.get(conn.toCellId);
            if (newFromId && newToId) {
              addConnection({
                ...conn,
                id: `conn-${Date.now()}-${Math.random()}`,
                fromCellId: newFromId,
                toCellId: newToId,
                color: '#000000',
                style: 'Dashed',
              });
            }
          });

          saveHistory();
        }
      }
      // Delete
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCellIds.length > 0) {
          e.preventDefault();
          deleteCells(selectedCellIds);
        }
      }
      // Arrow key nudging
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedCellIds.length > 0) {
          e.preventDefault();
          const nudgeAmount = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -nudgeAmount : e.key === 'ArrowRight' ? nudgeAmount : 0;
          const dy = e.key === 'ArrowUp' ? -nudgeAmount : e.key === 'ArrowDown' ? nudgeAmount : 0;

          selectedCellIds.forEach((id) => {
            const cell = cells.find((c) => c.id === id);
            if (cell) {
              updateCell(id, {
                x: cell.x + dx,
                y: cell.y + dy,
              });
            }
          });
          saveHistory();
        }
      }
      // Select All
      else if (cmdOrCtrl && e.key === 'a') {
        e.preventDefault();
        setSelectedCells(cells.map((c) => c.id));
      }
      // Search
      else if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        setShowSearchPanel(true);
      }
      // Font size - Make Bigger
      else if (cmdOrCtrl && (e.key === '=' || e.key === '+')) {
        if (selectedCellIds.length > 0) {
          e.preventDefault();
          selectedCellIds.forEach((id) => {
            const cell = cells.find((c) => c.id === id);
            if (cell) {
              updateCell(id, { fontSize: Math.min(cell.fontSize + 2, 72) });
            }
          });
          saveHistory();
        }
      }
      // Font size - Make Smaller
      else if (cmdOrCtrl && e.key === '-') {
        if (selectedCellIds.length > 0) {
          e.preventDefault();
          selectedCellIds.forEach((id) => {
            const cell = cells.find((c) => c.id === id);
            if (cell) {
              updateCell(id, { fontSize: Math.max(cell.fontSize - 2, 8) });
            }
          });
          saveHistory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, cells, connections, selectedCellIds, addCell, addConnection, deleteCells, saveHistory, updateCell, setSelectedCells]);

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: canvasBackgroundColor,
        cursor: isPanning ? 'grabbing' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {connections.map((connection) => (
          <ConnectionComponent
            key={connection.id}
            connection={connection}
            onContextMenu={handleConnectionContextMenu}
          />
        ))}
        {cells.map((cell) => (
          <CellComponent
            key={cell.id}
            cell={cell}
            isSelected={selectedCellIds.includes(cell.id)}
          />
        ))}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
              border: '2px dashed #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )}
      </div>

      <ZoomControls />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onOpenTimelineModal={handleOpenTimelineModal}
        />
      )}

      {connectionContextMenu && (
        <ConnectionContextMenu
          x={connectionContextMenu.x}
          y={connectionContextMenu.y}
          connectionId={connectionContextMenu.connectionId}
          onClose={handleCloseConnectionContextMenu}
        />
      )}

      {showTimelineModal && (
        <TimelineModal
          onClose={() => setShowTimelineModal(false)}
          position={timelinePosition}
        />
      )}

      {showSearchPanel && (
        <SearchPanel onClose={() => setShowSearchPanel(false)} />
      )}

      <button
        onClick={() => setShowSettingsModal(true)}
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          width: 40,
          height: 40,
          backgroundColor: '#ffffff',
          border: '2px solid #ccc',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}
        title="Settings"
      >
        ⚙️
      </button>

      <StylePalette zoom={zoom} offsetX={offsetX} offsetY={offsetY} />

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
}

// Simple context menu component for connections
function ConnectionContextMenu({
  x,
  y,
  connectionId,
  onClose,
}: {
  x: number;
  y: number;
  connectionId: string;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { connections, updateConnection, deleteConnection, saveHistory } = useStore();
  const connection = connections.find((c) => c.id === connectionId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!connection) return null;

  const handleStyle = (style: Connection['style']) => {
    updateConnection(connectionId, { style });
    saveHistory();
    onClose();
  };

  const handleColorPicker = () => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = connection.color;
    input.click();
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      updateConnection(connectionId, { color });
      saveHistory();
    };
    onClose();
  };

  const handleDelete = () => {
    deleteConnection(connectionId);
    saveHistory();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 10000,
        minWidth: 150,
      }}
    >
      <div style={{ padding: '4px 0' }}>
        <MenuItem onClick={() => handleStyle('Dotted')}>Dotted</MenuItem>
        <MenuItem onClick={() => handleStyle('Dashed')}>Dashed</MenuItem>
        <MenuItem onClick={() => handleStyle('Solid')}>Solid</MenuItem>
        <MenuItem onClick={() => handleStyle('Bold')}>Bold</MenuItem>
        <MenuDivider />
        <MenuItem onClick={handleColorPicker}>Color</MenuItem>
        <MenuDivider />
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </div>
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: 14,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f0f0f0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {children}
    </div>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, backgroundColor: '#e0e0e0', margin: '4px 0' }} />;
}

export default Canvas;
