import { useState } from 'react';
import { useStore } from '../store';
import { ColorPreset, DefaultCellStyle } from '../types';
import { DEFAULT_COLOR_PRESETS, DEFAULT_CELL_STYLE } from '../store';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const { colorPresets, defaultCellStyle, updateColorPreset, setDefaultCellStyle, setColorPresets } = useStore();
  const [activeTab, setActiveTab] = useState<'default' | 'presets'>('default');
  const [editedDefault, setEditedDefault] = useState<DefaultCellStyle>({ ...defaultCellStyle });
  const [editedPresets, setEditedPresets] = useState<ColorPreset[]>([...colorPresets]);

  const handleSave = () => {
    setDefaultCellStyle(editedDefault);
    setColorPresets(editedPresets);
    onClose();
  };

  const handlePresetChange = (index: number, field: keyof ColorPreset, value: string | number) => {
    const newPresets = [...editedPresets];
    newPresets[index] = { ...newPresets[index], [field]: value };

    // When text color changes, update border color to match
    if (field === 'textColor' && typeof value === 'string') {
      newPresets[index].borderColor = value;
    }

    setEditedPresets(newPresets);
  };

  const handleAddPreset = () => {
    // Generate auto-name: User1, User2, etc.
    const userPresets = editedPresets.filter(p => p.name.startsWith('User'));
    let nextNum = 1;
    const userNumbers = userPresets.map(p => {
      const match = p.name.match(/^User(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    if (userNumbers.length > 0) {
      nextNum = Math.max(...userNumbers) + 1;
    }

    const textColor = '#000000';
    const newPreset: ColorPreset = {
      name: `User${nextNum}`,
      textColor: textColor,
      bgColor: '#ffffff',
      borderColor: textColor, // Border color matches text color
      borderThickness: 1,
      borderRadius: 8,
    };
    setEditedPresets([...editedPresets, newPreset]);
  };

  const handleDeletePreset = (index: number) => {
    if (confirm('Are you sure you want to delete this style?')) {
      const newPresets = editedPresets.filter((_, i) => i !== index);
      setEditedPresets(newPresets);
    }
  };

  const handleResetPresets = () => {
    if (confirm('Reset all quick styles to defaults? This will remove any custom styles you created.')) {
      setEditedPresets([...DEFAULT_COLOR_PRESETS]);
    }
  };

  const handleResetDefaultStyle = () => {
    if (confirm('Reset default cell style to original values?')) {
      setEditedDefault({ ...DEFAULT_CELL_STYLE });
    }
  };

  const handleMovePresetUp = (index: number) => {
    if (index === 0) return;
    const newPresets = [...editedPresets];
    [newPresets[index - 1], newPresets[index]] = [newPresets[index], newPresets[index - 1]];
    setEditedPresets(newPresets);
  };

  const handleMovePresetDown = (index: number) => {
    if (index === editedPresets.length - 1) return;
    const newPresets = [...editedPresets];
    [newPresets[index], newPresets[index + 1]] = [newPresets[index + 1], newPresets[index]];
    setEditedPresets(newPresets);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          padding: 24,
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #ccc' }}>
          <button
            onClick={() => setActiveTab('default')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'default' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'default' ? 'bold' : 'normal',
            }}
          >
            Default Style
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'presets' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'presets' ? 'bold' : 'normal',
            }}
          >
            Quick Styles
          </button>
        </div>

        {activeTab === 'default' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Background Color</div>
              <input
                type="color"
                value={editedDefault.backgroundColor}
                onChange={(e) => setEditedDefault({ ...editedDefault, backgroundColor: e.target.value })}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}
              />
            </label>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Text Color</div>
              <input
                type="color"
                value={editedDefault.textColor}
                onChange={(e) => setEditedDefault({ ...editedDefault, textColor: e.target.value })}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}
              />
            </label>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Border Color</div>
              <input
                type="color"
                value={editedDefault.borderColor}
                onChange={(e) => setEditedDefault({ ...editedDefault, borderColor: e.target.value })}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}
              />
            </label>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Border Thickness (px)</div>
              <input
                type="number"
                value={editedDefault.borderThickness}
                onChange={(e) => setEditedDefault({ ...editedDefault, borderThickness: parseInt(e.target.value) })}
                style={{ width: '100%', padding: 8, fontSize: 14 }}
                min="0"
                max="10"
              />
            </label>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Border Radius (px)</div>
              <input
                type="number"
                value={editedDefault.borderRadius}
                onChange={(e) => setEditedDefault({ ...editedDefault, borderRadius: parseInt(e.target.value) })}
                style={{ width: '100%', padding: 8, fontSize: 14 }}
                min="0"
                max="50"
              />
            </label>
            <label>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Font Size (px)</div>
              <input
                type="number"
                value={editedDefault.fontSize}
                onChange={(e) => setEditedDefault({ ...editedDefault, fontSize: parseInt(e.target.value) })}
                style={{ width: '100%', padding: 8, fontSize: 14 }}
                min="8"
                max="72"
              />
            </label>
            <button
              onClick={handleResetDefaultStyle}
              style={{
                padding: '8px 16px',
                border: '1px solid #dc2626',
                borderRadius: 4,
                backgroundColor: '#ffffff',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: 14,
                marginTop: 8,
              }}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {activeTab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editedPresets.map((preset, index) => (
              <div key={index} style={{ border: '1px solid #ccc', padding: 12, borderRadius: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleMovePresetUp(index)}
                    disabled={index === 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      color: index === 0 ? '#ccc' : '#3b82f6',
                      padding: 4,
                    }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMovePresetDown(index)}
                    disabled={index === editedPresets.length - 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: index === editedPresets.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      color: index === editedPresets.length - 1 ? '#ccc' : '#3b82f6',
                      padding: 4,
                    }}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDeletePreset(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: '#dc2626',
                      padding: 4,
                    }}
                    title="Delete style"
                  >
                    ✕
                  </button>
                </div>
                <label>
                  <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 'bold' }}>Name</div>
                  <input
                    type="text"
                    value={preset.name}
                    onChange={(e) => handlePresetChange(index, 'name', e.target.value)}
                    style={{ width: '100%', padding: 6, fontSize: 14, marginBottom: 8, border: '1px solid #ccc', borderRadius: 4 }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>Text Color</div>
                    <input
                      type="color"
                      value={preset.textColor}
                      onChange={(e) => handlePresetChange(index, 'textColor', e.target.value)}
                      style={{ width: '100%', height: 30, cursor: 'pointer' }}
                    />
                  </label>
                  <label>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>Background Color</div>
                    <input
                      type="color"
                      value={preset.bgColor}
                      onChange={(e) => handlePresetChange(index, 'bgColor', e.target.value)}
                      style={{ width: '100%', height: 30, cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              onClick={handleAddPreset}
              style={{
                padding: '10px 16px',
                border: '2px dashed #3b82f6',
                borderRadius: 4,
                backgroundColor: '#f0f9ff',
                color: '#3b82f6',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              + Add New Style
            </button>
            <button
              onClick={handleResetPresets}
              style={{
                padding: '8px 16px',
                border: '1px solid #dc2626',
                borderRadius: 4,
                backgroundColor: '#ffffff',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 4,
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 4,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
