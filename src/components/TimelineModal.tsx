import { useState } from 'react';
import { useStore } from '../store';
import { Cell, TimelineConfig } from '../types';

interface TimelineModalProps {
  onClose: () => void;
  position: { x: number; y: number };
}

function TimelineModal({ onClose, position }: TimelineModalProps) {
  const [startNumber, setStartNumber] = useState('1');
  const [endNumber, setEndNumber] = useState('10');
  const [granularity, setGranularity] = useState<TimelineConfig['granularity']>('Years');
  const [customInterval, setCustomInterval] = useState('1');
  const [orientation, setOrientation] = useState<'Horizontal' | 'Vertical'>('Horizontal');
  const [reverse, setReverse] = useState(false);
  const [displayInterval, setDisplayInterval] = useState('1');

  const { addCell, saveHistory } = useStore();

  const handleCreate = () => {
    const config: TimelineConfig = {
      startNumber: parseInt(startNumber),
      endNumber: parseInt(endNumber),
      granularity,
      customInterval: granularity === 'Custom' ? parseInt(customInterval) : undefined,
      orientation,
      reverse,
      displayInterval: parseInt(displayInterval),
    };

    const numbers: number[] = [];
    const step = granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
    const display = config.displayInterval || 1;

    // When reverse is checked, start from the higher number and go down
    let current = reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
    const end = reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
    const startForModulo = reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

    if (reverse) {
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

    const isHorizontal = orientation === 'Horizontal';
    const itemWidth = isHorizontal ? 60 : 40;
    const itemHeight = isHorizontal ? 40 : 60;

    const newCell: Cell = {
      id: `timeline-${Date.now()}`,
      x: position.x,
      y: position.y,
      width: isHorizontal ? numbers.length * itemWidth : itemWidth,
      height: isHorizontal ? itemHeight : numbers.length * itemHeight,
      text: '',
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
      isTimeline: true,
      timelineConfig: config,
    };

    addCell(newCell);
    saveHistory();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 30,
          minWidth: 400,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Create Timeline Cell</h2>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
            Start Number
          </label>
          <input
            type="number"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
            End Number
          </label>
          <input
            type="number"
            value={endNumber}
            onChange={(e) => setEndNumber(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
            Granularity
          </label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as TimelineConfig['granularity'])}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            <option value="Days">Days</option>
            <option value="Months">Months</option>
            <option value="Years">Years</option>
            <option value="Decades">Decades</option>
            <option value="Centuries">Centuries</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {granularity === 'Custom' && (
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
              Custom Interval
            </label>
            <input
              type="number"
              value={customInterval}
              onChange={(e) => setCustomInterval(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: 14,
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
            Show Every N Intervals
          </label>
          <input
            type="number"
            value={displayInterval}
            onChange={(e) => setDisplayInterval(e.target.value)}
            min="1"
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 14 }}>
            Orientation
          </label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as 'Horizontal' | 'Vertical')}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            <option value="Horizontal">Horizontal</option>
            <option value="Vertical">Vertical</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={reverse}
              onChange={(e) => setReverse(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Reverse number order
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 4,
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 4,
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimelineModal;
