import { useState } from 'react';

interface FirstLaunchGuideProps {
  onClose: () => void;
  onDontShowAgain: () => void;
}

function FirstLaunchGuide({ onClose, onDontShowAgain }: FirstLaunchGuideProps) {
  const [dontShowChecked, setDontShowChecked] = useState(false);

  const handleClose = () => {
    if (dontShowChecked) {
      onDontShowAgain();
    }
    onClose();
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
      onClick={handleClose}
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
          <h2 style={{ margin: 0, fontSize: 20 }}>Welcome to Timeline Free Plotter!</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.6 }}>
          <section>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Getting Started</h3>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li><strong>Double-click</strong> the canvas to create a new cell</li>
              <li><strong>Click and drag</strong> a template cell from the Styles tool</li>
              <li><strong>Right-click</strong> on an existing cell to change its format</li>
              <li><strong>Shift + double-click</strong> to create a connection dot (for routing connections)</li>
              <li><strong>Double-click a cell</strong> to enter edit mode and add text</li>
              <li><strong>Name, change and re-order</strong> the styles in Settings. Use different colors and formats to denote different people, countries, plotlines, etc.</li>
              <li><strong>Pin canvas locations</strong> for quick navigation - right-click and select Pin Location, then access saved locations via the 📍 button in the bottom left</li>
            </ul>
          </section>

          <section>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Tips & Tricks</h3>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>Select multiple cells by area-selecting or holding shift while clicking</li>
              <li>Create groups using the right-click menu for easy tile management</li>
              <li>Use connection dots to create professional-looking flowchart routing</li>
              <li>Create custom Quick Styles in Settings for consistent designs</li>
              <li>Align and Distribute tools help create organized layouts</li>
              <li>Timeline cells are perfect for project planning and schedules</li>
              <li>Add a background grid under settings for easy tile alignment</li>
            </ul>
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
              <li><strong>Distribute</strong> - Evenly space 3+ objects (cells or dots) horizontally or vertically</li>
            </ul>
          </section>

          <section>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Connections</h3>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li><strong>Ctrl/Cmd + drag</strong> from one cell to another to create a connection</li>
              <li><strong>Right-click</strong> a connection to change its style (Dotted, Dashed, Solid, Bold, Arrow)</li>
              <li><strong>Tip:</strong> Use connection dots to create elbow connections that route around other cells</li>
            </ul>
          </section>

          <section>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Moving & Resizing</h3>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li><strong>Drag</strong> cells to move them</li>
              <li><strong>Drag resize handles</strong> (edges/corners) when selected to resize</li>
              <li><strong>Pan canvas:</strong> Two-finger drag or mouse wheel</li>
              <li><strong>Zoom:</strong> Pinch or Ctrl/Cmd + scroll</li>
            </ul>
          </section>

          <section>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>Adding a Custom Timeline</h3>
            <p>Create numbered timelines for planning:</p>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>Set start/end numbers and granularity (Days, Months, Years, etc.)</li>
              <li>Choose horizontal or vertical orientation</li>
              <li>Reverse order if needed</li>
              <li>Connect other cells to specific timeline points</li>
            </ul>
            <p style={{ marginTop: 8, fontSize: 13, color: '#666' }}><strong>Note:</strong> Does not support negative numbers. Tick the Reverse Order box if you need the numbers to flow backwards.</p>
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
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, borderBottom: '2px solid #3b82f6', paddingBottom: 4 }}>File Operations</h3>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li><strong>Save:</strong> Cmd/Ctrl + S (saves to current file)</li>
              <li><strong>Save As:</strong> Cmd/Ctrl + Shift + S (choose new location)</li>
              <li><strong>Export:</strong> File menu → Export to PNG, PDF, or JSON</li>
              <li><strong>Auto-save:</strong> Your work is automatically backed up every 3 minutes</li>
            </ul>
          </section>

          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            You can access this guide anytime from Settings → User Guide tab
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dontShowChecked}
              onChange={(e) => setDontShowChecked(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Don't show this again
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
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
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default FirstLaunchGuide;
