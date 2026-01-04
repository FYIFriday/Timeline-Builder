import { useState, useEffect, useRef, useCallback } from 'react';
import { Cell } from '../types';
import { useStore } from '../store';

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

interface ImageCellComponentProps {
  cell: Cell;
  isSelected: boolean;
  onCellClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
  zoom: number;
}

function ImageCellComponent({
  cell,
  isSelected,
  onCellClick,
  onContextMenu,
  onMouseDown,
  isDragging,
  zoom
}: ImageCellComponentProps) {
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState(cell.imageCrop || { x: 0, y: 0, width: 1, height: 1 });
  const [cropDragStart, setCropDragStart] = useState<{ x: number; y: number; handle: string } | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const resizeDirectionRef = useRef<ResizeDirection>(null);

  const { updateCell, saveHistory, selectedCellIds, cells } = useStore();

  const handleImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCropping(true);
    // Store original dimensions for crop calculations
    setOriginalDimensions({ x: cell.x, y: cell.y, width: cell.width, height: cell.height });
    // Start with current crop state (or full if uncropped)
    setCropRect(cell.imageCrop || { x: 0, y: 0, width: 1, height: 1 });
  };

  const handleCropMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setCropDragStart({ x: e.clientX, y: e.clientY, handle });
  };

  useEffect(() => {
    if (!cropDragStart) return;

    const handleCropMouseMove = (e: MouseEvent) => {
      // Use original dimensions for delta calculations
      const dx = (e.clientX - cropDragStart.x) / (originalDimensions.width * zoom);
      const dy = (e.clientY - cropDragStart.y) / (originalDimensions.height * zoom);

      setCropRect((prev) => {
        let newRect = { ...prev };
        const handle = cropDragStart.handle;

        if (handle.includes('n')) {
          newRect.y = Math.max(0, Math.min(prev.y + dy, prev.y + prev.height - 0.1));
          newRect.height = prev.height - (newRect.y - prev.y);
        }
        if (handle.includes('s')) {
          newRect.height = Math.max(0.1, Math.min(1 - prev.y, prev.height + dy));
        }
        if (handle.includes('w')) {
          newRect.x = Math.max(0, Math.min(prev.x + dx, prev.x + prev.width - 0.1));
          newRect.width = prev.width - (newRect.x - prev.x);
        }
        if (handle.includes('e')) {
          newRect.width = Math.max(0.1, Math.min(1 - prev.x, prev.width + dx));
        }

        // Update cell dimensions in real-time based on crop
        const newWidth = originalDimensions.width * newRect.width;
        const newHeight = originalDimensions.height * newRect.height;
        const newX = originalDimensions.x + (newRect.x * originalDimensions.width);
        const newY = originalDimensions.y + (newRect.y * originalDimensions.height);

        updateCell(cell.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          imageCrop: newRect
        });

        return newRect;
      });
      setCropDragStart({ x: e.clientX, y: e.clientY, handle: cropDragStart.handle });
    };

    const handleCropMouseUp = () => {
      setCropDragStart(null);
      setIsCropping(false);

      // Cell has already been resized and imageCrop updated in real-time
      // Don't reset imageCrop - it contains the info needed to maintain proper scale
      saveHistory();
    };

    document.addEventListener('mousemove', handleCropMouseMove);
    document.addEventListener('mouseup', handleCropMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleCropMouseMove);
      document.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [cropDragStart, cropRect, cell.id, updateCell, saveHistory, zoom, originalDimensions]);

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
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const dx = (e.clientX - resizeStartRef.current.x) / zoom;
    const dy = (e.clientY - resizeStartRef.current.y) / zoom;
    const dir = resizeDirectionRef.current;

    // Calculate aspect ratio
    const aspectRatio = resizeStartRef.current.width / resizeStartRef.current.height;

    let newX = resizeStartRef.current.cellX;
    let newY = resizeStartRef.current.cellY;
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;

    // Handle resizing while maintaining aspect ratio
    if (dir?.includes('e')) {
      newWidth = Math.max(50, resizeStartRef.current.width + dx);
      newHeight = newWidth / aspectRatio;
    } else if (dir?.includes('w')) {
      newWidth = Math.max(50, resizeStartRef.current.width - dx);
      newHeight = newWidth / aspectRatio;
      newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
    } else if (dir?.includes('s')) {
      newHeight = Math.max(30, resizeStartRef.current.height + dy);
      newWidth = newHeight * aspectRatio;
    } else if (dir?.includes('n')) {
      newHeight = Math.max(30, resizeStartRef.current.height - dy);
      newWidth = newHeight * aspectRatio;
      newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
    }

    updateCell(cell.id, {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    });
  }, [isResizing, zoom, cell.id, updateCell]);

  const handleResizeMouseUp = useCallback(() => {
    if (isResizing) {
      saveHistory();
    }
    setIsResizing(false);
    setResizeDirection(null);
    resizeDirectionRef.current = null;
  }, [isResizing, saveHistory]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  const crop = isCropping ? cropRect : (cell.imageCrop || { x: 0, y: 0, width: 1, height: 1 });

  // Calculate background size and position in pixels to maintain original scale
  // Derive original image dimensions from current cell size and crop info
  let bgWidth: number;
  let bgHeight: number;

  if (isCropping) {
    // During cropping, use stored original dimensions
    bgWidth = originalDimensions.width;
    bgHeight = originalDimensions.height;
  } else {
    // After cropping, calculate original dimensions from cell size and imageCrop
    // originalWidth = cellWidth / cropWidth (what portion of original is visible)
    bgWidth = cell.width / (crop.width || 1);
    bgHeight = cell.height / (crop.height || 1);
  }

  const bgOffsetX = -(crop.x * bgWidth);
  const bgOffsetY = -(crop.y * bgHeight);

  return (
    <>
      <div
        data-cell-id={cell.id}
        onClick={onCellClick}
        onDoubleClick={handleImageDoubleClick}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
          border: isSelected ? '2px solid #3b82f6' : `${cell.borderThickness}px solid ${cell.borderColor}`,
          borderRadius: `${cell.borderRadius}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: 10,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${cell.imageData})`,
            backgroundPosition: `${bgOffsetX}px ${bgOffsetY}px`,
            backgroundSize: `${bgWidth}px ${bgHeight}px`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>

      {isCropping && (
        <>
          {/* Crop handles - corners */}
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + crop.x * originalDimensions.width - 4,
              top: originalDimensions.y + crop.y * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + (crop.x + crop.width) * originalDimensions.width - 4,
              top: originalDimensions.y + crop.y * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + crop.x * originalDimensions.width - 4,
              top: originalDimensions.y + (crop.y + crop.height) * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'se')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + (crop.x + crop.width) * originalDimensions.width - 4,
              top: originalDimensions.y + (crop.y + crop.height) * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
              zIndex: 11,
            }}
          />
          {/* Edge handles */}
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'n')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + (crop.x + crop.width / 2) * originalDimensions.width - 4,
              top: originalDimensions.y + crop.y * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 's')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + (crop.x + crop.width / 2) * originalDimensions.width - 4,
              top: originalDimensions.y + (crop.y + crop.height) * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'w')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + crop.x * originalDimensions.width - 4,
              top: originalDimensions.y + (crop.y + crop.height / 2) * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              zIndex: 11,
            }}
          />
          <div
            onMouseDown={(e) => handleCropMouseDown(e, 'e')}
            style={{
              position: 'absolute',
              left: originalDimensions.x + (crop.x + crop.width) * originalDimensions.width - 4,
              top: originalDimensions.y + (crop.y + crop.height / 2) * originalDimensions.height - 4,
              width: 8,
              height: 8,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              zIndex: 11,
            }}
          />
          {/* Crop overlay - shows original bounds with crop area highlighted */}
          <div
            style={{
              position: 'absolute',
              left: originalDimensions.x,
              top: originalDimensions.y,
              width: originalDimensions.width,
              height: originalDimensions.height,
              border: '2px dashed #3b82f6',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: crop.x * originalDimensions.width,
                top: crop.y * originalDimensions.height,
                width: crop.width * originalDimensions.width,
                height: crop.height * originalDimensions.height,
                border: '2px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
              }}
            />
          </div>
        </>
      )}

      {/* Resize handles - only show when selected and not cropping */}
      {isSelected && !isCropping && (
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
              left: cell.x + cell.width - 2,
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
              left: cell.x + cell.width - 2,
              top: cell.y + cell.height - 2,
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
              top: cell.y + cell.height - 2,
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
              left: cell.x + cell.width / 2 - 8,
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
              left: cell.x + cell.width / 2 - 8,
              top: cell.y + cell.height - 2,
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
              left: cell.x + cell.width - 2,
              top: cell.y + cell.height / 2 - 8,
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
              top: cell.y + cell.height / 2 - 8,
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

export default ImageCellComponent;
