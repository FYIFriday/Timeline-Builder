import { useStore } from '../store';
import { Connection } from '../types';

interface ConnectionComponentProps {
  connection: Connection;
  onContextMenu?: (e: React.MouseEvent, connection: Connection) => void;
}

function ConnectionComponent({ connection, onContextMenu }: ConnectionComponentProps) {
  const { cells } = useStore();

  const fromCell = cells.find((c) => c.id === connection.fromCellId);
  const toCell = cells.find((c) => c.id === connection.toCellId);

  if (!fromCell || !toCell) return null;

  let x1 = fromCell.x + fromCell.width / 2;
  let y1 = fromCell.y + fromCell.height / 2;
  let x2 = toCell.x + toCell.width / 2;
  let y2 = toCell.y + toCell.height / 2;

  if (fromCell.isTimeline && connection.fromPinIndex !== undefined) {
    const config = fromCell.timelineConfig!;
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

    // Calculate item dimensions based on whether cell was manually resized
    let itemWidth: number;
    let itemHeight: number;

    if (fromCell.manuallyResized) {
      itemWidth = isHorizontal ? fromCell.width / intervalCount : fromCell.width;
      itemHeight = isHorizontal ? fromCell.height : fromCell.height / intervalCount;
    } else {
      itemWidth = isHorizontal ? 60 : 40;
      itemHeight = isHorizontal ? 40 : 60;
    }

    if (isHorizontal) {
      x1 = fromCell.x + connection.fromPinIndex * itemWidth + itemWidth / 2;
      y1 = fromCell.y + itemHeight / 2;
    } else {
      x1 = fromCell.x + itemWidth / 2;
      y1 = fromCell.y + connection.fromPinIndex * itemHeight + itemHeight / 2;
    }
  }

  if (toCell.isTimeline && connection.toPinIndex !== undefined) {
    const config = toCell.timelineConfig!;
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

    // Calculate item dimensions based on whether cell was manually resized
    let itemWidth: number;
    let itemHeight: number;

    if (toCell.manuallyResized) {
      itemWidth = isHorizontal ? toCell.width / intervalCount : toCell.width;
      itemHeight = isHorizontal ? toCell.height : toCell.height / intervalCount;
    } else {
      itemWidth = isHorizontal ? 60 : 40;
      itemHeight = isHorizontal ? 40 : 60;
    }

    if (isHorizontal) {
      x2 = toCell.x + connection.toPinIndex * itemWidth + itemWidth / 2;
      y2 = toCell.y + itemHeight / 2;
    } else {
      x2 = toCell.x + itemWidth / 2;
      y2 = toCell.y + connection.toPinIndex * itemHeight + itemHeight / 2;
    }
  }

  const strokeDasharray =
    connection.style === 'Dotted'
      ? '2 4'
      : connection.style === 'Dashed'
      ? '8 4'
      : 'none';

  const strokeWidth = connection.style === 'Bold' ? 3 : connection.style === 'Dashed' ? 2 : 1;

  // Calculate bounding box for the SVG
  const minX = Math.min(x1, x2) - 10;
  const minY = Math.min(y1, y2) - 10;
  const maxX = Math.max(x1, x2) + 10;
  const maxY = Math.max(y1, y2) + 10;
  const width = maxX - minX;
  const height = maxY - minY;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, connection);
    }
  };

  return (
    <svg
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width: width,
        height: height,
        pointerEvents: 'auto',
        zIndex: 1,
        overflow: 'visible',
        cursor: 'pointer',
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Invisible thicker line for easier clicking */}
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2 - minX}
        y2={y2 - minY}
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible line */}
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2 - minX}
        y2={y2 - minY}
        stroke={connection.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}

export default ConnectionComponent;
