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
import PinnedLocations from './PinnedLocations';
import PinLocationModal from './PinLocationModal';

function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [connectionContextMenu, setConnectionContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPinnedLocations, setShowPinnedLocations] = useState(false);
  const [showPinLocationModal, setShowPinLocationModal] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isShiftSelecting, setIsShiftSelecting] = useState(false);
  const [isExportRegionMode, setIsExportRegionMode] = useState(false);
  const [showExportRegionInstructions, setShowExportRegionInstructions] = useState(false);
  const [exportRegionBox, setExportRegionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isDrawingExportRegion, setIsDrawingExportRegion] = useState(false);
  const [isResizingExportRegion, setIsResizingExportRegion] = useState(false);
  const [exportRegionResizeHandle, setExportRegionResizeHandle] = useState<string | null>(null);
  const lastMouseDownPos = useRef<{ x: number; y: number; time: number } | null>(null);

  const {
    cells,
    connections,
    selectedCellIds,
    offsetX,
    offsetY,
    zoom,
    canvasBackgroundColor,
    gridEnabled,
    gridSize,
    gridColor,
    gridOpacity,
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
    addCellsAndConnections,
    saveHistory,
    addPinnedLocation,
  } = useStore();

  const clipboardRef = useRef<{ cells: Cell[], connections: any[] }>({ cells: [], connections: [] });

  // Calculate grid bounds dynamically based on viewport
  const [gridBounds, setGridBounds] = useState({ minX: -50000, maxX: 50000, minY: -50000, maxY: 50000 });

  useEffect(() => {
    const updateGridBounds = () => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const buffer = 10000; // Large buffer beyond visible area

      // Convert viewport corners to world coordinates
      const minX = (-offsetX / zoom) - buffer;
      const maxX = ((rect.width - offsetX) / zoom) + buffer;
      const minY = (-offsetY / zoom) - buffer;
      const maxY = ((rect.height - offsetY) / zoom) + buffer;

      // Round to nearest grid unit for cleaner alignment
      const gridUnit = gridSize * 4;
      setGridBounds({
        minX: Math.floor(minX / gridUnit) * gridUnit,
        maxX: Math.ceil(maxX / gridUnit) * gridUnit,
        minY: Math.floor(minY / gridUnit) * gridUnit,
        maxY: Math.ceil(maxY / gridUnit) * gridUnit,
      });
    };

    updateGridBounds();
  }, [offsetX, offsetY, zoom, gridSize]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Don't handle wheel events when modals/panels are open
      if (showSettingsModal || showSearchPanel || contextMenu) return;

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
    [zoom, offsetX, offsetY, setZoom, setOffset, showSettingsModal, showSearchPanel, contextMenu]
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

      // Track mouse down position and time for double-click detection
      lastMouseDownPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      if (isExportRegionMode) {
        // Start drawing export region box
        setExportRegionBox({ startX: x, startY: y, endX: x, endY: y });
        setIsDrawingExportRegion(true);
      } else {
        // Normal selection mode
        setIsSelecting(true);
        setIsShiftSelecting(e.shiftKey);
        setSelectionBox({ startX: x, startY: y, endX: x, endY: y });

        // Only clear selection if Shift is not held
        if (!e.shiftKey) {
          clearSelection();
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / zoom;
      const y = (e.clientY - rect.top - offsetY) / zoom;

      if (isDrawingExportRegion && exportRegionBox) {
        // Update export region box while drawing
        setExportRegionBox((prev) => prev ? { ...prev, endX: x, endY: y } : null);
      } else if (isResizingExportRegion && exportRegionBox && exportRegionResizeHandle) {
        // Handle resizing the export region box
        const minX = Math.min(exportRegionBox.startX, exportRegionBox.endX);
        const maxX = Math.max(exportRegionBox.startX, exportRegionBox.endX);
        const minY = Math.min(exportRegionBox.startY, exportRegionBox.endY);
        const maxY = Math.max(exportRegionBox.startY, exportRegionBox.endY);

        let newStartX = exportRegionBox.startX;
        let newStartY = exportRegionBox.startY;
        let newEndX = exportRegionBox.endX;
        let newEndY = exportRegionBox.endY;

        // Adjust based on which handle is being dragged
        if (exportRegionResizeHandle.includes('n')) {
          // Top edge
          if (exportRegionBox.startY < exportRegionBox.endY) {
            newStartY = y;
          } else {
            newEndY = y;
          }
        }
        if (exportRegionResizeHandle.includes('s')) {
          // Bottom edge
          if (exportRegionBox.startY < exportRegionBox.endY) {
            newEndY = y;
          } else {
            newStartY = y;
          }
        }
        if (exportRegionResizeHandle.includes('w')) {
          // Left edge
          if (exportRegionBox.startX < exportRegionBox.endX) {
            newStartX = x;
          } else {
            newEndX = x;
          }
        }
        if (exportRegionResizeHandle.includes('e')) {
          // Right edge
          if (exportRegionBox.startX < exportRegionBox.endX) {
            newEndX = x;
          } else {
            newStartX = x;
          }
        }

        setExportRegionBox({ startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY });
      } else if (isSelecting) {
        // Normal selection
        setSelectionBox((prev) => prev ? { ...prev, endX: x, endY: y } : null);
      }
    }
  };

  const confirmExportRegion = () => {
    if (exportRegionBox) {
      const minX = Math.min(exportRegionBox.startX, exportRegionBox.endX);
      const maxX = Math.max(exportRegionBox.startX, exportRegionBox.endX);
      const minY = Math.min(exportRegionBox.startY, exportRegionBox.endY);
      const maxY = Math.max(exportRegionBox.startY, exportRegionBox.endY);

      // Dispatch custom event with bounds for export
      window.dispatchEvent(new CustomEvent('export-region-selected', {
        detail: { minX, maxX, minY, maxY }
      }));

      // Exit export region mode
      setIsExportRegionMode(false);
      setExportRegionBox(null);
      setIsDrawingExportRegion(false);
      setIsResizingExportRegion(false);
    }
  };

  const handleMouseUp = () => {
    if (isDrawingExportRegion) {
      // Just stop drawing, don't trigger export yet
      setIsDrawingExportRegion(false);
    } else if (isResizingExportRegion) {
      // Just stop resizing
      setIsResizingExportRegion(false);
      setExportRegionResizeHandle(null);
    } else if (isSelecting && selectionBox) {
      // Normal selection mode - select all cells within the selection box
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const newSelectedIds = cells
        .filter((cell) => {
          const cellRight = cell.x + cell.width;
          const cellBottom = cell.y + cell.height;

          // Check if cell intersects with selection box
          return !(cell.x > maxX || cellRight < minX || cell.y > maxY || cellBottom < minY);
        })
        .map((cell) => cell.id);

      if (newSelectedIds.length > 0) {
        if (isShiftSelecting) {
          // Add to existing selection (remove duplicates)
          const combinedIds = [...new Set([...selectedCellIds, ...newSelectedIds])];
          setSelectedCells(combinedIds);
        } else {
          // Replace selection
          setSelectedCells(newSelectedIds);
        }
      }

      setIsSelecting(false);
      setIsShiftSelecting(false);
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
      // Check if mouse moved significantly since last mouse down (indicating drag/area-select)
      if (lastMouseDownPos.current) {
        const dx = Math.abs(e.clientX - lastMouseDownPos.current.x);
        const dy = Math.abs(e.clientY - lastMouseDownPos.current.y);
        const timeSinceMouseDown = Date.now() - lastMouseDownPos.current.time;

        // Don't create cell if mouse moved more than 5 pixels or time between clicks is too long
        if (dx > 5 || dy > 5 || timeSinceMouseDown > 400) {
          return;
        }
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / zoom;
      const y = (e.clientY - rect.top - offsetY) / zoom;

      // Shift + double-click creates a connection dot
      if (e.shiftKey) {
        const dotSize = defaultCellStyle.defaultDotSize || 16;
        const dotCell: Cell = {
          id: `cell-${Date.now()}`,
          x: x - dotSize / 2, // Center the dot on cursor
          y: y - dotSize / 2,
          width: dotSize,
          height: dotSize,
          text: '',
          backgroundColor: '#333333',
          textColor: '#ffffff',
          borderColor: '#333333',
          borderThickness: 0,
          borderRadius: dotSize / 2,
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          isDot: true,
        };
        addCell(dotCell);
      } else {
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
    }
  };

  const [timelinePosition, setTimelinePosition] = useState<{ x: number; y: number }>({ x: 100, y: 100 });

  const handleContextMenu = (e: React.MouseEvent) => {
    // Check if we're right-clicking on a contentEditable element (cell in edit mode)
    const target = e.target as HTMLElement;
    const isContentEditable = target.isContentEditable || target.closest('[contenteditable="true"]');

    // If clicking on editable content, don't prevent default - allow native spell check menu
    if (isContentEditable) {
      return;
    }

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

  const handlePinLocation = () => {
    setShowPinLocationModal(true);
    setContextMenu(null);
  };

  const handleConfirmPinLocation = (name: string) => {
    const newLocation = {
      id: `pin-${Date.now()}`,
      name: name,
      offsetX,
      offsetY,
      zoom,
      textColor: '#000000',
      bgColor: '#fffdf5',
    };
    addPinnedLocation(newLocation);
  };

  useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchPanel(true);
    };

    window.addEventListener('open-search', handleOpenSearch);
    return () => window.removeEventListener('open-search', handleOpenSearch);
  }, []);

  useEffect(() => {
    const handleExportRegion = () => {
      setShowExportRegionInstructions(true);
    };

    window.addEventListener('export-region', handleExportRegion);
    return () => window.removeEventListener('export-region', handleExportRegion);
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

      // Escape - Cancel export region mode
      if (e.key === 'Escape' && isExportRegionMode) {
        e.preventDefault();
        setIsExportRegionMode(false);
        setExportRegionBox(null);
        setIsDrawingExportRegion(false);
        setIsResizingExportRegion(false);
        setExportRegionResizeHandle(null);
        return;
      }

      // Enter - Confirm export region selection
      if (e.key === 'Enter' && isExportRegionMode && exportRegionBox && !isDrawingExportRegion) {
        e.preventDefault();
        confirmExportRegion();
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
          const groupIdMap = new Map<string, string>();

          // Create new group IDs for any grouped cells
          clipboardRef.current.cells.forEach((cell) => {
            if (cell.groupId && !groupIdMap.has(cell.groupId)) {
              groupIdMap.set(cell.groupId, `group-${Date.now()}-${Math.random()}`);
            }
          });

          const newCells = clipboardRef.current.cells.map((cell) => {
            const newId = `cell-${Date.now()}-${Math.random()}`;
            idMap.set(cell.id, newId);
            return {
              ...cell,
              id: newId,
              x: cell.x + 20,
              y: cell.y + 20,
              groupId: cell.groupId ? groupIdMap.get(cell.groupId) : undefined,
            };
          });

          // Collect all new connections
          const newConnections: Connection[] = [];
          clipboardRef.current.connections.forEach((conn) => {
            const newFromId = idMap.get(conn.fromCellId);
            const newToId = idMap.get(conn.toCellId);
            if (newFromId && newToId) {
              newConnections.push({
                ...conn,
                id: `conn-${Date.now()}-${Math.random()}`,
                fromCellId: newFromId,
                toCellId: newToId,
              });
            }
          });

          // Add all cells and connections in a single batch operation
          addCellsAndConnections(newCells, newConnections);

          // Select the newly pasted cells
          setSelectedCells(newCells.map((cell) => cell.id));
        }
      }
      // Paste without formatting
      else if (cmdOrCtrl && e.key === 'v' && e.shiftKey) {
        e.preventDefault();
        if (clipboardRef.current.cells.length > 0) {
          const idMap = new Map<string, string>();
          const groupIdMap = new Map<string, string>();

          // Create new group IDs for any grouped cells
          clipboardRef.current.cells.forEach((cell) => {
            if (cell.groupId && !groupIdMap.has(cell.groupId)) {
              groupIdMap.set(cell.groupId, `group-${Date.now()}-${Math.random()}`);
            }
          });

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
              groupId: cell.groupId ? groupIdMap.get(cell.groupId) : undefined,
            };
          });

          // Collect all new connections
          const newConnections: Connection[] = [];
          clipboardRef.current.connections.forEach((conn) => {
            const newFromId = idMap.get(conn.fromCellId);
            const newToId = idMap.get(conn.toCellId);
            if (newFromId && newToId) {
              newConnections.push({
                ...conn,
                id: `conn-${Date.now()}-${Math.random()}`,
                fromCellId: newFromId,
                toCellId: newToId,
                color: defaultCellStyle.defaultConnectionColor,
                style: defaultCellStyle.defaultConnectionStyle,
                strokeWidth: defaultCellStyle.defaultConnectionThickness,
              });
            }
          });

          // Add all cells and connections in a single batch operation
          addCellsAndConnections(newCells, newConnections);

          // Select the newly pasted cells
          setSelectedCells(newCells.map((cell) => cell.id));
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
        {/* Grid rendering */}
        {gridEnabled && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'visible',
            }}
          >
            <defs>
              <pattern
                id="grid-pattern"
                width={gridSize * 4}
                height={gridSize * 4}
                patternUnits="userSpaceOnUse"
              >
                {/* Vertical lines */}
                {[0, 1, 2, 3].map((i) => (
                  <line
                    key={`v-${i}`}
                    x1={i * gridSize}
                    y1={0}
                    x2={i * gridSize}
                    y2={gridSize * 4}
                    stroke={gridColor}
                    strokeOpacity={gridOpacity}
                    strokeWidth={i === 0 ? 2 : 1}
                    strokeDasharray={i === 0 ? 'none' : '4 4'}
                  />
                ))}
                {/* Horizontal lines */}
                {[0, 1, 2, 3].map((i) => (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={i * gridSize}
                    x2={gridSize * 4}
                    y2={i * gridSize}
                    stroke={gridColor}
                    strokeOpacity={gridOpacity}
                    strokeWidth={i === 0 ? 2 : 1}
                    strokeDasharray={i === 0 ? 'none' : '4 4'}
                  />
                ))}
              </pattern>
            </defs>
            <rect
              x={gridBounds.minX}
              y={gridBounds.minY}
              width={gridBounds.maxX - gridBounds.minX}
              height={gridBounds.maxY - gridBounds.minY}
              fill="url(#grid-pattern)"
            />
          </svg>
        )}
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
        {exportRegionBox && (() => {
          const minX = Math.min(exportRegionBox.startX, exportRegionBox.endX);
          const minY = Math.min(exportRegionBox.startY, exportRegionBox.endY);
          const width = Math.abs(exportRegionBox.endX - exportRegionBox.startX);
          const height = Math.abs(exportRegionBox.endY - exportRegionBox.startY);
          const cornerHandleSize = 14;
          const borderThickness = 3;
          const showHandles = !isDrawingExportRegion;

          const cornerHandleStyle = {
            position: 'absolute' as const,
            width: cornerHandleSize,
            height: cornerHandleSize,
            backgroundColor: '#10b981',
            border: '2px solid white',
            borderRadius: 2,
            cursor: 'pointer',
            zIndex: 1003,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          };

          const handleMouseDownOnHandle = (handle: string) => (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsResizingExportRegion(true);
            setExportRegionResizeHandle(handle);
          };

          const handleMouseDownOnBorder = (edge: string) => (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsResizingExportRegion(true);
            setExportRegionResizeHandle(edge);
          };

          return (
            <>
              {/* Main selection box with transparent fill */}
              <div
                style={{
                  position: 'absolute',
                  left: minX,
                  top: minY,
                  width,
                  height,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              />

              {/* Draggable borders */}
              {showHandles && (
                <>
                  {/* Top border */}
                  <div
                    onMouseDown={handleMouseDownOnBorder('n')}
                    style={{
                      position: 'absolute',
                      left: minX,
                      top: minY - borderThickness,
                      width,
                      height: borderThickness * 2,
                      backgroundColor: '#10b981',
                      cursor: 'n-resize',
                      zIndex: 1001,
                    }}
                  />
                  {/* Bottom border */}
                  <div
                    onMouseDown={handleMouseDownOnBorder('s')}
                    style={{
                      position: 'absolute',
                      left: minX,
                      top: minY + height - borderThickness,
                      width,
                      height: borderThickness * 2,
                      backgroundColor: '#10b981',
                      cursor: 's-resize',
                      zIndex: 1001,
                    }}
                  />
                  {/* Left border */}
                  <div
                    onMouseDown={handleMouseDownOnBorder('w')}
                    style={{
                      position: 'absolute',
                      left: minX - borderThickness,
                      top: minY,
                      width: borderThickness * 2,
                      height,
                      backgroundColor: '#10b981',
                      cursor: 'w-resize',
                      zIndex: 1001,
                    }}
                  />
                  {/* Right border */}
                  <div
                    onMouseDown={handleMouseDownOnBorder('e')}
                    style={{
                      position: 'absolute',
                      left: minX + width - borderThickness,
                      top: minY,
                      width: borderThickness * 2,
                      height,
                      backgroundColor: '#10b981',
                      cursor: 'e-resize',
                      zIndex: 1001,
                    }}
                  />

                  {/* Corner handles - larger squares */}
                  <div style={{ ...cornerHandleStyle, left: minX - cornerHandleSize/2, top: minY - cornerHandleSize/2, cursor: 'nw-resize' }} onMouseDown={handleMouseDownOnHandle('nw')} />
                  <div style={{ ...cornerHandleStyle, left: minX + width - cornerHandleSize/2, top: minY - cornerHandleSize/2, cursor: 'ne-resize' }} onMouseDown={handleMouseDownOnHandle('ne')} />
                  <div style={{ ...cornerHandleStyle, left: minX - cornerHandleSize/2, top: minY + height - cornerHandleSize/2, cursor: 'sw-resize' }} onMouseDown={handleMouseDownOnHandle('sw')} />
                  <div style={{ ...cornerHandleStyle, left: minX + width - cornerHandleSize/2, top: minY + height - cornerHandleSize/2, cursor: 'se-resize' }} onMouseDown={handleMouseDownOnHandle('se')} />

                  {/* Confirm button */}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={confirmExportRegion}
                    style={{
                      position: 'absolute',
                      left: minX + width/2 - 50,
                      top: minY + height + 15,
                      padding: '8px 20px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      zIndex: 1002,
                    }}
                  >
                    Confirm
                  </button>
                </>
              )}

              {/* Non-interactive border when drawing */}
              {!showHandles && (
                <div
                  style={{
                    position: 'absolute',
                    left: minX,
                    top: minY,
                    width,
                    height,
                    border: '3px solid #10b981',
                    pointerEvents: 'none',
                    zIndex: 1001,
                  }}
                />
              )}
            </>
          );
        })()}
        {isExportRegionMode && (
          <div
            style={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(16, 185, 129, 0.95)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 10001,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {isDrawingExportRegion
              ? 'Draw a box around the region to export • Press ESC to cancel'
              : 'Adjust the selection • Press ENTER to confirm • Press ESC to cancel'}
          </div>
        )}
      </div>

      <ZoomControls onTogglePinnedLocations={() => setShowPinnedLocations(!showPinnedLocations)} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onOpenTimelineModal={handleOpenTimelineModal}
          onPinLocation={handlePinLocation}
        />
      )}

      <PinnedLocations
        isOpen={showPinnedLocations}
        onClose={() => setShowPinnedLocations(false)}
      />

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

      {showExportRegionInstructions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 32,
              maxWidth: 480,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 24, fontWeight: 600, color: '#333' }}>
              Export Region
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: 16, lineHeight: 1.6, color: '#666' }}>
              Draw a rectangular box around the area you want to export.
              Click and drag on the canvas to select your region.
            </p>
            <ul style={{ margin: '0 0 24px 0', paddingLeft: 24, fontSize: 14, lineHeight: 1.8, color: '#666' }}>
              <li>Click and drag to draw the selection box</li>
              <li>A green banner will guide you</li>
              <li>Press ESC to cancel anytime</li>
              <li>Choose PNG or PDF format after selecting</li>
            </ul>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowExportRegionInstructions(false);
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowExportRegionInstructions(false);
                  setIsExportRegionMode(true);
                  setExportRegionBox(null);
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Start Selection
              </button>
            </div>
          </div>
        </div>
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

      {showPinLocationModal && (
        <PinLocationModal
          onConfirm={handleConfirmPinLocation}
          onClose={() => setShowPinLocationModal(false)}
        />
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
  const [position, setPosition] = useState({ x, y });
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

  // Smart positioning: adjust if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;

      let newX = x;
      let newY = y;

      if (x + menuRect.width > viewportWidth - margin) {
        newX = Math.max(margin, viewportWidth - menuRect.width - margin);
      }

      if (newX < margin) {
        newX = margin;
      }

      if (y + menuRect.height > viewportHeight - margin) {
        newY = y - menuRect.height;
        if (newY < margin) {
          newY = Math.max(margin, viewportHeight - menuRect.height - margin);
        }
      }

      if (newY < margin) {
        newY = margin;
      }

      if (newX !== position.x || newY !== position.y) {
        setPosition({ x: newX, y: newY });
      }
    }
  }, [x, y, position.x, position.y]);

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

  const handleReverseDirection = () => {
    updateConnection(connectionId, {
      fromCellId: connection.toCellId,
      toCellId: connection.fromCellId,
      fromPinIndex: connection.toPinIndex,
      toPinIndex: connection.fromPinIndex,
    });
    saveHistory();
    onClose();
  };

  const handleThickness = (thickness: number) => {
    updateConnection(connectionId, { strokeWidth: thickness });
    saveHistory();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
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
        <MenuItem onClick={() => handleStyle('Arrow')}>Arrow</MenuItem>
        <MenuDivider />
        <ConnectionMenuSubmenu label="Thickness">
          <MenuItem onClick={() => handleThickness(1)}>1px</MenuItem>
          <MenuItem onClick={() => handleThickness(2)}>2px</MenuItem>
          <MenuItem onClick={() => handleThickness(3)}>3px</MenuItem>
          <MenuItem onClick={() => handleThickness(4)}>4px</MenuItem>
          <MenuItem onClick={() => handleThickness(5)}>5px</MenuItem>
          <MenuItem onClick={() => handleThickness(6)}>6px</MenuItem>
          <MenuItem onClick={() => handleThickness(7)}>7px</MenuItem>
          <MenuItem onClick={() => handleThickness(8)}>8px</MenuItem>
          <MenuItem onClick={() => handleThickness(9)}>9px</MenuItem>
          <MenuItem onClick={() => handleThickness(10)}>10px</MenuItem>
          <MenuItem onClick={() => handleThickness(11)}>11px</MenuItem>
          <MenuItem onClick={() => handleThickness(12)}>12px</MenuItem>
          <MenuItem onClick={() => handleThickness(13)}>13px</MenuItem>
          <MenuItem onClick={() => handleThickness(14)}>14px</MenuItem>
          <MenuItem onClick={() => handleThickness(15)}>15px</MenuItem>
          <MenuItem onClick={() => handleThickness(16)}>16px</MenuItem>
          <MenuItem onClick={() => handleThickness(17)}>17px</MenuItem>
          <MenuItem onClick={() => handleThickness(18)}>18px</MenuItem>
          <MenuItem onClick={() => handleThickness(19)}>19px</MenuItem>
          <MenuItem onClick={() => handleThickness(20)}>20px</MenuItem>
          <MenuItem onClick={() => handleThickness(21)}>21px</MenuItem>
          <MenuItem onClick={() => handleThickness(22)}>22px</MenuItem>
          <MenuItem onClick={() => handleThickness(23)}>23px</MenuItem>
          <MenuItem onClick={() => handleThickness(24)}>24px</MenuItem>
        </ConnectionMenuSubmenu>
        <MenuDivider />
        <MenuItem onClick={handleReverseDirection}>Reverse Direction</MenuItem>
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

function ConnectionMenuSubmenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ left?: number; top?: number; maxHeight?: number }>({});

  useEffect(() => {
    if (isOpen && submenuRef.current && containerRef.current) {
      const submenuRect = submenuRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;

      let position: { left?: number; top?: number; maxHeight?: number } = {};

      // Position to the right of menu item
      let targetLeft = containerRect.right;
      let targetTop = containerRect.top;

      // Check if submenu would overflow right edge
      if (targetLeft + submenuRect.width > viewportWidth - margin) {
        targetLeft = containerRect.left - submenuRect.width;
        if (targetLeft < margin) {
          targetLeft = margin;
        }
      }

      position.left = targetLeft;

      // Calculate available height
      const availableHeightBelow = viewportHeight - containerRect.top - margin;
      position.maxHeight = Math.min(600, Math.max(150, availableHeightBelow));

      // If submenu would overflow bottom, shift it up
      const estimatedSubmenuHeight = Math.min(submenuRect.height, position.maxHeight);
      if (containerRect.top + estimatedSubmenuHeight > viewportHeight - margin) {
        const overflow = (containerRect.top + estimatedSubmenuHeight) - (viewportHeight - margin);
        targetTop = containerRect.top - overflow;

        if (targetTop < margin) {
          targetTop = margin;
          position.maxHeight = Math.min(600, viewportHeight - (2 * margin));
        }
      }

      position.top = targetTop;
      setSubmenuPosition(position);
    }
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10 }}>▶</span>
      </div>
      {isOpen && (
        <div
          ref={submenuRef}
          style={{
            position: 'fixed',
            left: submenuPosition.left,
            top: submenuPosition.top,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10001,
            minWidth: 120,
            maxHeight: submenuPosition.maxHeight,
            overflowY: 'auto',
            padding: '4px 0',
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Canvas;
