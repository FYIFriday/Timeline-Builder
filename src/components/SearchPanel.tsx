import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';

interface SearchPanelProps {
  onClose: () => void;
}

function SearchPanel({ onClose }: SearchPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchingCellIds, setMatchingCellIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { cells, updateCell, setSelectedCells, saveHistory } = useStore();

  useEffect(() => {
    // Focus search input on mount
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Update matching cells when search text or case sensitivity changes
    if (searchText.trim() === '') {
      setMatchingCellIds([]);
      setCurrentIndex(0);
      return;
    }

    const matches: string[] = [];
    cells.forEach((cell) => {
      const cellText = caseSensitive ? cell.text : cell.text.toLowerCase();
      const search = caseSensitive ? searchText : searchText.toLowerCase();
      if (cellText.includes(search)) {
        matches.push(cell.id);
      }
    });

    setMatchingCellIds(matches);
    setCurrentIndex(matches.length > 0 ? 0 : -1);

    // Highlight first match
    if (matches.length > 0) {
      setSelectedCells([matches[0]]);
    }
  }, [searchText, caseSensitive, cells, setSelectedCells]);

  const handleFindNext = () => {
    if (matchingCellIds.length === 0) return;
    const nextIndex = (currentIndex + 1) % matchingCellIds.length;
    setCurrentIndex(nextIndex);
    setSelectedCells([matchingCellIds[nextIndex]]);
  };

  const handleFindPrevious = () => {
    if (matchingCellIds.length === 0) return;
    const prevIndex = currentIndex - 1 < 0 ? matchingCellIds.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setSelectedCells([matchingCellIds[prevIndex]]);
  };

  const handleReplace = () => {
    if (matchingCellIds.length === 0 || currentIndex < 0) return;

    const cellId = matchingCellIds[currentIndex];
    const cell = cells.find((c) => c.id === cellId);
    if (!cell) return;

    const cellText = caseSensitive ? cell.text : cell.text.toLowerCase();
    const search = caseSensitive ? searchText : searchText.toLowerCase();

    let newText = cell.text;
    if (caseSensitive) {
      newText = newText.replace(searchText, replaceText);
    } else {
      // Case-insensitive replace
      const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      newText = newText.replace(regex, replaceText);
    }

    updateCell(cellId, { text: newText });
    saveHistory();

    // Move to next match after replacing
    handleFindNext();
  };

  const handleReplaceAll = () => {
    if (matchingCellIds.length === 0) return;

    matchingCellIds.forEach((cellId) => {
      const cell = cells.find((c) => c.id === cellId);
      if (!cell) return;

      let newText = cell.text;
      if (caseSensitive) {
        newText = newText.replaceAll(searchText, replaceText);
      } else {
        // Case-insensitive replace all
        const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        newText = newText.replace(regex, replaceText);
      }

      updateCell(cellId, { text: newText });
    });

    saveHistory();
    setSearchText(''); // Clear search to refresh matches
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleFindPrevious();
      } else {
        handleFindNext();
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 20,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: 16,
        minWidth: 320,
        zIndex: 10000,
      }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Find and Replace</h3>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            fontSize: 20,
            cursor: 'pointer',
            padding: 0,
            color: '#666',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Find..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Replace with..."
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', fontSize: 13 }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Case sensitive
        </label>
        <div style={{ marginLeft: 'auto', color: '#666' }}>
          {matchingCellIds.length > 0
            ? `${currentIndex + 1} of ${matchingCellIds.length}`
            : searchText ? 'No results' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={handleFindPrevious}
          disabled={matchingCellIds.length === 0}
          style={{
            flex: 1,
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: matchingCellIds.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            opacity: matchingCellIds.length === 0 ? 0.5 : 1,
          }}
        >
          ← Previous
        </button>
        <button
          onClick={handleFindNext}
          disabled={matchingCellIds.length === 0}
          style={{
            flex: 1,
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: matchingCellIds.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            opacity: matchingCellIds.length === 0 ? 0.5 : 1,
          }}
        >
          Next →
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleReplace}
          disabled={matchingCellIds.length === 0}
          style={{
            flex: 1,
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: matchingCellIds.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            opacity: matchingCellIds.length === 0 ? 0.5 : 1,
          }}
        >
          Replace
        </button>
        <button
          onClick={handleReplaceAll}
          disabled={matchingCellIds.length === 0}
          style={{
            flex: 1,
            padding: '6px 12px',
            border: 'none',
            borderRadius: 4,
            backgroundColor: '#3b82f6',
            color: 'white',
            cursor: matchingCellIds.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            opacity: matchingCellIds.length === 0 ? 0.5 : 1,
          }}
        >
          Replace All
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#666' }}>
        Press Enter to find next, Shift+Enter for previous, Esc to close
      </div>
    </div>
  );
}

export default SearchPanel;
