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
  manuallyResized?: boolean;
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
}

export interface HistoryState {
  cells: Cell[];
  connections: Connection[];
}

export interface Point {
  x: number;
  y: number;
}
