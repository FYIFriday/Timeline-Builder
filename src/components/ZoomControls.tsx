import { useStore } from '../store';

interface ZoomControlsProps {
  onTogglePinnedLocations: () => void;
}

function ZoomControls({ onTogglePinnedLocations }: ZoomControlsProps) {
  const { zoom, setZoom, setOffset, offsetX, offsetY } = useStore();

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset(0, 0);
  };

  const zoomTowardCenter = (newZoom: number) => {
    // Calculate the center of the viewport
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate the world coordinates at the viewport center
    const worldX = (centerX - offsetX) / zoom;
    const worldY = (centerY - offsetY) / zoom;

    // Calculate new offset to keep the world point at the viewport center
    const newOffsetX = centerX - worldX * newZoom;
    const newOffsetY = centerY - worldY * newZoom;

    setZoom(newZoom);
    setOffset(newOffsetX, newOffsetY);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(4, zoom + 0.01);
    zoomTowardCenter(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom - 0.01);
    zoomTowardCenter(newZoom);
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: 'white',
        padding: '10px 15px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 1000,
      }}
    >
      <input
        type="range"
        min="0.1"
        max="4"
        step="0.05"
        value={zoom}
        onChange={handleZoomChange}
        style={{ width: 100 }}
      />
      <button
        onClick={handleZoomOut}
        style={{
          padding: '5px 10px',
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 'bold',
        }}
        title="Zoom Out"
      >
        −
      </button>
      <span style={{ minWidth: 50, textAlign: 'center', fontSize: 14 }}>
        {zoomPercent}%
      </span>
      <button
        onClick={handleZoomIn}
        style={{
          padding: '5px 10px',
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 'bold',
        }}
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={handleReset}
        style={{
          padding: '5px 10px',
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Reset
      </button>
      <button
        onClick={onTogglePinnedLocations}
        style={{
          padding: '5px 10px',
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: 16,
        }}
        title="Pinned Locations"
      >
        📍
      </button>
    </div>
  );
}

export default ZoomControls;
