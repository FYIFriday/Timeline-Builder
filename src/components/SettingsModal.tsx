import { useState } from 'react';
import { useStore } from '../store';
import { ColorPreset, DefaultCellStyle } from '../types';
import { DEFAULT_COLOR_PRESETS, DEFAULT_CELL_STYLE } from '../store';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const { cells, colorPresets, defaultCellStyle, updateCell, updateColorPreset, setDefaultCellStyle, setColorPresets } = useStore();
  const [activeTab, setActiveTab] = useState<'default' | 'presets' | 'guide'>('default');
  const [editedDefault, setEditedDefault] = useState<DefaultCellStyle>({ ...defaultCellStyle });
  const [editedPresets, setEditedPresets] = useState<ColorPreset[]>([...colorPresets]);
  // Track which original preset each edited preset came from (for handling renames)
  const [presetIndices, setPresetIndices] = useState<number[]>(colorPresets.map((_, i) => i));

  const handleSave = () => {
    // Build a mapping from original preset names to their edited versions
    // Use presetIndices to track which original preset each edited preset came from
    const presetChanges = new Map<string, { edited: ColorPreset, original: ColorPreset }>();

    editedPresets.forEach((editedPreset, index) => {
      const originalIndex = presetIndices[index];
      const originalPreset = colorPresets[originalIndex];
      if (originalPreset) {
        // Map from original name to both original and edited versions
        presetChanges.set(originalPreset.name, {
          edited: editedPreset,
          original: originalPreset
        });
      }
    });

    // Update cells based on preset changes
    cells.forEach(cell => {
      if (cell.styleName) {
        const change = presetChanges.get(cell.styleName);
        if (change) {
          // Check if preset properties changed
          const hasChanged =
            change.original.textColor !== change.edited.textColor ||
            change.original.bgColor !== change.edited.bgColor ||
            change.original.borderColor !== change.edited.borderColor ||
            change.original.borderThickness !== change.edited.borderThickness ||
            change.original.borderRadius !== change.edited.borderRadius;

          const wasRenamed = change.original.name !== change.edited.name;

          if (hasChanged || wasRenamed) {
            // Update cell with new style properties and name
            updateCell(cell.id, {
              textColor: change.edited.textColor,
              backgroundColor: change.edited.bgColor,
              borderColor: change.edited.borderColor || change.edited.textColor,
              borderThickness: change.edited.borderThickness ?? 1,
              borderRadius: change.edited.borderRadius ?? 8,
              styleName: change.edited.name, // Update to new name if renamed
            });
          }
        }
      }
    });

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
    setPresetIndices([...presetIndices, -1]); // -1 indicates a new preset with no original
  };

  const handleDeletePreset = (index: number) => {
    if (confirm('Are you sure you want to delete this style?')) {
      const newPresets = editedPresets.filter((_, i) => i !== index);
      const newIndices = presetIndices.filter((_, i) => i !== index);
      setEditedPresets(newPresets);
      setPresetIndices(newIndices);
    }
  };

  const handleResetPresets = () => {
    if (confirm('Reset all quick styles to defaults? This will remove any custom styles you created.')) {
      setEditedPresets([...DEFAULT_COLOR_PRESETS]);
      setPresetIndices(DEFAULT_COLOR_PRESETS.map((_, i) => i));
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
    const newIndices = [...presetIndices];
    [newPresets[index - 1], newPresets[index]] = [newPresets[index], newPresets[index - 1]];
    [newIndices[index - 1], newIndices[index]] = [newIndices[index], newIndices[index - 1]];
    setEditedPresets(newPresets);
    setPresetIndices(newIndices);
  };

  const handleMovePresetDown = (index: number) => {
    if (index === editedPresets.length - 1) return;
    const newPresets = [...editedPresets];
    const newIndices = [...presetIndices];
    [newPresets[index], newPresets[index + 1]] = [newPresets[index + 1], newPresets[index]];
    [newIndices[index], newIndices[index + 1]] = [newIndices[index + 1], newIndices[index]];
    setEditedPresets(newPresets);
    setPresetIndices(newIndices);
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
          <button
            onClick={() => setActiveTab('guide')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'guide' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'guide' ? 'bold' : 'normal',
            }}
          >
            User Guide
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

        {activeTab === 'guide' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.6 }}>
            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Getting Started</h3>
              <p><strong>Double-click</strong> the canvas to create a new cell</p>
              <p><strong>Shift + double-click</strong> to create a connection dot (for routing connections)</p>
              <p><strong>Double-click a cell</strong> to enter edit mode and add text</p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Text Formatting</h3>
              <p>When editing text, a formatting toolbar appears with:</p>
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li><strong>Bold, Italic, Underline, Strikethrough</strong> buttons</li>
                <li><strong>Font size</strong> - Click to type a custom size, or use +/− buttons</li>
                <li><strong>Text alignment</strong> - Left, Center, Right, or Justify (applies per paragraph)</li>
              </ul>
              <p><strong>Spell check:</strong> Right-click on misspelled words to see suggestions</p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Moving & Resizing</h3>
              <p><strong>Drag</strong> cells to move them</p>
              <p><strong>Drag resize handles</strong> (edges/corners) when selected to resize</p>
              <p><strong>Pan canvas:</strong> Two-finger drag or mouse wheel</p>
              <p><strong>Zoom:</strong> Pinch or Ctrl/Cmd + scroll</p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Connections</h3>
              <p><strong>Ctrl/Cmd + drag</strong> from one cell to another to create a connection</p>
              <p><strong>Right-click</strong> a connection to change its style (Dotted, Dashed, Solid, Bold, Arrow)</p>
              <p><strong>Tip:</strong> Use connection dots to create elbow connections that route around other cells</p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Keyboard Shortcuts</h3>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + C</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Copy</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + V</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Paste</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + Shift + V</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Paste without formatting</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + X</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Cut</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Delete/Backspace</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Delete selected cells</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + Z</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Undo</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Cmd/Ctrl + Shift + Z</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Redo</td></tr>
                  <tr><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}><strong>Shift + Arrow keys</strong></td><td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>Move selected cells</td></tr>
                  <tr><td style={{ padding: '4px 8px' }}><strong>Cmd/Ctrl + A</strong></td><td style={{ padding: '4px 8px' }}>Select all</td></tr>
                </tbody>
              </table>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Context Menu</h3>
              <p><strong>Right-click</strong> on selected cells to access:</p>
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li><strong>Quick Styles</strong> - Apply preset color schemes</li>
                <li><strong>Timeline Cell</strong> - Create a numbered timeline (horizontal/vertical)</li>
                <li><strong>Connection Dot</strong> - Add a routing point for connections</li>
                <li><strong>Colors</strong> - Change cell background, text, borders, or canvas color</li>
                <li><strong>Font</strong> - Adjust size and styling</li>
                <li><strong>Border</strong> - Add/modify borders</li>
                <li><strong>Align</strong> - Align multiple cells to edges or centers</li>
                <li><strong>Distribute</strong> - Evenly space 3+ cells horizontally or vertically</li>
              </ul>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Timeline Cells</h3>
              <p>Create numbered timelines for planning:</p>
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li>Set start/end numbers and granularity (Days, Months, Years, etc.)</li>
                <li>Choose horizontal or vertical orientation</li>
                <li>Reverse order if needed</li>
                <li>Connect other cells to specific timeline points</li>
              </ul>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>File Operations</h3>
              <p><strong>Save:</strong> Cmd/Ctrl + S (saves to current file)</p>
              <p><strong>Save As:</strong> Cmd/Ctrl + Shift + S (choose new location)</p>
              <p><strong>Export:</strong> File menu → Export to PNG, PDF, or JSON</p>
              <p><strong>Auto-save:</strong> Your work is automatically backed up every 3 minutes</p>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Tips & Tricks</h3>
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li>Select multiple cells by drag-selecting or Shift-clicking</li>
                <li>Use connection dots to create professional-looking flowchart routing</li>
                <li>Create custom Quick Styles in Settings for consistent designs</li>
                <li>Align and Distribute tools help create organized layouts</li>
                <li>Timeline cells are perfect for project planning and schedules</li>
              </ul>
            </section>
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
