import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../store';
import { Connection, Cell } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenTimelineModal: () => void;
  onPinLocation: () => void;
}

function ContextMenu({ x, y, onClose, onOpenTimelineModal, onPinLocation }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Detect platform for keyboard shortcuts
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'CMD' : 'CTRL';

  const {
    selectedCellIds,
    cells,
    connections,
    colorPresets,
    updateCell,
    addConnection,
    deleteConnectionsForCells,
    updateConnection,
    setCanvasBackgroundColor,
    deleteCells,
    saveHistory,
    addColorPreset,
    groupCells,
    ungroupCells,
    addCell,
    offsetX,
    offsetY,
    zoom,
    defaultCellStyle,
  } = useStore();

  // Check if there are connections between selected cells
  const hasConnectionsBetweenSelected = connections.some(
    (conn) =>
      selectedCellIds.includes(conn.fromCellId) && selectedCellIds.includes(conn.toCellId)
  );

  // Check if selected cells are grouped
  const selectedCells = cells.filter(c => selectedCellIds.includes(c.id));
  const someSelectedAreGrouped = selectedCells.some(c => c.groupId);

  // Check if ONLY dots are selected (one or more)
  const onlyDotsSelected = selectedCells.length > 0 && selectedCells.every(c => c.isDot);

  // Check if any cells are selected
  const hasCellsSelected = selectedCellIds.length > 0;

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

  const handleAddConnection = (style: 'Dashed' | 'Solid' | 'Arrow') => {
    if (selectedCellIds.length < 2) return;

    if (style === 'Arrow') {
      // First cell is origin, all others are destinations
      const originId = selectedCellIds[0];
      for (let i = 1; i < selectedCellIds.length; i++) {
        const connection: Connection = {
          id: `conn-${Date.now()}-arrow-${i}`,
          fromCellId: originId,
          toCellId: selectedCellIds[i],
          color: defaultCellStyle.defaultConnectionColor,
          style: 'Arrow',
          strokeWidth: defaultCellStyle.defaultConnectionThickness,
        };
        addConnection(connection);
      }
    } else {
      for (let i = 0; i < selectedCellIds.length - 1; i++) {
        for (let j = i + 1; j < selectedCellIds.length; j++) {
          const connection: Connection = {
            id: `conn-${Date.now()}-${i}-${j}`,
            fromCellId: selectedCellIds[i],
            toCellId: selectedCellIds[j],
            color: defaultCellStyle.defaultConnectionColor,
            style,
            strokeWidth: defaultCellStyle.defaultConnectionThickness,
          };
          addConnection(connection);
        }
      }
    }
    saveHistory();
    onClose();
  };

  const handleRemoveConnections = () => {
    deleteConnectionsForCells(selectedCellIds);
    onClose();
  };

  const handleQuickStyle = (preset: typeof colorPresets[0]) => {
    selectedCellIds.forEach((id) => {
      updateCell(id, {
        textColor: preset.textColor,
        backgroundColor: preset.bgColor,
        borderThickness: preset.borderThickness ?? 1,
        borderColor: preset.borderColor || preset.textColor,
        borderRadius: preset.borderRadius ?? 8,
        styleName: preset.name,
      });
    });
    saveHistory();
    onClose();
  };

  const handleCreateCell = (preset?: typeof colorPresets[0]) => {
    const worldX = (position.x - offsetX) / zoom;
    const worldY = (position.y - offsetY) / zoom;

    const newCell: Cell = {
      id: `cell-${Date.now()}`,
      x: worldX,
      y: worldY,
      width: 200,
      height: 60,
      text: 'New Cell',
      backgroundColor: preset?.bgColor || '#fffdf5',
      textColor: preset?.textColor || '#000000',
      borderColor: preset?.borderColor || preset?.textColor || '#000000',
      borderThickness: preset?.borderThickness ?? 0,
      borderRadius: preset?.borderRadius ?? 0,
      fontFamily: defaultCellStyle.fontFamily,
      fontSize: defaultCellStyle.fontSize,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      styleName: preset?.name,
    };

    addCell(newCell);
    saveHistory();
    onClose();
  };

  const handleConnectionStyle = (style: Connection['style']) => {
    const selectedConnections = connections.filter(
      (conn) =>
        selectedCellIds.includes(conn.fromCellId) &&
        selectedCellIds.includes(conn.toCellId)
    );
    selectedConnections.forEach((conn) => {
      if (style === 'Arrow' && selectedCellIds.length > 0) {
        const firstSelectedId = selectedCellIds[0];
        if (conn.toCellId === firstSelectedId && selectedCellIds.includes(conn.fromCellId)) {
          updateConnection(conn.id, {
            fromCellId: conn.toCellId,
            toCellId: conn.fromCellId,
            fromPinIndex: conn.toPinIndex,
            toPinIndex: conn.fromPinIndex,
            style
          });
        } else {
          updateConnection(conn.id, { style });
        }
      } else {
        updateConnection(conn.id, { style });
      }
    });
    saveHistory();
    onClose();
  };

  const handleConnectionWeight = (weight: number) => {
    const selectedConnections = connections.filter(
      (conn) =>
        selectedCellIds.includes(conn.fromCellId) &&
        selectedCellIds.includes(conn.toCellId)
    );
    selectedConnections.forEach((conn) => {
      updateConnection(conn.id, { strokeWidth: weight });
    });
    saveHistory();
    onClose();
  };

  const handleColorPicker = (type: 'background' | 'text' | 'border' | 'connection' | 'canvas') => {
    const input = document.createElement('input');
    input.type = 'color';
    input.click();
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (type === 'background') {
        selectedCellIds.forEach((id) => updateCell(id, { backgroundColor: color, styleName: undefined }));
      } else if (type === 'text') {
        selectedCellIds.forEach((id) => updateCell(id, { textColor: color, styleName: undefined }));
      } else if (type === 'border') {
        selectedCellIds.forEach((id) => updateCell(id, { borderColor: color, styleName: undefined }));
      } else if (type === 'connection') {
        const selectedConnections = connections.filter(
          (conn) =>
            selectedCellIds.includes(conn.fromCellId) &&
            selectedCellIds.includes(conn.toCellId)
        );
        selectedConnections.forEach((conn) => updateConnection(conn.id, { color }));
      } else if (type === 'canvas') {
        setCanvasBackgroundColor(color);
      }
      saveHistory();
    };
    onClose();
  };

  const handleAddBorder = () => {
    selectedCellIds.forEach((id) => {
      updateCell(id, { borderThickness: 1, borderColor: '#000000', borderRadius: 8, styleName: undefined });
    });
    saveHistory();
    onClose();
  };

  const handleRemoveBorder = () => {
    selectedCellIds.forEach((id) => {
      updateCell(id, { borderThickness: 0, styleName: undefined });
    });
    saveHistory();
    onClose();
  };

  const handleBorderThickness = (thickness: number) => {
    selectedCellIds.forEach((id) => updateCell(id, { borderThickness: thickness, styleName: undefined }));
    saveHistory();
    onClose();
  };

  const handleBorderShape = (radius: number) => {
    selectedCellIds.forEach((id) => updateCell(id, { borderRadius: radius, styleName: undefined }));
    saveHistory();
    onClose();
  };

  const handleDelete = () => {
    deleteCells(selectedCellIds);
    onClose();
  };

  const handleAlign = (type: 'top' | 'bottom' | 'left' | 'right' | 'vcenter' | 'hcenter') => {
    if (selectedCellIds.length < 2) return;

    const referenceCell = cells.find((c) => c.id === selectedCellIds[0]);
    if (!referenceCell) return;

    selectedCellIds.slice(1).forEach((id) => {
      const cell = cells.find((c) => c.id === id);
      if (!cell) return;

      let updates: Partial<Cell> = {};

      switch (type) {
        case 'top':
          updates.y = referenceCell.y;
          break;
        case 'bottom':
          updates.y = referenceCell.y + referenceCell.height - cell.height;
          break;
        case 'left':
          updates.x = referenceCell.x;
          break;
        case 'right':
          updates.x = referenceCell.x + referenceCell.width - cell.width;
          break;
        case 'hcenter':
          updates.y = referenceCell.y + (referenceCell.height / 2) - (cell.height / 2);
          break;
        case 'vcenter':
          updates.x = referenceCell.x + (referenceCell.width / 2) - (cell.width / 2);
          break;
      }

      updateCell(id, updates);
    });

    saveHistory();
    onClose();
  };

  const handleDistribute = (direction: 'horizontal' | 'vertical') => {
    if (selectedCellIds.length < 3) return;

    const selectedCells = selectedCellIds
      .map((id) => cells.find((c) => c.id === id))
      .filter((c): c is Cell => c !== undefined);

    if (direction === 'horizontal') {
      const sorted = [...selectedCells].sort((a, b) => a.x - b.x);
      const leftmost = sorted[0];
      const rightmost = sorted[sorted.length - 1];
      const leftCenter = leftmost.x + leftmost.width / 2;
      const rightCenter = rightmost.x + rightmost.width / 2;
      const totalSpan = rightCenter - leftCenter;
      const spacing = totalSpan / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const cell = sorted[i];
        const newCenterX = leftCenter + spacing * i;
        const newX = newCenterX - cell.width / 2;
        updateCell(cell.id, { x: newX });
      }
    } else {
      const sorted = [...selectedCells].sort((a, b) => a.y - b.y);
      const topmost = sorted[0];
      const bottommost = sorted[sorted.length - 1];
      const topCenter = topmost.y + topmost.height / 2;
      const bottomCenter = bottommost.y + bottommost.height / 2;
      const totalSpan = bottomCenter - topCenter;
      const spacing = totalSpan / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const cell = sorted[i];
        const newCenterY = topCenter + spacing * i;
        const newY = newCenterY - cell.height / 2;
        updateCell(cell.id, { y: newY });
      }
    }

    saveHistory();
    onClose();
  };

  const handleAddToStyles = () => {
    if (selectedCellIds.length === 0) return;

    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    if (!cell) return;

    const userPresets = colorPresets.filter(p => p.name.startsWith('User'));
    let nextNum = 1;
    const userNumbers = userPresets.map(p => {
      const match = p.name.match(/^User(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    if (userNumbers.length > 0) {
      nextNum = Math.max(...userNumbers) + 1;
    }

    const newPreset = {
      name: `User${nextNum}`,
      textColor: cell.textColor,
      bgColor: cell.backgroundColor,
      borderColor: cell.borderColor,
      borderThickness: cell.borderThickness,
      borderRadius: cell.borderRadius,
    };

    addColorPreset(newPreset);
    onClose();
  };

  const handleDotColor = () => {
    if (selectedCells.length === 0) return;
    const input = document.createElement('input');
    input.type = 'color';
    const firstDot = selectedCells.find(c => c.isDot);
    if (firstDot) {
      input.value = firstDot.backgroundColor;
    }
    input.click();
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      selectedCellIds.forEach((id) => {
        const cell = cells.find(c => c.id === id);
        if (cell?.isDot) {
          updateCell(id, { backgroundColor: color });
        }
      });
      saveHistory();
    };
    onClose();
  };

  const handleDotShape = (shape: 'circle' | 'square' | 'diamond') => {
    if (selectedCells.length === 0) return;
    selectedCellIds.forEach((id) => {
      const cell = cells.find(c => c.id === id);
      if (cell?.isDot) {
        updateCell(id, { dotShape: shape });
      }
    });
    saveHistory();
    onClose();
  };

  const handleDotSize = (size: number) => {
    if (selectedCells.length === 0) return;
    selectedCellIds.forEach((id) => {
      const cell = cells.find(c => c.id === id);
      if (cell?.isDot) {
        updateCell(id, { width: size, height: size });
      }
    });
    saveHistory();
    onClose();
  };

  const handleGroupObjects = () => {
    if (selectedCellIds.length < 2) return;
    groupCells(selectedCellIds);
    onClose();
  };

  const handleUngroupObjects = () => {
    if (selectedCellIds.length === 0) return;
    ungroupCells(selectedCellIds);
    onClose();
  };

  const handleCreateConnectionDot = () => {
    const worldX = (position.x - offsetX) / zoom;
    const worldY = (position.y - offsetY) / zoom;
    const dotSize = defaultCellStyle.defaultDotSize || 16;

    addCell({
      id: `cell-${Date.now()}`,
      x: worldX,
      y: worldY,
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
    });
    saveHistory();
    onClose();
  };

  const handleCreateImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        const worldX = (position.x - offsetX) / zoom;
        const worldY = (position.y - offsetY) / zoom;

        // Create an image to get dimensions
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const defaultWidth = 300;
          const defaultHeight = defaultWidth / aspectRatio;

          addCell({
            id: `cell-${Date.now()}`,
            x: worldX,
            y: worldY,
            width: defaultWidth,
            height: defaultHeight,
            text: '',
            backgroundColor: defaultCellStyle.backgroundColor,
            textColor: defaultCellStyle.textColor,
            borderColor: defaultCellStyle.borderColor,
            borderThickness: defaultCellStyle.borderThickness,
            borderRadius: defaultCellStyle.borderRadius,
            fontFamily: defaultCellStyle.fontFamily,
            fontSize: defaultCellStyle.fontSize,
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            isImage: true,
            imageData: imageData,
            imageCrop: { x: 0, y: 0, width: 1, height: 1 }, // Full image initially
          });
          saveHistory();
        };
        img.src = imageData;
      };
      reader.readAsDataURL(file);
    };
    input.click();
    onClose();
  };

  // Simplified menu for dots only
  if (onlyDotsSelected) {
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
          minWidth: 200,
        }}
      >
        <MenuItem onClick={handleDotColor}>Color</MenuItem>
        <MenuSubmenu label="Shape">
          <MenuItem onClick={() => handleDotShape('circle')}>Circle</MenuItem>
          <MenuItem onClick={() => handleDotShape('square')}>Square</MenuItem>
          <MenuItem onClick={() => handleDotShape('diamond')}>Diamond</MenuItem>
        </MenuSubmenu>
        <MenuSubmenu label="Size">
          <MenuItem onClick={() => handleDotSize(8)}>Small (8px)</MenuItem>
          <MenuItem onClick={() => handleDotSize(12)}>Medium (12px)</MenuItem>
          <MenuItem onClick={() => handleDotSize(16)}>Default (16px)</MenuItem>
          <MenuItem onClick={() => handleDotSize(20)}>Large (20px)</MenuItem>
          <MenuItem onClick={() => handleDotSize(24)}>Extra Large (24px)</MenuItem>
        </MenuSubmenu>
        <MenuSubmenu label="Align" disabled={selectedCellIds.length < 2}>
          <MenuItem onClick={() => handleAlign('left')} disabled={selectedCellIds.length < 2}>Left Edge</MenuItem>
          <MenuItem onClick={() => handleAlign('hcenter')} disabled={selectedCellIds.length < 2}>Horizontal Center</MenuItem>
          <MenuItem onClick={() => handleAlign('right')} disabled={selectedCellIds.length < 2}>Right Edge</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => handleAlign('top')} disabled={selectedCellIds.length < 2}>Top Edge</MenuItem>
          <MenuItem onClick={() => handleAlign('vcenter')} disabled={selectedCellIds.length < 2}>Vertical Center</MenuItem>
          <MenuItem onClick={() => handleAlign('bottom')} disabled={selectedCellIds.length < 2}>Bottom Edge</MenuItem>
        </MenuSubmenu>
        <MenuSubmenu label="Connection" disabled={selectedCellIds.length < 2}>
          <MenuItem onClick={() => handleAddConnection('Dashed')} disabled={selectedCellIds.length < 2}>Add dashed connection</MenuItem>
          <MenuItem onClick={() => handleAddConnection('Solid')} disabled={selectedCellIds.length < 2}>Add solid connection</MenuItem>
          <MenuItem onClick={() => handleAddConnection('Arrow')} disabled={selectedCellIds.length < 2}>Add arrow connection</MenuItem>
        </MenuSubmenu>
        <MenuSubmenu label="Distribute" disabled={selectedCellIds.length < 3}>
          <MenuItem onClick={() => handleDistribute('horizontal')} disabled={selectedCellIds.length < 3}>Horizontally</MenuItem>
          <MenuItem onClick={() => handleDistribute('vertical')} disabled={selectedCellIds.length < 3}>Vertically</MenuItem>
        </MenuSubmenu>
        <MenuDivider />
        <MenuItem onClick={handleGroupObjects} disabled={selectedCellIds.length < 2}>
          Group Objects
        </MenuItem>
        <MenuItem onClick={handleUngroupObjects} disabled={!someSelectedAreGrouped}>
          Ungroup Objects
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={handleDelete} disabled={selectedCellIds.length === 0}>
          Delete
        </MenuItem>
      </div>
    );
  }

  // Full menu for regular cells
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
        minWidth: 200,
      }}
    >
      {/* Connection options */}
      <MenuItem onClick={() => handleAddConnection('Dashed')} disabled={selectedCellIds.length < 2}>
        Add dashed connection
      </MenuItem>
      <MenuItem onClick={() => handleAddConnection('Solid')} disabled={selectedCellIds.length < 2}>
        Add solid connection
      </MenuItem>
      <MenuItem onClick={() => handleAddConnection('Arrow')} disabled={selectedCellIds.length < 2}>
        Add arrow connection
      </MenuItem>

      <MenuDivider />

      {/* Cell creation options */}
      <MenuSubmenu label="Add new cell">
        <MenuItem onClick={() => handleCreateCell()}>Default</MenuItem>
        <MenuDivider />
        {colorPresets.map((preset) => (
          <MenuItem key={preset.name} onClick={() => handleCreateCell(preset)}>
            {preset.name}
          </MenuItem>
        ))}
      </MenuSubmenu>
      <MenuItem onClick={onOpenTimelineModal}>Add Timeline cell</MenuItem>
      <MenuItem onClick={handleCreateConnectionDot}>Add Connection dot</MenuItem>
      <MenuItem onClick={handleCreateImage}>Add image</MenuItem>
      <MenuSubmenu label="Change style" disabled={!hasCellsSelected}>
        {colorPresets.map((preset) => (
          <MenuItem
            key={preset.name}
            onClick={() => handleQuickStyle(preset)}
            disabled={!hasCellsSelected}
          >
            {preset.name}
          </MenuItem>
        ))}
      </MenuSubmenu>

      <MenuDivider />

      {/* Pin Location */}
      <MenuItem onClick={onPinLocation}>Pin Location</MenuItem>
      <MenuItem onClick={handleAddToStyles} disabled={!hasCellsSelected}>
        Add to Styles
      </MenuItem>

      <MenuDivider />

      {/* Styling options */}
      <MenuSubmenu label="Color">
        <MenuItem onClick={() => handleColorPicker('border')}>Border</MenuItem>
        <MenuItem onClick={() => handleColorPicker('connection')}>Connection</MenuItem>
        <MenuItem onClick={() => handleColorPicker('text')}>Cell text</MenuItem>
        <MenuItem onClick={() => handleColorPicker('background')}>Cell background</MenuItem>
        <MenuItem onClick={() => handleColorPicker('canvas')}>Canvas background</MenuItem>
      </MenuSubmenu>

      <MenuSubmenu label="Connection style" disabled={!hasConnectionsBetweenSelected}>
        <MenuItem onClick={() => handleConnectionStyle('Dotted')} disabled={!hasConnectionsBetweenSelected}>Dotted</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Dashed')} disabled={!hasConnectionsBetweenSelected}>Dashed</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Solid')} disabled={!hasConnectionsBetweenSelected}>Solid</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Bold')} disabled={!hasConnectionsBetweenSelected}>Bold</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Arrow')} disabled={!hasConnectionsBetweenSelected}>Arrow</MenuItem>
        <MenuDivider />
        <MenuItem onClick={() => handleColorPicker('connection')} disabled={!hasConnectionsBetweenSelected}>Change color</MenuItem>
      </MenuSubmenu>

      <MenuSubmenu label="Connection thickness" disabled={!hasConnectionsBetweenSelected}>
        <MenuItem onClick={() => handleConnectionWeight(1)} disabled={!hasConnectionsBetweenSelected}>1px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(2)} disabled={!hasConnectionsBetweenSelected}>2px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(3)} disabled={!hasConnectionsBetweenSelected}>3px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(4)} disabled={!hasConnectionsBetweenSelected}>4px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(5)} disabled={!hasConnectionsBetweenSelected}>5px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(6)} disabled={!hasConnectionsBetweenSelected}>6px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(7)} disabled={!hasConnectionsBetweenSelected}>7px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(8)} disabled={!hasConnectionsBetweenSelected}>8px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(9)} disabled={!hasConnectionsBetweenSelected}>9px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(10)} disabled={!hasConnectionsBetweenSelected}>10px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(11)} disabled={!hasConnectionsBetweenSelected}>11px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(12)} disabled={!hasConnectionsBetweenSelected}>12px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(13)} disabled={!hasConnectionsBetweenSelected}>13px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(14)} disabled={!hasConnectionsBetweenSelected}>14px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(15)} disabled={!hasConnectionsBetweenSelected}>15px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(16)} disabled={!hasConnectionsBetweenSelected}>16px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(17)} disabled={!hasConnectionsBetweenSelected}>17px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(18)} disabled={!hasConnectionsBetweenSelected}>18px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(19)} disabled={!hasConnectionsBetweenSelected}>19px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(20)} disabled={!hasConnectionsBetweenSelected}>20px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(21)} disabled={!hasConnectionsBetweenSelected}>21px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(22)} disabled={!hasConnectionsBetweenSelected}>22px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(23)} disabled={!hasConnectionsBetweenSelected}>23px</MenuItem>
        <MenuItem onClick={() => handleConnectionWeight(24)} disabled={!hasConnectionsBetweenSelected}>24px</MenuItem>
      </MenuSubmenu>

      <MenuSubmenu label="Border">
        <MenuItem onClick={handleAddBorder}>Add border</MenuItem>
        <MenuItem onClick={handleRemoveBorder}>Remove border</MenuItem>
        <MenuDivider />
        <MenuSubmenu label="Thickness">
          <MenuItem onClick={() => handleBorderThickness(0)}>No Border</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(1)}>1px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(2)}>2px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(3)}>3px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(4)}>4px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(5)}>5px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(6)}>6px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(8)}>8px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(10)}>10px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(12)}>12px</MenuItem>
          <MenuItem onClick={() => handleBorderThickness(20)}>20px</MenuItem>
        </MenuSubmenu>
        <MenuItem onClick={() => handleColorPicker('border')}>Color</MenuItem>
        <MenuSubmenu label="Shape">
          <MenuItem onClick={() => handleBorderShape(0)}>Sharp rectangle</MenuItem>
          <MenuItem onClick={() => handleBorderShape(8)}>Rounded rectangle</MenuItem>
        </MenuSubmenu>
      </MenuSubmenu>

      <MenuSubmenu label="Align" disabled={selectedCellIds.length < 2}>
        <MenuItem onClick={() => handleAlign('left')} disabled={selectedCellIds.length < 2}>Left Edge</MenuItem>
        <MenuItem onClick={() => handleAlign('hcenter')} disabled={selectedCellIds.length < 2}>Horizontal Center</MenuItem>
        <MenuItem onClick={() => handleAlign('right')} disabled={selectedCellIds.length < 2}>Right Edge</MenuItem>
        <MenuDivider />
        <MenuItem onClick={() => handleAlign('top')} disabled={selectedCellIds.length < 2}>Top Edge</MenuItem>
        <MenuItem onClick={() => handleAlign('vcenter')} disabled={selectedCellIds.length < 2}>Vertical Center</MenuItem>
        <MenuItem onClick={() => handleAlign('bottom')} disabled={selectedCellIds.length < 2}>Bottom Edge</MenuItem>
      </MenuSubmenu>

      <MenuSubmenu label="Distribute" disabled={selectedCellIds.length < 3}>
        <MenuItem onClick={() => handleDistribute('horizontal')} disabled={selectedCellIds.length < 3}>Horizontally</MenuItem>
        <MenuItem onClick={() => handleDistribute('vertical')} disabled={selectedCellIds.length < 3}>Vertically</MenuItem>
      </MenuSubmenu>

      {/* Commented out Font submenu as requested
      <MenuSubmenu label="Font">
        <MenuItem onClick={handleMakeFontBigger} shortcut={`(${modKey}+'+')`}>Make Bigger</MenuItem>
        <MenuItem onClick={handleMakeFontSmaller} shortcut={`(${modKey}+'-')`}>Make Smaller</MenuItem>
        <MenuItem onClick={handleToggleBold} shortcut={`(${modKey}+B)`}>Bold</MenuItem>
        <MenuItem onClick={handleToggleItalic} shortcut={`(${modKey}+I)`}>Italic</MenuItem>
        <MenuItem onClick={handleToggleUnderline} shortcut={`(${modKey}+U)`}>Underline</MenuItem>
        <MenuItem onClick={handleToggleStrikethrough}>Strikethrough</MenuItem>
      </MenuSubmenu>
      */}

      <MenuDivider />

      {/* Group options */}
      <MenuItem onClick={handleGroupObjects} disabled={selectedCellIds.length < 2}>
        Group Objects
      </MenuItem>
      <MenuItem onClick={handleUngroupObjects} disabled={!someSelectedAreGrouped}>
        Ungroup Objects
      </MenuItem>

      <MenuDivider />

      {/* Delete */}
      <MenuItem onClick={handleDelete} disabled={selectedCellIds.length === 0}>
        Delete
      </MenuItem>
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  disabled = false,
  shortcut,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = '#f0f0f0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span>{children}</span>
      {shortcut && (
        <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
          {shortcut}
        </span>
      )}
    </div>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, backgroundColor: '#e0e0e0', margin: '4px 0' }} />;
}

function MenuSubmenu({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ left?: number; right?: number; top?: number; maxHeight?: number }>({});

  useLayoutEffect(() => {
    if (isOpen && submenuRef.current && containerRef.current) {
      const submenuRect = submenuRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;

      let position: { left?: number; right?: number; top?: number; maxHeight?: number } = {};

      // Calculate horizontal position (to the right of menu item)
      let targetLeft = containerRect.right;
      let targetTop = containerRect.top;

      // Check if submenu would overflow right edge
      if (targetLeft + submenuRect.width > viewportWidth - margin) {
        // Position to the left instead
        targetLeft = containerRect.left - submenuRect.width;
        // If still overflows left edge, clamp to margin
        if (targetLeft < margin) {
          targetLeft = margin;
        }
      }

      position.left = targetLeft;

      // Calculate available height from menu item position to bottom of viewport
      const availableHeightBelow = viewportHeight - containerRect.top - margin;

      // Set maxHeight based on available space, capped at 600px
      position.maxHeight = Math.min(600, Math.max(150, availableHeightBelow));

      // If submenu would overflow bottom even with maxHeight, shift it up
      const estimatedSubmenuHeight = Math.min(submenuRect.height, position.maxHeight);
      if (containerRect.top + estimatedSubmenuHeight > viewportHeight - margin) {
        // Calculate how much to shift up
        const overflow = (containerRect.top + estimatedSubmenuHeight) - (viewportHeight - margin);
        targetTop = containerRect.top - overflow;

        // Make sure we don't go above the top
        if (targetTop < margin) {
          targetTop = margin;
          // Recalculate maxHeight with new position
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
      onMouseEnter={() => !disabled && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        style={{
          padding: '8px 16px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>{label}</span>
        <span style={{ marginLeft: 'auto', paddingLeft: '24px' }}>▸</span>
      </div>
      {isOpen && (
        <div
          ref={submenuRef}
          onWheel={(e) => {
            // Stop event from reaching canvas
            e.stopPropagation();
            e.preventDefault();

            // Manually handle scroll
            const container = submenuRef.current;
            if (container) {
              container.scrollTop += e.deltaY;
            }
          }}
          onMouseDown={(e) => {
            // Prevent mousedown from bubbling to canvas
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Prevent click from bubbling
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            left: submenuPosition.left,
            right: submenuPosition.right,
            top: submenuPosition.top,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: 150,
            maxHeight: submenuPosition.maxHeight || 600,
            overflowY: 'auto',
            zIndex: 10001,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default ContextMenu;
