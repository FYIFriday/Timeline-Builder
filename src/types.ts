export interface Cell {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  htmlContent?: string; // HTML formatted content for rich text
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderThickness: number;
  borderRadius: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  styleName?: string; // Track which preset style this cell is using
  isTimeline?: boolean;
  timelineConfig?: TimelineConfig;
  isDot?: boolean; // Connection point/elbow dot
  dotShape?: 'circle' | 'square' | 'diamond'; // Shape of the dot
  groupId?: string; // ID of the group this cell belongs to
  manuallyResized?: boolean;
  isImage?: boolean; // Whether this cell contains an image
  imageData?: string; // Base64 encoded image data
  imageCrop?: { x: number; y: number; width: number; height: number }; // Crop rectangle (0-1 normalized)
}

export interface TimelineConfig {
  startNumber: number;
  endNumber: number;
  granularity: 'Days' | 'Months' | 'Years' | 'Decades' | 'Centuries' | 'Custom';
  customInterval?: number;
  orientation: 'Horizontal' | 'Vertical';
  reverse: boolean;
  displayInterval?: number;
}

export interface Connection {
  id: string;
  fromCellId: string;
  toCellId: string;
  fromPinIndex?: number;
  toPinIndex?: number;
  color: string;
  style: 'Dotted' | 'Dashed' | 'Solid' | 'Bold' | 'Arrow';
  strokeWidth?: number;
}

export interface ColorPreset {
  name: string;
  textColor: string;
  bgColor: string;
  borderColor?: string;
  borderThickness?: number;
  borderRadius?: number;
}

export interface DefaultCellStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderThickness: number;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
  defaultDotSize: number;
  defaultConnectionColor: string;
  defaultConnectionStyle: 'Dotted' | 'Dashed' | 'Solid' | 'Bold' | 'Arrow';
  defaultConnectionThickness: number;
}

export interface PinnedLocation {
  id: string;
  name: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
  textColor: string;
  bgColor: string;
}

export interface CanvasState {
  cells: Cell[];
  connections: Connection[];
  selectedCellIds: string[];
  offsetX: number;
  offsetY: number;
  zoom: number;
  canvasBackgroundColor: string;
  colorPresets: ColorPreset[];
  defaultCellStyle: DefaultCellStyle;
  history: HistoryState[];
  historyIndex: number;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  pinnedLocations: PinnedLocation[];
}

export interface HistoryState {
  cells: Cell[];
  connections: Connection[];
}

export interface Point {
  x: number;
  y: number;
}
