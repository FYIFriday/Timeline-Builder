import { useState } from 'react';

interface PinLocationModalProps {
  onConfirm: (name: string) => void;
  onClose: () => void;
}

function PinLocationModal({ onConfirm, onClose }: PinLocationModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          minWidth: 300,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
          Pin Location
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter location name"
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
              boxSizing: 'border-box',
              marginBottom: 16,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
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
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 4,
                backgroundColor: name.trim() ? '#007bff' : '#ccc',
                color: 'white',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                fontSize: 14,
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PinLocationModal;
