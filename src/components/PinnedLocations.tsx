import { useState } from 'react';
import { useStore } from '../store';

interface PinnedLocationsProps {
  isOpen: boolean;
  onClose: () => void;
}

function PinnedLocations({ isOpen, onClose }: PinnedLocationsProps) {
  const { pinnedLocations, goToPinnedLocation } = useStore();

  if (!isOpen) {
    return null;
  }

  const handleLocationClick = (id: string) => {
    goToPinnedLocation(id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        right: 10,
        backgroundColor: '#ffffff',
        border: '2px solid #ccc',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        maxWidth: 220,
        maxHeight: 400,
        overflow: 'auto',
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
        <span style={{ fontSize: 14, fontWeight: 'bold' }}>Pinned Locations</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
            width: 20,
            height: 20,
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {pinnedLocations.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '20px 0' }}>
          No pinned locations yet.
          <br />
          Right-click canvas to pin a location.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {pinnedLocations.map((location) => (
            <div
              key={location.id}
              onClick={() => handleLocationClick(location.id)}
              style={{
                padding: '8px 12px',
                backgroundColor: location.bgColor,
                color: location.textColor,
                border: `1px solid ${location.textColor}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'center',
                userSelect: 'none',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={`Jump to ${location.name}`}
            >
              {location.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PinnedLocations;
