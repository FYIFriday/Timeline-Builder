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

  // For Arrow style, calculate intersection with destination cell border
  let x2End = x2;
  let y2End = y2;

  if (connection.style === 'Arrow') {
    // Calculate where the line intersects with the destination cell's rectangle
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Cell bounds
    const cellLeft = toCell.x;
    const cellRight = toCell.x + toCell.width;
    const cellTop = toCell.y;
    const cellBottom = toCell.y + toCell.height;

    // Find intersection with each edge
    const intersections: Array<{ x: number; y: number; dist: number }> = [];

    // Top edge
    if (dy !== 0) {
      const t = (cellTop - y1) / dy;
      if (t > 0 && t <= 1) {
        const ix = x1 + t * dx;
        if (ix >= cellLeft && ix <= cellRight) {
          const dist = Math.sqrt((ix - x1) ** 2 + (cellTop - y1) ** 2);
          intersections.push({ x: ix, y: cellTop, dist });
        }
      }
    }

    // Bottom edge
    if (dy !== 0) {
      const t = (cellBottom - y1) / dy;
      if (t > 0 && t <= 1) {
        const ix = x1 + t * dx;
        if (ix >= cellLeft && ix <= cellRight) {
          const dist = Math.sqrt((ix - x1) ** 2 + (cellBottom - y1) ** 2);
          intersections.push({ x: ix, y: cellBottom, dist });
        }
      }
    }

    // Left edge
    if (dx !== 0) {
      const t = (cellLeft - x1) / dx;
      if (t > 0 && t <= 1) {
        const iy = y1 + t * dy;
        if (iy >= cellTop && iy <= cellBottom) {
          const dist = Math.sqrt((cellLeft - x1) ** 2 + (iy - y1) ** 2);
          intersections.push({ x: cellLeft, y: iy, dist });
        }
      }
    }

    // Right edge
    if (dx !== 0) {
      const t = (cellRight - x1) / dx;
      if (t > 0 && t <= 1) {
        const iy = y1 + t * dy;
        if (iy >= cellTop && iy <= cellBottom) {
          const dist = Math.sqrt((cellRight - x1) ** 2 + (iy - y1) ** 2);
          intersections.push({ x: cellRight, y: iy, dist });
        }
      }
    }

    // Use the closest intersection
    if (intersections.length > 0) {
      intersections.sort((a, b) => a.dist - b.dist);
      x2End = intersections[0].x;
      y2End = intersections[0].y;
    }
  }

  // Calculate arrow angle for Arrow style
  const angle = Math.atan2(y2End - y1, x2End - x1);
  const arrowSize = 10;

  // Calculate bounding box for the SVG
  const minX = Math.min(x1, x2End) - 10;
  const minY = Math.min(y1, y2End) - 10;
  const maxX = Math.max(x1, x2End) + 10;
  const maxY = Math.max(y1, y2End) + 10;
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
        x2={x2End - minX}
        y2={y2End - minY}
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible line */}
      <line
        x1={x1 - minX}
        y1={y1 - minY}
        x2={x2End - minX}
        y2={y2End - minY}
        stroke={connection.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
      {/* Arrow head */}
      {connection.style === 'Arrow' && (
        <polygon
          points={`
            ${x2End - minX},${y2End - minY}
            ${x2End - minX - arrowSize * Math.cos(angle - Math.PI / 6)},${y2End - minY - arrowSize * Math.sin(angle - Math.PI / 6)}
            ${x2End - minX - arrowSize * Math.cos(angle + Math.PI / 6)},${y2End - minY - arrowSize * Math.sin(angle + Math.PI / 6)}
          `}
          fill={connection.color}
        />
      )}
    </svg>
  );
}

export default ConnectionComponent;
