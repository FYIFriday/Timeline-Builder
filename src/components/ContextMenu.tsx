import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Connection } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenTimelineModal: () => void;
}

function ContextMenu({ x, y, onClose, onOpenTimelineModal }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);
  const [showFontSubmenu, setShowFontSubmenu] = useState(false);
  const [showBorderSubmenu, setShowBorderSubmenu] = useState(false);
  const [showConnectionStyleSubmenu, setShowConnectionStyleSubmenu] = useState(false);
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
  } = useStore();

  // Check if there are connections between selected cells
  const hasConnectionsBetweenSelected = connections.some(
    (conn) =>
      selectedCellIds.includes(conn.fromCellId) && selectedCellIds.includes(conn.toCellId)
  );

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

      let newX = x;
      let newY = y;

      // Check if menu goes off right edge
      if (x + menuRect.width > viewportWidth) {
        newX = viewportWidth - menuRect.width - 10;
      }

      // Check if menu goes off bottom edge
      if (y + menuRect.height > viewportHeight) {
        newY = y - menuRect.height; // Position above cursor
        // If that would go off top, just position at bottom with some margin
        if (newY < 0) {
          newY = viewportHeight - menuRect.height - 10;
        }
      }

      if (newX !== x || newY !== y) {
        setPosition({ x: newX, y: newY });
      }
    }
  }, [x, y]);

  const handleAddConnection = () => {
    if (selectedCellIds.length < 2) return;

    for (let i = 0; i < selectedCellIds.length - 1; i++) {
      for (let j = i + 1; j < selectedCellIds.length; j++) {
        const connection: Connection = {
          id: `conn-${Date.now()}-${i}-${j}`,
          fromCellId: selectedCellIds[i],
          toCellId: selectedCellIds[j],
          color: '#000000',
          style: 'Dashed',
        };
        addConnection(connection);
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
      });
    });
    saveHistory();
    onClose();
  };

  const handleConnectionStyle = (style: Connection['style']) => {
    const selectedConnections = connections.filter(
      (conn) =>
        selectedCellIds.includes(conn.fromCellId) ||
        selectedCellIds.includes(conn.toCellId)
    );
    selectedConnections.forEach((conn) => {
      updateConnection(conn.id, { style });
    });
    saveHistory();
    onClose();
  };

  const handleColorPicker = (type: 'background' | 'text' | 'connection' | 'canvas') => {
    const input = document.createElement('input');
    input.type = 'color';
    input.click();
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (type === 'background') {
        selectedCellIds.forEach((id) => updateCell(id, { backgroundColor: color }));
      } else if (type === 'text') {
        selectedCellIds.forEach((id) => updateCell(id, { textColor: color }));
      } else if (type === 'connection') {
        const selectedConnections = connections.filter(
          (conn) =>
            selectedCellIds.includes(conn.fromCellId) ||
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

  const handleMakeFontBigger = () => {
    selectedCellIds.forEach((id) => {
      const cell = cells.find((c) => c.id === id);
      if (cell) {
        updateCell(id, { fontSize: Math.min(cell.fontSize + 2, 72) });
      }
    });
    saveHistory();
    onClose();
  };

  const handleMakeFontSmaller = () => {
    selectedCellIds.forEach((id) => {
      const cell = cells.find((c) => c.id === id);
      if (cell) {
        updateCell(id, { fontSize: Math.max(cell.fontSize - 2, 8) });
      }
    });
    saveHistory();
    onClose();
  };

  const handleToggleBold = () => {
    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    const newBold = !cell?.bold;
    selectedCellIds.forEach((id) => updateCell(id, { bold: newBold }));
    saveHistory();
    onClose();
  };

  const handleToggleItalic = () => {
    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    const newItalic = !cell?.italic;
    selectedCellIds.forEach((id) => updateCell(id, { italic: newItalic }));
    saveHistory();
    onClose();
  };

  const handleToggleUnderline = () => {
    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    const newUnderline = !cell?.underline;
    selectedCellIds.forEach((id) => updateCell(id, { underline: newUnderline }));
    saveHistory();
    onClose();
  };

  const handleToggleStrikethrough = () => {
    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    const newStrikethrough = !cell?.strikethrough;
    selectedCellIds.forEach((id) => updateCell(id, { strikethrough: newStrikethrough }));
    saveHistory();
    onClose();
  };

  const handleAddBorder = () => {
    selectedCellIds.forEach((id) => {
      updateCell(id, { borderThickness: 1, borderColor: '#000000', borderRadius: 8 });
    });
    saveHistory();
    onClose();
  };

  const handleRemoveBorder = () => {
    selectedCellIds.forEach((id) => {
      updateCell(id, { borderThickness: 0 });
    });
    saveHistory();
    onClose();
  };

  const handleBorderThickness = () => {
    const thickness = prompt('Enter border thickness (px):', '1');
    if (thickness) {
      selectedCellIds.forEach((id) => updateCell(id, { borderThickness: parseInt(thickness) }));
      saveHistory();
    }
    onClose();
  };

  const handleBorderColor = () => {
    const input = document.createElement('input');
    input.type = 'color';
    input.click();
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      selectedCellIds.forEach((id) => updateCell(id, { borderColor: color }));
      saveHistory();
    };
    onClose();
  };

  const handleBorderShape = (radius: number) => {
    selectedCellIds.forEach((id) => updateCell(id, { borderRadius: radius }));
    saveHistory();
    onClose();
  };

  const handleDelete = () => {
    deleteCells(selectedCellIds);
    onClose();
  };

  const handleAlign = (type: 'top' | 'bottom' | 'left' | 'right' | 'vcenter' | 'hcenter') => {
    if (selectedCellIds.length < 2) return;

    // First selected cell is the reference
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
        case 'vcenter':
          updates.y = referenceCell.y + (referenceCell.height / 2) - (cell.height / 2);
          break;
        case 'hcenter':
          updates.x = referenceCell.x + (referenceCell.width / 2) - (cell.width / 2);
          break;
      }

      updateCell(id, updates);
    });

    saveHistory();
    onClose();
  };

  const handleAddToStyles = () => {
    if (selectedCellIds.length === 0) return;

    // Get the first selected cell's style
    const cell = cells.find((c) => c.id === selectedCellIds[0]);
    if (!cell) return;

    // Generate auto-name: User1, User2, etc.
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
      <MenuItem onClick={handleAddConnection} disabled={selectedCellIds.length < 2}>
        Add connection
      </MenuItem>
      <MenuItem onClick={handleRemoveConnections} disabled={!hasConnectionsBetweenSelected}>
        Remove connections
      </MenuItem>
      <MenuDivider />
      <MenuSubmenu label="Quick-change style">
        {colorPresets.map((preset) => (
          <MenuItem
            key={preset.name}
            onClick={() => handleQuickStyle(preset)}
            disabled={selectedCellIds.length === 0}
          >
            {preset.name}
          </MenuItem>
        ))}
      </MenuSubmenu>
      <MenuItem onClick={handleAddToStyles} disabled={selectedCellIds.length === 0}>
        Add to Styles
      </MenuItem>
      <MenuItem onClick={onOpenTimelineModal}>Timeline cell</MenuItem>
      <MenuDivider />
      <MenuSubmenu label="Connection style" disabled={!hasConnectionsBetweenSelected}>
        <MenuItem onClick={() => handleConnectionStyle('Dotted')} disabled={!hasConnectionsBetweenSelected}>Dotted</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Dashed')} disabled={!hasConnectionsBetweenSelected}>Dashed</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Solid')} disabled={!hasConnectionsBetweenSelected}>Solid</MenuItem>
        <MenuItem onClick={() => handleConnectionStyle('Bold')} disabled={!hasConnectionsBetweenSelected}>Bold</MenuItem>
      </MenuSubmenu>
      <MenuSubmenu label="Color">
        <MenuItem onClick={() => handleColorPicker('background')}>Cell background</MenuItem>
        <MenuItem onClick={() => handleColorPicker('text')}>Text</MenuItem>
        <MenuItem onClick={() => handleColorPicker('connection')}>Connection</MenuItem>
        <MenuItem onClick={() => handleColorPicker('canvas')}>Canvas background</MenuItem>
      </MenuSubmenu>
      <MenuSubmenu label="Font">
        <MenuItem onClick={handleMakeFontBigger} shortcut={`(${modKey}+'+')`}>Make Bigger</MenuItem>
        <MenuItem onClick={handleMakeFontSmaller} shortcut={`(${modKey}+'-')`}>Make Smaller</MenuItem>
        <MenuItem onClick={handleToggleBold} shortcut={`(${modKey}+B)`}>Bold</MenuItem>
        <MenuItem onClick={handleToggleItalic} shortcut={`(${modKey}+I)`}>Italic</MenuItem>
        <MenuItem onClick={handleToggleUnderline} shortcut={`(${modKey}+U)`}>Underline</MenuItem>
        <MenuItem onClick={handleToggleStrikethrough}>Strikethrough</MenuItem>
      </MenuSubmenu>
      <MenuSubmenu label="Border">
        <MenuItem onClick={handleAddBorder}>Add Border</MenuItem>
        <MenuItem onClick={handleRemoveBorder}>Remove Border</MenuItem>
        <MenuItem onClick={handleBorderThickness}>Thickness</MenuItem>
        <MenuItem onClick={handleBorderColor}>Color</MenuItem>
        <MenuItem onClick={() => handleBorderShape(0)}>Sharp rectangle</MenuItem>
        <MenuItem onClick={() => handleBorderShape(8)}>Rounded rectangle</MenuItem>
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
      <MenuDivider />
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

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => !disabled && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <MenuItem disabled={disabled}>
        {label} <span style={{ float: 'right' }}>▸</span>
      </MenuItem>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: 150,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default ContextMenu;
