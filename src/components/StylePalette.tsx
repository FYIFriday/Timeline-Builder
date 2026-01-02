import { useState } from 'react';
import { useStore } from '../store';

interface StylePaletteProps {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

function StylePalette({ zoom, offsetX, offsetY }: StylePaletteProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedStyle, setDraggedStyle] = useState<number | null>(null);
  const { colorPresets, addCell } = useStore();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedStyle(index);
    // Set drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('styleIndex', index.toString());
  };

  const handleDragEnd = () => {
    setDraggedStyle(null);
  };

  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          width: 40,
          height: 40,
          backgroundColor: '#ffffff',
          border: '2px solid #ccc',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontSize: 20,
        }}
        title="Open Style Palette"
      >
        🎨
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        backgroundColor: '#ffffff',
        border: '2px solid #ccc',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        maxWidth: 220,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 'bold' }}>Styles</span>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
            width: 20,
            height: 20,
          }}
          title="Collapse"
        >
          ✕
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}
      >
        {colorPresets.map((preset, index) => (
          <div
            key={index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            style={{
              width: 55,
              height: 38,
              backgroundColor: preset.bgColor,
              color: preset.textColor,
              border: `1px solid ${preset.borderColor || preset.textColor}`,
              borderRadius: preset.borderRadius || 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              fontSize: 8,
              fontWeight: 'bold',
              textAlign: 'center',
              opacity: draggedStyle === index ? 0.5 : 1,
              userSelect: 'none',
            }}
            title={`Drag to create ${preset.name} cell`}
          >
            {preset.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StylePalette;
