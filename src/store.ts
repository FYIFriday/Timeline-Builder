import { create } from 'zustand';
import { Cell, Connection, CanvasState, HistoryState, ColorPreset, DefaultCellStyle } from './types';

interface StoreState extends CanvasState {
  addCell: (cell: Cell) => void;
  updateCell: (id: string, updates: Partial<Cell>) => void;
  deleteCell: (id: string) => void;
  deleteCells: (ids: string[]) => void;
  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  deleteConnectionsForCells: (cellIds: string[]) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  setSelectedCells: (ids: string[]) => void;
  addSelectedCell: (id: string) => void;
  removeSelectedCell: (id: string) => void;
  clearSelection: () => void;
  setOffset: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  setCanvasBackgroundColor: (color: string) => void;
  addColorPreset: (preset: ColorPreset) => void;
  updateColorPreset: (index: number, preset: ColorPreset) => void;
  setColorPresets: (presets: ColorPreset[]) => void;
  setDefaultCellStyle: (style: DefaultCellStyle) => void;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadState: (state: Partial<CanvasState>) => void;
  resetState: () => void;
}

const DEFAULT_CELL_COLOR = '#fffdf5';
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_CANVAS_BG = '#fffdf5';

const DEFAULT_COLOR_PRESETS: ColorPreset[] = [
  { name: 'Default', textColor: '#000000', bgColor: '#fffdf5', borderColor: '#000000', borderThickness: 1, borderRadius: 8 },
  { name: 'Red', textColor: '#991B1B', bgColor: '#FEE2E2', borderColor: '#991B1B', borderThickness: 1, borderRadius: 8 },
  { name: 'Orange', textColor: '#9A3412', bgColor: '#FFEDD5', borderColor: '#9A3412', borderThickness: 1, borderRadius: 8 },
  { name: 'Amber', textColor: '#92400E', bgColor: '#FEF3C7', borderColor: '#92400E', borderThickness: 1, borderRadius: 8 },
  { name: 'Green', textColor: '#166534', bgColor: '#DCFCE7', borderColor: '#166534', borderThickness: 1, borderRadius: 8 },
  { name: 'Teal', textColor: '#115E59', bgColor: '#CCFBF1', borderColor: '#115E59', borderThickness: 1, borderRadius: 8 },
  { name: 'Light Blue', textColor: '#1E40AF', bgColor: '#DBEAFE', borderColor: '#1E40AF', borderThickness: 1, borderRadius: 8 },
  { name: 'Navy', textColor: '#1E3A5F', bgColor: '#E0E7F1', borderColor: '#1E3A5F', borderThickness: 1, borderRadius: 8 },
  { name: 'Purple', textColor: '#6B21A8', bgColor: '#F3E8FF', borderColor: '#6B21A8', borderThickness: 1, borderRadius: 8 },
  { name: 'Pink', textColor: '#9D174D', bgColor: '#FCE7F3', borderColor: '#9D174D', borderThickness: 1, borderRadius: 8 },
  { name: 'Rose', textColor: '#9F1239', bgColor: '#FFE4E6', borderColor: '#9F1239', borderThickness: 1, borderRadius: 8 },
  { name: 'Grey', textColor: '#374151', bgColor: '#F3F4F6', borderColor: '#374151', borderThickness: 1, borderRadius: 8 },
];

const DEFAULT_CELL_STYLE: DefaultCellStyle = {
  backgroundColor: DEFAULT_CELL_COLOR,
  textColor: DEFAULT_TEXT_COLOR,
  borderColor: '#000000',
  borderThickness: 1,
  borderRadius: 8,
  fontSize: 16,
  fontFamily: 'Arial',
};

const initialState: CanvasState = {
  cells: [],
  connections: [],
  selectedCellIds: [],
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  canvasBackgroundColor: DEFAULT_CANVAS_BG,
  colorPresets: DEFAULT_COLOR_PRESETS,
  defaultCellStyle: DEFAULT_CELL_STYLE,
  history: [],
  historyIndex: -1,
};

export const useStore = create<StoreState>((set, get) => ({
  ...initialState,

  addCell: (cell) => {
    set((state) => {
      const newState = { ...state, cells: [...state.cells, cell] };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  updateCell: (id, updates) => {
    set((state) => {
      const newState = {
        ...state,
        cells: state.cells.map((cell) =>
          cell.id === id ? { ...cell, ...updates } : cell
        ),
      };
      return newState;
    });
  },

  deleteCell: (id) => {
    set((state) => {
      const newState = {
        ...state,
        cells: state.cells.filter((cell) => cell.id !== id),
        connections: state.connections.filter(
          (conn) => conn.fromCellId !== id && conn.toCellId !== id
        ),
        selectedCellIds: state.selectedCellIds.filter((cid) => cid !== id),
      };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  deleteCells: (ids) => {
    set((state) => {
      const idsSet = new Set(ids);
      const newState = {
        ...state,
        cells: state.cells.filter((cell) => !idsSet.has(cell.id)),
        connections: state.connections.filter(
          (conn) => !idsSet.has(conn.fromCellId) && !idsSet.has(conn.toCellId)
        ),
        selectedCellIds: state.selectedCellIds.filter((cid) => !idsSet.has(cid)),
      };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  addConnection: (connection) => {
    set((state) => {
      const newState = {
        ...state,
        connections: [...state.connections, connection],
      };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  deleteConnection: (id) => {
    set((state) => {
      const newState = {
        ...state,
        connections: state.connections.filter((conn) => conn.id !== id),
      };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  deleteConnectionsForCells: (cellIds) => {
    set((state) => {
      const idsSet = new Set(cellIds);
      const newState = {
        ...state,
        connections: state.connections.filter(
          (conn) => !idsSet.has(conn.fromCellId) || !idsSet.has(conn.toCellId)
        ),
      };
      saveHistoryHelper(newState);
      return newState;
    });
  },

  updateConnection: (id, updates) => {
    set((state) => {
      const newState = {
        ...state,
        connections: state.connections.map((conn) =>
          conn.id === id ? { ...conn, ...updates } : conn
        ),
      };
      return newState;
    });
  },

  setSelectedCells: (ids) => {
    set({ selectedCellIds: ids });
  },

  addSelectedCell: (id) => {
    set((state) => ({
      selectedCellIds: [...state.selectedCellIds, id],
    }));
  },

  removeSelectedCell: (id) => {
    set((state) => ({
      selectedCellIds: state.selectedCellIds.filter((cid) => cid !== id),
    }));
  },

  clearSelection: () => {
    set({ selectedCellIds: [] });
  },

  setOffset: (x, y) => {
    set({ offsetX: x, offsetY: y });
  },

  setZoom: (zoom) => {
    set({ zoom: Math.max(0.1, Math.min(4, zoom)) });
  },

  setCanvasBackgroundColor: (color) => {
    set({ canvasBackgroundColor: color });
  },

  addColorPreset: (preset) => {
    set((state) => ({
      colorPresets: [...state.colorPresets, preset],
    }));
  },

  updateColorPreset: (index, preset) => {
    set((state) => {
      const newPresets = [...state.colorPresets];
      newPresets[index] = preset;
      return { colorPresets: newPresets };
    });
  },

  setColorPresets: (presets) => {
    set({ colorPresets: presets });
  },

  setDefaultCellStyle: (style) => {
    set({ defaultCellStyle: style });
  },

  saveHistory: () => {
    set((state) => {
      saveHistoryHelper(state);
      return state;
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const historyState = state.history[newIndex];
        return {
          ...state,
          cells: historyState.cells,
          connections: historyState.connections,
          historyIndex: newIndex,
        };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const historyState = state.history[newIndex];
        return {
          ...state,
          cells: historyState.cells,
          connections: historyState.connections,
          historyIndex: newIndex,
        };
      }
      return state;
    });
  },

  loadState: (newState) => {
    set((state) => {
      const merged = { ...state, ...newState };
      saveHistoryHelper(merged);
      return merged;
    });
  },

  resetState: () => {
    set({ ...initialState });
  },
}));

function saveHistoryHelper(state: CanvasState) {
  const historyState: HistoryState = {
    cells: JSON.parse(JSON.stringify(state.cells)),
    connections: JSON.parse(JSON.stringify(state.connections)),
  };

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(historyState);

  if (newHistory.length > 100) {
    newHistory.shift();
  }

  state.history = newHistory;
  state.historyIndex = newHistory.length - 1;
}

export { DEFAULT_CELL_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_CANVAS_BG, DEFAULT_COLOR_PRESETS, DEFAULT_CELL_STYLE };
