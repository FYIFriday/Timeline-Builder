import { useState, useRef, useEffect, useCallback } from 'react';
import { Cell, TimelineConfig, Connection } from '../types';
import { useStore } from '../store';

interface CellComponentProps {
  cell: Cell;
  isSelected: boolean;
}

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

function CellComponent({ cell, isSelected }: CellComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(cell.text);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [isHoveringForConnection, setIsHoveringForConnection] = useState(false);
  const [connectionTargetId, setConnectionTargetId] = useState<string | null>(null);
  const [connectionTargetPinIndex, setConnectionTargetPinIndex] = useState<number | undefined>(undefined);
  const [connectionFromPinIndex, setConnectionFromPinIndex] = useState<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use refs to avoid stale closures in event handlers
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const resizeDirectionRef = useRef<ResizeDirection>(null);
  const allCellsResizeStartRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

  const {
    updateCell,
    setSelectedCells,
    addSelectedCell,
    selectedCellIds,
    zoom,
    offsetX,
    offsetY,
    saveHistory,
    addConnection,
    cells,
  } = useStore();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      autoResizeTextarea();
    }
  }, [isEditing]);

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      addSelectedCell(cell.id);
    } else {
      setSelectedCells([cell.id]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Select the cell when right-clicking, but don't stop propagation
    // so the canvas can show the context menu
    if (!selectedCellIds.includes(cell.id)) {
      setSelectedCells([cell.id]);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    autoResizeTextarea();
  };

  const handleTextBlur = () => {
    setIsEditing(false);

    // Auto-delete if cell is completely empty
    if (editText.trim() === '') {
      const { deleteCells } = useStore.getState();
      deleteCells([cell.id]);
      return;
    }

    // Only auto-resize if the cell hasn't been manually resized
    if (!cell.manuallyResized) {
      // Calculate text dimensions to resize cell
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Include italic in font string for accurate measurement
        const fontStyle = cell.italic ? 'italic ' : '';
        const fontWeight = cell.bold ? 'bold ' : '';
        ctx.font = `${fontStyle}${fontWeight}${cell.fontSize}px ${cell.fontFamily}`;

        const lines = editText.split('\n');
        const horizontalPadding = 32;
        const verticalPadding = 24;
        const lineHeight = cell.fontSize * 1.5;

        // Calculate width: use a reasonable default, only expand for very long single words
        let newWidth = 200; // Default reasonable width

        // Check each line for long single words that won't wrap
        lines.forEach(line => {
          const words = line.split(/\s+/);
          words.forEach(word => {
            const wordWidth = ctx.measureText(word).width;
            if (wordWidth + horizontalPadding > newWidth) {
              newWidth = Math.ceil(wordWidth + horizontalPadding);
            }
          });
        });

        // Cap maximum width
        newWidth = Math.min(newWidth, 600);

        // Calculate height based on number of lines with extra space to prevent clipping
        const textHeight = lines.length * lineHeight;
        const newHeight = Math.max(30, Math.ceil(textHeight + verticalPadding * 2));

        updateCell(cell.id, {
          text: editText,
          width: newWidth,
          height: newHeight
        });
      } else {
        updateCell(cell.id, { text: editText });
      }
    } else {
      // Just update the text, keep the size
      updateCell(cell.id, { text: editText });
    }

    saveHistory();
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(cell.text);
    }
    // Toggle Bold
    else if (cmdOrCtrl && e.key === 'b') {
      e.preventDefault();
      updateCell(cell.id, { bold: !cell.bold });
    }
    // Toggle Italic
    else if (cmdOrCtrl && e.key === 'i') {
      e.preventDefault();
      updateCell(cell.id, { italic: !cell.italic });
    }
    // Toggle Underline
    else if (cmdOrCtrl && e.key === 'u') {
      e.preventDefault();
      updateCell(cell.id, { underline: !cell.underline });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      // Ctrl/Cmd+drag to create connection
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isConnectionModifier = isMac ? e.metaKey : e.ctrlKey;

      if (isConnectionModifier) {
        e.preventDefault();

        // Check if clicking on a timeline pin
        if (cell.isTimeline) {
          const target = e.target as HTMLElement;
          const pinElement = target.closest('[data-pin-index]');
          if (pinElement) {
            const pinIndex = pinElement.getAttribute('data-pin-index');
            if (pinIndex !== null) {
              setConnectionFromPinIndex(parseInt(pinIndex));
            }
          }
        }

        setIsConnecting(true);
        setConnectionEnd({ x: e.clientX, y: e.clientY });
      } else {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;

      selectedCellIds.forEach((id) => {
        const targetCell = useStore.getState().cells.find((c) => c.id === id);
        if (targetCell) {
          updateCell(id, {
            x: targetCell.x + dx,
            y: targetCell.y + dy,
          });
        }
      });

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (isResizing) {
      const dx = (e.clientX - resizeStartRef.current.x) / zoom;
      const dy = (e.clientY - resizeStartRef.current.y) / zoom;
      const dir = resizeDirectionRef.current;

      let newX = resizeStartRef.current.cellX;
      let newY = resizeStartRef.current.cellY;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Handle horizontal resizing
      if (dir?.includes('e')) {
        newWidth = Math.max(50, resizeStartRef.current.width + dx);
      } else if (dir?.includes('w')) {
        const widthChange = -dx;
        newWidth = Math.max(50, resizeStartRef.current.width + widthChange);
        newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      }

      // Handle vertical resizing
      if (dir?.includes('s')) {
        newHeight = Math.max(30, resizeStartRef.current.height + dy);
      } else if (dir?.includes('n')) {
        const heightChange = -dy;
        newHeight = Math.max(30, resizeStartRef.current.height + heightChange);
        newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
      }

      // Calculate scale factors
      const widthScale = newWidth / resizeStartRef.current.width;
      const heightScale = newHeight / resizeStartRef.current.height;

      // Update the current cell
      updateCell(cell.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

      // Apply proportional scaling to all other selected cells
      selectedCellIds.forEach((id) => {
        if (id !== cell.id) {
          const initialDims = allCellsResizeStartRef.current.get(id);
          if (initialDims) {
            let otherNewWidth = initialDims.width * widthScale;
            let otherNewHeight = initialDims.height * heightScale;
            let otherNewX = initialDims.x;
            let otherNewY = initialDims.y;

            // Adjust position for west/north directions
            if (dir?.includes('w')) {
              otherNewX = initialDims.x + (initialDims.width - otherNewWidth);
            }
            if (dir?.includes('n')) {
              otherNewY = initialDims.y + (initialDims.height - otherNewHeight);
            }

            updateCell(id, {
              x: otherNewX,
              y: otherNewY,
              width: Math.max(50, otherNewWidth),
              height: Math.max(30, otherNewHeight),
            });
          }
        }
      });
    } else if (isConnecting) {
      setConnectionEnd({ x: e.clientX, y: e.clientY });

      // Find which cell is under the cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);

      // Check if hovering over a timeline pin
      const pinElement = element?.closest('[data-pin-index]');
      const cellElement = element?.closest('[data-cell-id]');

      if (cellElement) {
        const targetId = cellElement.getAttribute('data-cell-id');
        if (targetId && targetId !== cell.id) {
          setConnectionTargetId(targetId);

          // If it's a timeline cell, get the pin index
          if (pinElement) {
            const pinIndex = pinElement.getAttribute('data-pin-index');
            if (pinIndex !== null) {
              setConnectionTargetPinIndex(parseInt(pinIndex));
            }
          } else {
            setConnectionTargetPinIndex(undefined);
          }

          setIsHoveringForConnection(true);
        } else {
          setConnectionTargetId(null);
          setConnectionTargetPinIndex(undefined);
          setIsHoveringForConnection(false);
        }
      } else {
        setConnectionTargetId(null);
        setConnectionTargetPinIndex(undefined);
        setIsHoveringForConnection(false);
      }
    }
  }, [isDragging, isResizing, isConnecting, zoom, selectedCellIds, updateCell, cell.id]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      saveHistory();
    }
    if (isResizing) {
      // Mark all selected cells as manually resized
      selectedCellIds.forEach((id) => {
        updateCell(id, { manuallyResized: true });
      });
    }
    if (isConnecting) {
      // Create connection if we have a target
      if (connectionTargetId && connectionTargetId !== cell.id) {
        const newConnection = {
          id: `conn-${Date.now()}`,
          fromCellId: cell.id,
          toCellId: connectionTargetId,
          color: '#000000',
          style: 'Dashed' as const,
          fromPinIndex: connectionFromPinIndex,
          toPinIndex: connectionTargetPinIndex,
        };
        addConnection(newConnection);
        saveHistory();
      }
      setIsConnecting(false);
      setIsHoveringForConnection(false);
      setConnectionTargetId(null);
      setConnectionTargetPinIndex(undefined);
      setConnectionFromPinIndex(undefined);
    }
    setIsDragging(false);
    setIsResizing(false);
  }, [isDragging, isResizing, isConnecting, connectionTargetId, connectionTargetPinIndex, connectionFromPinIndex, cell.id, addConnection, saveHistory, updateCell]);

  const handleMouseEnterForConnection = (targetCellId: string) => {
    if (isConnecting && targetCellId !== cell.id) {
      setIsHoveringForConnection(true);
      setConnectionTargetId(targetCellId);
    }
  };

  const handleMouseLeaveForConnection = () => {
    setIsHoveringForConnection(false);
    setConnectionTargetId(null);
  };

  useEffect(() => {
    if (isDragging || isResizing || isConnecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isConnecting, handleMouseMove, handleMouseUp]);

  const handleResizeMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: cell.width,
      height: cell.height,
      cellX: cell.x,
      cellY: cell.y,
    };
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: cell.width,
      height: cell.height,
      cellX: cell.x,
      cellY: cell.y,
    });

    // Store initial dimensions of all selected cells for multi-cell resizing
    const initialDimensions = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectedCellIds.forEach((id) => {
      const targetCell = cells.find((c) => c.id === id);
      if (targetCell) {
        initialDimensions.set(id, {
          x: targetCell.x,
          y: targetCell.y,
          width: targetCell.width,
          height: targetCell.height,
        });
      }
    });
    allCellsResizeStartRef.current = initialDimensions;
  };

  const fontStyle = {
    fontFamily: cell.fontFamily,
    fontSize: `${cell.fontSize}px`,
    fontWeight: cell.bold ? 'bold' : 'normal',
    fontStyle: cell.italic ? 'italic' : 'normal',
    textDecoration: `${cell.underline ? 'underline' : ''} ${cell.strikethrough ? 'line-through' : ''}`.trim(),
  };

  if (cell.isTimeline && cell.timelineConfig) {
    return (
      <TimelineCell
        cell={cell}
        isSelected={isSelected}
        onCellClick={handleCellClick}
        onMouseDown={handleMouseDown}
        zoom={zoom}
        offsetX={offsetX}
        offsetY={offsetY}
        updateCell={updateCell}
        saveHistory={saveHistory}
      />
    );
  }

  return (
    <>
      <div
        data-cell-id={cell.id}
        onClick={handleCellClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => handleMouseEnterForConnection(cell.id)}
        onMouseLeave={handleMouseLeaveForConnection}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
          backgroundColor: cell.backgroundColor,
          color: cell.textColor,
          border: isSelected
            ? '2px solid #3b82f6'
            : isHoveringForConnection
            ? '2px solid #10b981'
            : cell.borderThickness > 0
            ? `${cell.borderThickness}px solid ${cell.borderColor}`
            : 'none',
          borderRadius: `${cell.borderRadius}px`,
          padding: '12px',
          cursor: isConnecting ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxSizing: 'border-box',
          ...fontStyle,
        }}
      >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            backgroundColor: 'transparent',
            color: cell.textColor,
            ...fontStyle,
          }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {cell.text}
        </div>
      )}

      {isSelected && !isEditing && (
        <>
          {/* Corner handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            style={{
              position: 'absolute',
              left: -3,
              top: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            style={{
              position: 'absolute',
              right: -3,
              top: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            style={{
              position: 'absolute',
              left: -3,
              bottom: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
            }}
          />
          {/* Edge handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
            style={{
              position: 'absolute',
              left: '50%',
              top: -2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
            style={{
              position: 'absolute',
              right: -2,
              top: '50%',
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              transform: 'translateY(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
            style={{
              position: 'absolute',
              left: -2,
              top: '50%',
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              transform: 'translateY(-50%)',
            }}
          />
        </>
      )}
    </div>

    {isConnecting && (() => {
      // Calculate start position based on whether it's a timeline pin
      let startX = cell.x * zoom + offsetX + (cell.width * zoom) / 2;
      let startY = cell.y * zoom + offsetY + (cell.height * zoom) / 2;

      if (cell.isTimeline && connectionFromPinIndex !== undefined && cell.timelineConfig) {
        const config = cell.timelineConfig;
        const isHorizontal = config.orientation === 'Horizontal';

        // Calculate number of intervals
        let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
        const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
        const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
        const display = config.displayInterval || 1;
        let intervalCount = 0;

        if (config.reverse) {
          while (current >= end) {
            if ((Math.max(config.startNumber, config.endNumber) - current) % display === 0) {
              intervalCount++;
            }
            current -= step;
          }
        } else {
          while (current <= end) {
            if ((current - config.startNumber) % display === 0) {
              intervalCount++;
            }
            current += step;
          }
        }

        // Calculate item dimensions
        let itemWidth: number;
        let itemHeight: number;

        if (cell.manuallyResized) {
          itemWidth = isHorizontal ? cell.width / intervalCount : cell.width;
          itemHeight = isHorizontal ? cell.height : cell.height / intervalCount;
        } else {
          itemWidth = isHorizontal ? 60 : 40;
          itemHeight = isHorizontal ? 40 : 60;
        }

        if (isHorizontal) {
          startX = (cell.x + connectionFromPinIndex * itemWidth + itemWidth / 2) * zoom + offsetX;
          startY = (cell.y + itemHeight / 2) * zoom + offsetY;
        } else {
          startX = (cell.x + itemWidth / 2) * zoom + offsetX;
          startY = (cell.y + connectionFromPinIndex * itemHeight + itemHeight / 2) * zoom + offsetY;
        }
      }

      return (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <line
            x1={startX}
            y1={startY}
            x2={connectionEnd.x}
            y2={connectionEnd.y}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        </svg>
      );
    })()}
    </>
  );
}

interface TimelineCellProps {
  cell: Cell;
  isSelected: boolean;
  onCellClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  zoom: number;
  offsetX: number;
  offsetY: number;
  updateCell: (id: string, updates: Partial<Cell>) => void;
  saveHistory: () => void;
}

function TimelineCell({ cell, isSelected, onCellClick, onMouseDown, zoom, offsetX, offsetY, updateCell, saveHistory }: TimelineCellProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const resizeDirectionRef = useRef<ResizeDirection>(null);
  const allCellsResizeStartRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

  const { selectedCellIds, cells } = useStore();
  const config = cell.timelineConfig!;
  const numbers: number[] = [];

  const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
  const display = config.displayInterval || 1;

  // When reverse is checked, start from the higher number and go down
  let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
  const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
  const startForModulo = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

  if (config.reverse) {
    while (current >= end) {
      if ((startForModulo - current) % display === 0) {
        numbers.push(current);
      }
      current -= step;
    }
  } else {
    while (current <= end) {
      if ((current - startForModulo) % display === 0) {
        numbers.push(current);
      }
      current += step;
    }
  }

  const isHorizontal = config.orientation === 'Horizontal';

  // If manually resized, calculate item size based on cell dimensions
  // Otherwise use default sizes
  let itemWidth: number;
  let itemHeight: number;
  let totalWidth: number;
  let totalHeight: number;

  if (cell.manuallyResized) {
    // Use the cell's actual dimensions
    totalWidth = cell.width;
    totalHeight = cell.height;
    itemWidth = isHorizontal ? cell.width / numbers.length : cell.width;
    itemHeight = isHorizontal ? cell.height : cell.height / numbers.length;
  } else {
    // Use default sizes
    itemWidth = isHorizontal ? 60 : 40;
    itemHeight = isHorizontal ? 40 : 60;
    totalWidth = isHorizontal ? numbers.length * itemWidth : itemWidth;
    totalHeight = isHorizontal ? itemHeight : numbers.length * itemHeight;
  }

  const handleResizeMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: cell.width,
      height: cell.height,
      cellX: cell.x,
      cellY: cell.y,
    };

    // Store initial dimensions of all selected cells for multi-cell resizing
    const initialDimensions = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectedCellIds.forEach((id) => {
      const targetCell = cells.find((c) => c.id === id);
      if (targetCell) {
        initialDimensions.set(id, {
          x: targetCell.x,
          y: targetCell.y,
          width: targetCell.width,
          height: targetCell.height,
        });
      }
    });
    allCellsResizeStartRef.current = initialDimensions;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const dx = (e.clientX - resizeStartRef.current.x) / zoom;
      const dy = (e.clientY - resizeStartRef.current.y) / zoom;
      const dir = resizeDirectionRef.current;

      let newX = resizeStartRef.current.cellX;
      let newY = resizeStartRef.current.cellY;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Handle horizontal resizing
      if (dir?.includes('e')) {
        newWidth = Math.max(50, resizeStartRef.current.width + dx);
      } else if (dir?.includes('w')) {
        const widthChange = -dx;
        newWidth = Math.max(50, resizeStartRef.current.width + widthChange);
        newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      }

      // Handle vertical resizing
      if (dir?.includes('s')) {
        newHeight = Math.max(30, resizeStartRef.current.height + dy);
      } else if (dir?.includes('n')) {
        const heightChange = -dy;
        newHeight = Math.max(30, resizeStartRef.current.height + heightChange);
        newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
      }

      // Calculate scale factors
      const widthScale = newWidth / resizeStartRef.current.width;
      const heightScale = newHeight / resizeStartRef.current.height;

      // Update the current cell
      updateCell(cell.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

      // Apply proportional scaling to all other selected cells
      selectedCellIds.forEach((id) => {
        if (id !== cell.id) {
          const initialDims = allCellsResizeStartRef.current.get(id);
          if (initialDims) {
            let otherNewWidth = initialDims.width * widthScale;
            let otherNewHeight = initialDims.height * heightScale;
            let otherNewX = initialDims.x;
            let otherNewY = initialDims.y;

            // Adjust position for west/north directions
            if (dir?.includes('w')) {
              otherNewX = initialDims.x + (initialDims.width - otherNewWidth);
            }
            if (dir?.includes('n')) {
              otherNewY = initialDims.y + (initialDims.height - otherNewHeight);
            }

            updateCell(id, {
              x: otherNewX,
              y: otherNewY,
              width: Math.max(50, otherNewWidth),
              height: Math.max(30, otherNewHeight),
            });
          }
        }
      });
    }
  }, [isResizing, zoom, cell.id, updateCell, selectedCellIds]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      saveHistory();
      // Mark all selected cells as manually resized
      selectedCellIds.forEach((id) => {
        updateCell(id, { manuallyResized: true });
      });
    }
    setIsResizing(false);
    setResizeDirection(null);
    resizeDirectionRef.current = null;
  }, [isResizing, cell.id, updateCell, saveHistory, selectedCellIds]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <>
      <div
        data-cell-id={cell.id}
        onClick={onCellClick}
        onMouseDown={isResizing ? undefined : onMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: totalWidth,
          height: totalHeight,
          backgroundColor: cell.backgroundColor,
          color: cell.textColor,
          fontSize: `${cell.fontSize}px`,
          fontFamily: cell.fontFamily,
          fontWeight: cell.bold ? 'bold' : 'normal',
          fontStyle: cell.italic ? 'italic' : 'normal',
          textDecoration: `${cell.underline ? 'underline' : ''} ${cell.strikethrough ? 'line-through' : ''}`.trim(),
          border: isSelected ? '2px solid #3b82f6' : 'none',
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          cursor: isResizing ? 'default' : 'grab',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        {numbers.map((num, index) => (
          <div
            key={index}
            data-pin-index={index}
            style={{
              width: isHorizontal ? itemWidth : '100%',
              height: isHorizontal ? '100%' : itemHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isHorizontal ? '2px 0' : '0 2px',
              boxSizing: 'border-box',
              borderRight: isHorizontal && index < numbers.length - 1 ? '1px solid #ccc' : 'none',
              borderBottom: !isHorizontal && index < numbers.length - 1 ? '1px solid #ccc' : 'none',
              position: 'relative',
            }}
          >
            {num}
            {isHovering && (
              <div
                data-connection-pin="true"
                data-cell-id={cell.id}
                data-pin-index={index}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            style={{
              position: 'absolute',
              left: cell.x - 3,
              top: cell.y - 3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            style={{
              position: 'absolute',
              left: cell.x + totalWidth - 2,
              top: cell.y - 3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            style={{
              position: 'absolute',
              left: cell.x + totalWidth - 2,
              top: cell.y + totalHeight - 2,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            style={{
              position: 'absolute',
              left: cell.x - 3,
              top: cell.y + totalHeight - 2,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
          {/* Edge handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
            style={{
              position: 'absolute',
              left: cell.x + totalWidth / 2 - 8,
              top: cell.y - 2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
            style={{
              position: 'absolute',
              left: cell.x + totalWidth / 2 - 8,
              top: cell.y + totalHeight - 2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
            style={{
              position: 'absolute',
              left: cell.x + totalWidth - 2,
              top: cell.y + totalHeight / 2 - 8,
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
            style={{
              position: 'absolute',
              left: cell.x - 2,
              top: cell.y + totalHeight / 2 - 8,
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              zIndex: 11,
            }}
          />
        </>
      )}
    </>
  );
}

export default CellComponent;
