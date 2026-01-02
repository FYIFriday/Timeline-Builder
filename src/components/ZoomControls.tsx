import { useStore } from '../store';

function ZoomControls() {
  const { zoom, setZoom, setOffset } = useStore();

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset(0, 0);
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
        step="0.1"
        value={zoom}
        onChange={handleZoomChange}
        style={{ width: 100 }}
      />
      <span style={{ minWidth: 50, textAlign: 'center', fontSize: 14 }}>
        {zoomPercent}%
      </span>
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
    </div>
  );
}

export default ZoomControls;
