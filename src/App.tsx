import { useCallback, useEffect, useRef, useState } from 'react';
import Canvas from './components/Canvas';
import FirstLaunchGuide from './components/FirstLaunchGuide';
import { useStore } from './store';
import { Cell, Connection } from './types';

// Helper function to parse HTML and extract text segments with formatting
interface TextSegment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  fontSize?: number;
  color?: string;
}

interface ParsedLine {
  segments: TextSegment[];
  alignment: 'left' | 'center' | 'right' | 'justify';
}

function parseHtmlToSegments(html: string, baseFontSize: number, defaultAlignment: 'left' | 'center' | 'right' | 'justify' = 'left'): ParsedLine[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const lines: ParsedLine[] = [];
  let currentLine: TextSegment[] = [];
  let currentAlignment: 'left' | 'center' | 'right' | 'justify' = defaultAlignment;

  const traverse = (node: Node, inheritedBold = false, inheritedItalic = false, inheritedUnderline = false, inheritedStrikethrough = false, inheritedFontSize?: number, inheritedAlignment?: 'left' | 'center' | 'right' | 'justify', inheritedColor?: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        currentLine.push({
          text,
          isBold: inheritedBold,
          isItalic: inheritedItalic,
          isUnderline: inheritedUnderline,
          isStrikethrough: inheritedStrikethrough,
          fontSize: inheritedFontSize,
          color: inheritedColor,
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Handle line breaks
      if (tagName === 'br') {
        // Push current line (even if empty - this creates blank lines)
        lines.push({
          segments: currentLine.length > 0 ? [...currentLine] : [{
            text: '',
            isBold: false,
            isItalic: false,
            isUnderline: false,
            isStrikethrough: false
          }],
          alignment: currentAlignment
        });
        currentLine = [];
        return;
      }

      // Handle list items
      if (tagName === 'li') {
        // Add bullet prefix
        currentLine.push({
          text: '• ',
          isBold: inheritedBold,
          isItalic: inheritedItalic,
          isUnderline: inheritedUnderline,
          isStrikethrough: inheritedStrikethrough,
          fontSize: inheritedFontSize,
          color: inheritedColor,
        });
      }

      // Update formatting flags based on tag
      const isBold = inheritedBold || tagName === 'strong' || tagName === 'b';
      const isItalic = inheritedItalic || tagName === 'em' || tagName === 'i';
      const isUnderline = inheritedUnderline || tagName === 'u';
      const isStrikethrough = inheritedStrikethrough || tagName === 's' || tagName === 'strike' || tagName === 'del';

      // Check for font size in style
      let fontSize = inheritedFontSize;
      if (element.style.fontSize) {
        const match = element.style.fontSize.match(/(\d+)px/);
        if (match) {
          fontSize = parseInt(match[1]);
        }
      }

      // Check for text color in style - handle both inline styles and computed styles
      let color = inheritedColor;
      if (element.style.color) {
        // Inline style has priority
        color = element.style.color;
      } else if (tagName === 'span' || tagName === 'font') {
        // Check for color attribute on span/font tags (legacy HTML)
        const colorAttr = element.getAttribute('color');
        if (colorAttr) {
          color = colorAttr;
        }
      }

      // Check for text alignment
      let alignment = inheritedAlignment || currentAlignment;
      if (element.style.textAlign) {
        const align = element.style.textAlign.toLowerCase();
        if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') {
          alignment = align as 'left' | 'center' | 'right' | 'justify';
          currentAlignment = alignment;
        }
      } else if (element.getAttribute('align')) {
        const align = element.getAttribute('align')!.toLowerCase();
        if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') {
          alignment = align as 'left' | 'center' | 'right' | 'justify';
          currentAlignment = alignment;
        }
      }

      // Traverse children
      node.childNodes.forEach(child => traverse(child, isBold, isItalic, isUnderline, isStrikethrough, fontSize, alignment, color));

      // Handle block elements that create new lines
      if (['div', 'p', 'li'].includes(tagName) && currentLine.length > 0) {
        lines.push({ segments: [...currentLine], alignment: currentAlignment });
        currentLine = [];
      }
    }
  };

  traverse(tempDiv);

  // Add any remaining content
  if (currentLine.length > 0) {
    lines.push({ segments: currentLine, alignment: currentAlignment });
  }

  // If no lines, return a single empty line with default alignment
  if (lines.length === 0) {
    lines.push({
      segments: [{ text: '', isBold: false, isItalic: false, isUnderline: false, isStrikethrough: false }],
      alignment: defaultAlignment
    });
  }

  return lines;
}

function wrapTextSegments(
  lines: ParsedLine[],
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  cell: { fontSize: number; fontFamily: string; bold: boolean; italic: boolean }
): ParsedLine[] {
  const wrappedLines: ParsedLine[] = [];

  lines.forEach((parsedLine) => {
    const { segments: line, alignment } = parsedLine;
    if (line.length === 0) {
      wrappedLines.push(parsedLine);
      return;
    }

    // Check if this is an empty line (blank line from <br>)
    const isEmpty = line.length === 1 && line[0].text === '';
    if (isEmpty) {
      wrappedLines.push(parsedLine);
      return;
    }

    // Build a flat list of words with their formatting
    interface WordWithFormat extends TextSegment {
      word: string;
      width: number;
    }

    const words: WordWithFormat[] = [];

    line.forEach((segment) => {
      const segFontSize = segment.fontSize || cell.fontSize;
      const font = `${cell.italic || segment.isItalic ? 'italic ' : ''}${segment.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
      ctx.font = font;

      // Split by spaces while preserving them
      const parts = segment.text.split(' ');
      parts.forEach((part, idx) => {
        // Add the word with a leading space if not first word
        if (idx === 0) {
          // First word - no leading space
          if (part.length > 0) {
            words.push({
              text: segment.text,
              isBold: segment.isBold,
              isItalic: segment.isItalic,
              isUnderline: segment.isUnderline,
              isStrikethrough: segment.isStrikethrough,
              fontSize: segment.fontSize,
              color: segment.color,
              word: part,
              width: ctx.measureText(part).width,
            });
          }
        } else {
          // Subsequent words - always add with leading space
          // This preserves spaces even after punctuation like ": "
          const wordText = ' ' + part;
          words.push({
            text: segment.text,
            isBold: segment.isBold,
            isItalic: segment.isItalic,
            isUnderline: segment.isUnderline,
            isStrikethrough: segment.isStrikethrough,
            fontSize: segment.fontSize,
            color: segment.color,
            word: wordText,
            width: ctx.measureText(wordText).width,
          });
        }
      });
    });

    // Now build wrapped lines from words
    let currentLine: TextSegment[] = [];
    let currentLineWidth = 0;

    words.forEach((wordInfo) => {
      // Check if we need to wrap
      if (currentLineWidth + wordInfo.width > maxWidth && currentLine.length > 0) {
        // Finish current line
        wrappedLines.push({ segments: currentLine, alignment });
        currentLine = [];
        currentLineWidth = 0;

        // Start new line with this word (trim leading space if present)
        const trimmedWord = wordInfo.word.trimStart();
        const segFontSize = wordInfo.fontSize || cell.fontSize;
        const font = `${cell.italic || wordInfo.isItalic ? 'italic ' : ''}${wordInfo.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
        ctx.font = font;
        const trimmedWidth = ctx.measureText(trimmedWord).width;

        currentLine.push({
          text: trimmedWord,
          isBold: wordInfo.isBold,
          isItalic: wordInfo.isItalic,
          isUnderline: wordInfo.isUnderline,
          isStrikethrough: wordInfo.isStrikethrough,
          fontSize: wordInfo.fontSize,
          color: wordInfo.color,
        });
        currentLineWidth = trimmedWidth;
      } else {
        // Add to current line
        const lastSeg = currentLine[currentLine.length - 1];

        // Try to merge with previous segment if formatting matches
        if (lastSeg &&
            lastSeg.isBold === wordInfo.isBold &&
            lastSeg.isItalic === wordInfo.isItalic &&
            lastSeg.isUnderline === wordInfo.isUnderline &&
            lastSeg.isStrikethrough === wordInfo.isStrikethrough &&
            lastSeg.fontSize === wordInfo.fontSize &&
            lastSeg.color === wordInfo.color) {
          // Merge into last segment
          lastSeg.text += wordInfo.word;
        } else {
          // Create new segment
          currentLine.push({
            text: wordInfo.word,
            isBold: wordInfo.isBold,
            isItalic: wordInfo.isItalic,
            isUnderline: wordInfo.isUnderline,
            isStrikethrough: wordInfo.isStrikethrough,
            fontSize: wordInfo.fontSize,
            color: wordInfo.color,
          });
        }
        currentLineWidth += wordInfo.width;
      }
    });

    // Add final line
    if (currentLine.length > 0) {
      wrappedLines.push({ segments: currentLine, alignment });
    }
  });

  return wrappedLines.length > 0 ? wrappedLines : lines;
}

declare global {
  interface Window {
    electron?: {
      saveFile: (data: string) => Promise<string | null>;
      saveFileAs: (data: string) => Promise<string | null>;
      saveBackup: (data: string) => Promise<string | null>;
      loadBackup: () => Promise<string | null>;
      exportPng: (dataUrl: string) => Promise<string | null>;
      exportPdf: (dataUrl: string) => Promise<string | null>;
      exportJson: (data: string) => Promise<string | null>;
      setWindowTitle: (title: string) => Promise<void>;
      getCurrentFilename: () => Promise<string | null>;
      onMenuNew: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      onMenuExportPng: (callback: () => void) => void;
      onMenuExportPdf: (callback: () => void) => void;
      onMenuExportJson: (callback: () => void) => void;
      onMenuSearch: (callback: () => void) => void;
      onFileOpened: (callback: (data: string) => void) => void;
    };
  }
}

function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [showFirstLaunchGuide, setShowFirstLaunchGuide] = useState(false);
  const [showExportRegionDialog, setShowExportRegionDialog] = useState(false);
  const [exportRegionBounds, setExportRegionBounds] = useState<{ minX: number; maxX: number; minY: number; maxY: number } | null>(null);

  // Define export functions at component level so they're accessible everywhere
  const handleExportPng = useCallback(async (bounds?: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const state = useStore.getState();
    const { cells, connections, canvasBackgroundColor } = state;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Filter cells and connections if bounds are provided
    let exportCells = cells;
    let exportConnections = connections;

    if (bounds) {
      exportCells = cells.filter((cell) => {
        const cellRight = cell.x + cell.width;
        const cellBottom = cell.y + cell.height;
        return !(cell.x > bounds.maxX || cellRight < bounds.minX || cell.y > bounds.maxY || cellBottom < bounds.minY);
      });

      const exportCellIds = new Set(exportCells.map(c => c.id));
      exportConnections = connections.filter((conn) =>
        exportCellIds.has(conn.fromCellId) && exportCellIds.has(conn.toCellId)
      );
    }

    if (exportCells.length === 0) return;

    let minX = bounds?.minX ?? Infinity;
    let minY = bounds?.minY ?? Infinity;
    let maxX = bounds?.maxX ?? -Infinity;
    let maxY = bounds?.maxY ?? -Infinity;

    if (!bounds) {
      exportCells.forEach((cell) => {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x + cell.width);
        maxY = Math.max(maxY, cell.y + cell.height);
      });
    }

    const padding = 25;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = canvasBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw connections and cells (same rendering logic as before)
    exportConnections.forEach((conn) => {
      const fromCell = exportCells.find((c) => c.id === conn.fromCellId);
      const toCell = exportCells.find((c) => c.id === conn.toCellId);
      if (!fromCell || !toCell) return;

      const x1 = fromCell.x - minX + padding + fromCell.width / 2;
      const y1 = fromCell.y - minY + padding + fromCell.height / 2;
      let x2 = toCell.x - minX + padding + toCell.width / 2;
      let y2 = toCell.y - minY + padding + toCell.height / 2;

      if (conn.style === 'Arrow') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cellLeft = toCell.x - minX + padding;
        const cellRight = toCell.x - minX + padding + toCell.width;
        const cellTop = toCell.y - minY + padding;
        const cellBottom = toCell.y - minY + padding + toCell.height;
        const intersections: Array<{ x: number; y: number; dist: number }> = [];

        if (dy !== 0) {
          const t = (cellTop - y1) / dy;
          if (t > 0 && t <= 1) {
            const ix = x1 + t * dx;
            if (ix >= cellLeft && ix <= cellRight) {
              intersections.push({ x: ix, y: cellTop, dist: Math.sqrt((ix - x1) ** 2 + (cellTop - y1) ** 2) });
            }
          }
        }
        if (dy !== 0) {
          const t = (cellBottom - y1) / dy;
          if (t > 0 && t <= 1) {
            const ix = x1 + t * dx;
            if (ix >= cellLeft && ix <= cellRight) {
              intersections.push({ x: ix, y: cellBottom, dist: Math.sqrt((ix - x1) ** 2 + (cellBottom - y1) ** 2) });
            }
          }
        }
        if (dx !== 0) {
          const t = (cellLeft - x1) / dx;
          if (t > 0 && t <= 1) {
            const iy = y1 + t * dy;
            if (iy >= cellTop && iy <= cellBottom) {
              intersections.push({ x: cellLeft, y: iy, dist: Math.sqrt((cellLeft - x1) ** 2 + (iy - y1) ** 2) });
            }
          }
        }
        if (dx !== 0) {
          const t = (cellRight - x1) / dx;
          if (t > 0 && t <= 1) {
            const iy = y1 + t * dy;
            if (iy >= cellTop && iy <= cellBottom) {
              intersections.push({ x: cellRight, y: iy, dist: Math.sqrt((cellRight - x1) ** 2 + (iy - y1) ** 2) });
            }
          }
        }

        if (intersections.length > 0) {
          intersections.sort((a, b) => a.dist - b.dist);
          x2 = intersections[0].x;
          y2 = intersections[0].y;
        }
      }

      ctx.strokeStyle = conn.color;
      ctx.lineWidth = conn.style === 'Bold' ? 3 : 1;
      ctx.setLineDash(conn.style === 'Dotted' ? [2, 4] : conn.style === 'Dashed' ? [8, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (conn.style === 'Arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        ctx.fillStyle = conn.color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    });

    exportCells.forEach((cell) => {
      const x = cell.x - minX + padding;
      const y = cell.y - minY + padding;

      if (cell.isTimeline && cell.timelineConfig) {
        const config = cell.timelineConfig;
        const numbers: number[] = [];
        const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
        const display = config.displayInterval || 1;
        let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
        const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
        const startForModulo = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

        if (config.reverse) {
          while (current >= end) {
            if ((startForModulo - current) % display === 0) numbers.push(current);
            current -= step;
          }
        } else {
          while (current <= end) {
            if ((current - startForModulo) % display === 0) numbers.push(current);
            current += step;
          }
        }

        const isHorizontal = config.orientation === 'Horizontal';
        const itemWidth = isHorizontal ? 60 : 40;
        const itemHeight = isHorizontal ? 40 : 60;

        ctx.fillStyle = cell.backgroundColor;
        ctx.fillRect(x, y, cell.width, cell.height);
        ctx.fillStyle = cell.textColor;
        ctx.font = `${cell.fontSize}px ${cell.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        numbers.forEach((num, index) => {
          const itemX = isHorizontal ? x + index * itemWidth : x;
          const itemY = isHorizontal ? y : y + index * itemHeight;
          const drawWidth = isHorizontal ? itemWidth : cell.width;
          const drawHeight = isHorizontal ? cell.height : itemHeight;
          ctx.fillText(String(num), itemX + drawWidth / 2, itemY + drawHeight / 2);

          if (index < numbers.length - 1) {
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (isHorizontal) {
              ctx.moveTo(itemX + itemWidth, itemY);
              ctx.lineTo(itemX + itemWidth, itemY + drawHeight);
            } else {
              ctx.moveTo(itemX, itemY + itemHeight);
              ctx.lineTo(itemX + drawWidth, itemY + itemHeight);
            }
            ctx.stroke();
          }
        });
      } else {
        ctx.fillStyle = cell.backgroundColor;
        if (cell.borderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, cell.width, cell.height, cell.borderRadius);
          ctx.fill();
          if (cell.borderThickness > 0) {
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            ctx.stroke();
          }
        } else {
          ctx.fillRect(x, y, cell.width, cell.height);
          if (cell.borderThickness > 0) {
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            ctx.strokeRect(x, y, cell.width, cell.height);
          }
        }

        ctx.font = `${cell.italic ? 'italic ' : ''}${cell.bold ? 'bold ' : ''}${cell.fontSize}px ${cell.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Save context and clip to cell bounds to prevent text overflow
        ctx.save();
        ctx.beginPath();
        if (cell.borderRadius > 0) {
          ctx.roundRect(x, y, cell.width, cell.height, cell.borderRadius);
        } else {
          ctx.rect(x, y, cell.width, cell.height);
        }
        ctx.clip();

        const htmlContent = cell.htmlContent || cell.text.replace(/\n/g, '<br>');
        // Ensure cell alignment is valid, default to 'left'
        const cellAlignment: 'left' | 'center' | 'right' | 'justify' =
          (cell.textAlign === 'left' || cell.textAlign === 'center' || cell.textAlign === 'right' || cell.textAlign === 'justify')
            ? cell.textAlign
            : 'left';
        const parsedLines = parseHtmlToSegments(htmlContent, cell.fontSize, cellAlignment);
        const maxTextWidth = cell.width - 24; // Comfortable padding (12px on each side)
        const lines = wrapTextSegments(parsedLines, maxTextWidth, ctx, cell);
        const startY = y + 12; // Comfortable top padding with half-leading space

        // Calculate line heights dynamically based on max font size per line
        const lineHeights = lines.map(line => {
          // Check if line is empty (blank line)
          const isEmpty = line.segments.length === 1 && line.segments[0].text === '';
          if (isEmpty) {
            return cell.fontSize * 1.3; // Use base font size for empty lines
          }
          const maxFontSize = line.segments.reduce((max, seg) =>
            Math.max(max, seg.fontSize || cell.fontSize), cell.fontSize);
          return maxFontSize * 1.3; // Slightly more spacing to prevent overlap
        });

        // Calculate cumulative Y positions
        let currentY = startY;

        lines.forEach((line, lineIndex) => {
          const { segments, alignment: lineAlignment } = line;
          // Ensure alignment is valid, default to 'left' if undefined/invalid
          const alignment = (lineAlignment === 'left' || lineAlignment === 'center' || lineAlignment === 'right' || lineAlignment === 'justify')
            ? lineAlignment
            : 'left';

          const totalWidth = segments.reduce((sum, seg) => {
            const segFontSize = seg.fontSize || cell.fontSize;
            const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
            ctx.font = font;
            return sum + ctx.measureText(seg.text).width;
          }, 0);

          let currentX: number;
          if (alignment === 'left') {
            currentX = x + 12;
          } else if (alignment === 'right') {
            currentX = x + cell.width - 12 - totalWidth;
          } else if (alignment === 'center' || alignment === 'justify') {
            // Explicitly only center when alignment is 'center' or 'justify'
            currentX = x + cell.width / 2 - totalWidth / 2;
          } else {
            // Fallback to left (should never reach here due to check above)
            currentX = x + 12;
          }
          segments.forEach(seg => {
            // Skip empty segments (blank lines)
            if (seg.text === '') return;

            const segFontSize = seg.fontSize || cell.fontSize;
            const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
            ctx.font = font;

            // Apply text color from segment or fall back to cell color
            ctx.fillStyle = seg.color || cell.textColor;
            ctx.strokeStyle = seg.color || cell.textColor;

            ctx.fillText(seg.text, currentX, currentY);

            if (cell.underline || seg.isUnderline) {
              const textWidth = ctx.measureText(seg.text).width;
              ctx.beginPath();
              ctx.moveTo(currentX, currentY + segFontSize * 0.15);
              ctx.lineTo(currentX + textWidth, currentY + segFontSize * 0.15);
              ctx.stroke();
            }
            if (cell.strikethrough || seg.isStrikethrough) {
              const textWidth = ctx.measureText(seg.text).width;
              ctx.beginPath();
              ctx.moveTo(currentX, currentY + segFontSize * 0.5);
              ctx.lineTo(currentX + textWidth, currentY + segFontSize * 0.5);
              ctx.stroke();
            }
            currentX += ctx.measureText(seg.text).width;
          });

          // Move to next line
          currentY += lineHeights[lineIndex];
        });

        // Restore context to remove clipping
        ctx.restore();
      }
    });

    const dataUrl = canvas.toDataURL('image/png');
    if (window.electron) {
      await window.electron.exportPng(dataUrl);
    }
  }, []);

  const handleExportPdf = useCallback(async (bounds?: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const state = useStore.getState();
    const { cells, connections, canvasBackgroundColor } = state;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Same filtering and rendering logic as PNG
    let exportCells = cells;
    let exportConnections = connections;

    if (bounds) {
      exportCells = cells.filter((cell) => {
        const cellRight = cell.x + cell.width;
        const cellBottom = cell.y + cell.height;
        return !(cell.x > bounds.maxX || cellRight < bounds.minX || cell.y > bounds.maxY || cellBottom < bounds.minY);
      });

      const exportCellIds = new Set(exportCells.map(c => c.id));
      exportConnections = connections.filter((conn) =>
        exportCellIds.has(conn.fromCellId) && exportCellIds.has(conn.toCellId)
      );
    }

    if (exportCells.length === 0) return;

    let minX = bounds?.minX ?? Infinity;
    let minY = bounds?.minY ?? Infinity;
    let maxX = bounds?.maxX ?? -Infinity;
    let maxY = bounds?.maxY ?? -Infinity;

    if (!bounds) {
      exportCells.forEach((cell) => {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x + cell.width);
        maxY = Math.max(maxY, cell.y + cell.height);
      });
    }

    const padding = 25;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = canvasBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Same rendering code as PNG (connections and cells)
    exportConnections.forEach((conn) => {
      const fromCell = exportCells.find((c) => c.id === conn.fromCellId);
      const toCell = exportCells.find((c) => c.id === conn.toCellId);
      if (!fromCell || !toCell) return;

      const x1 = fromCell.x - minX + padding + fromCell.width / 2;
      const y1 = fromCell.y - minY + padding + fromCell.height / 2;
      let x2 = toCell.x - minX + padding + toCell.width / 2;
      let y2 = toCell.y - minY + padding + toCell.height / 2;

      if (conn.style === 'Arrow') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cellLeft = toCell.x - minX + padding;
        const cellRight = toCell.x - minX + padding + toCell.width;
        const cellTop = toCell.y - minY + padding;
        const cellBottom = toCell.y - minY + padding + toCell.height;
        const intersections: Array<{ x: number; y: number; dist: number }> = [];

        if (dy !== 0) {
          const t = (cellTop - y1) / dy;
          if (t > 0 && t <= 1) {
            const ix = x1 + t * dx;
            if (ix >= cellLeft && ix <= cellRight) {
              intersections.push({ x: ix, y: cellTop, dist: Math.sqrt((ix - x1) ** 2 + (cellTop - y1) ** 2) });
            }
          }
        }
        if (dy !== 0) {
          const t = (cellBottom - y1) / dy;
          if (t > 0 && t <= 1) {
            const ix = x1 + t * dx;
            if (ix >= cellLeft && ix <= cellRight) {
              intersections.push({ x: ix, y: cellBottom, dist: Math.sqrt((ix - x1) ** 2 + (cellBottom - y1) ** 2) });
            }
          }
        }
        if (dx !== 0) {
          const t = (cellLeft - x1) / dx;
          if (t > 0 && t <= 1) {
            const iy = y1 + t * dy;
            if (iy >= cellTop && iy <= cellBottom) {
              intersections.push({ x: cellLeft, y: iy, dist: Math.sqrt((cellLeft - x1) ** 2 + (iy - y1) ** 2) });
            }
          }
        }
        if (dx !== 0) {
          const t = (cellRight - x1) / dx;
          if (t > 0 && t <= 1) {
            const iy = y1 + t * dy;
            if (iy >= cellTop && iy <= cellBottom) {
              intersections.push({ x: cellRight, y: iy, dist: Math.sqrt((cellRight - x1) ** 2 + (iy - y1) ** 2) });
            }
          }
        }

        if (intersections.length > 0) {
          intersections.sort((a, b) => a.dist - b.dist);
          x2 = intersections[0].x;
          y2 = intersections[0].y;
        }
      }

      ctx.strokeStyle = conn.color;
      ctx.lineWidth = conn.style === 'Bold' ? 3 : 1;
      ctx.setLineDash(conn.style === 'Dotted' ? [2, 4] : conn.style === 'Dashed' ? [8, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (conn.style === 'Arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        ctx.fillStyle = conn.color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    });

    exportCells.forEach((cell) => {
      const x = cell.x - minX + padding;
      const y = cell.y - minY + padding;

      if (cell.isTimeline && cell.timelineConfig) {
        const config = cell.timelineConfig;
        const numbers: number[] = [];
        const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
        const display = config.displayInterval || 1;
        let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
        const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
        const startForModulo = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

        if (config.reverse) {
          while (current >= end) {
            if ((startForModulo - current) % display === 0) numbers.push(current);
            current -= step;
          }
        } else {
          while (current <= end) {
            if ((current - startForModulo) % display === 0) numbers.push(current);
            current += step;
          }
        }

        const isHorizontal = config.orientation === 'Horizontal';
        const itemWidth = isHorizontal ? 60 : 40;
        const itemHeight = isHorizontal ? 40 : 60;

        ctx.fillStyle = cell.backgroundColor;
        ctx.fillRect(x, y, cell.width, cell.height);
        ctx.fillStyle = cell.textColor;
        ctx.font = `${cell.fontSize}px ${cell.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        numbers.forEach((num, index) => {
          const itemX = isHorizontal ? x + index * itemWidth : x;
          const itemY = isHorizontal ? y : y + index * itemHeight;
          const drawWidth = isHorizontal ? itemWidth : cell.width;
          const drawHeight = isHorizontal ? cell.height : itemHeight;
          ctx.fillText(String(num), itemX + drawWidth / 2, itemY + drawHeight / 2);

          if (index < numbers.length - 1) {
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (isHorizontal) {
              ctx.moveTo(itemX + itemWidth, itemY);
              ctx.lineTo(itemX + itemWidth, itemY + drawHeight);
            } else {
              ctx.moveTo(itemX, itemY + itemHeight);
              ctx.lineTo(itemX + drawWidth, itemY + itemHeight);
            }
            ctx.stroke();
          }
        });
      } else {
        ctx.fillStyle = cell.backgroundColor;
        if (cell.borderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, cell.width, cell.height, cell.borderRadius);
          ctx.fill();
          if (cell.borderThickness > 0) {
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            ctx.stroke();
          }
        } else {
          ctx.fillRect(x, y, cell.width, cell.height);
          if (cell.borderThickness > 0) {
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            ctx.strokeRect(x, y, cell.width, cell.height);
          }
        }

        ctx.font = `${cell.italic ? 'italic ' : ''}${cell.bold ? 'bold ' : ''}${cell.fontSize}px ${cell.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Save context and clip to cell bounds to prevent text overflow
        ctx.save();
        ctx.beginPath();
        if (cell.borderRadius > 0) {
          ctx.roundRect(x, y, cell.width, cell.height, cell.borderRadius);
        } else {
          ctx.rect(x, y, cell.width, cell.height);
        }
        ctx.clip();

        const htmlContent = cell.htmlContent || cell.text.replace(/\n/g, '<br>');
        // Ensure cell alignment is valid, default to 'left'
        const cellAlignment: 'left' | 'center' | 'right' | 'justify' =
          (cell.textAlign === 'left' || cell.textAlign === 'center' || cell.textAlign === 'right' || cell.textAlign === 'justify')
            ? cell.textAlign
            : 'left';
        const parsedLines = parseHtmlToSegments(htmlContent, cell.fontSize, cellAlignment);
        const maxTextWidth = cell.width - 24; // Comfortable padding (12px on each side)
        const lines = wrapTextSegments(parsedLines, maxTextWidth, ctx, cell);
        const startY = y + 12; // Comfortable top padding with half-leading space

        // Calculate line heights dynamically based on max font size per line
        const lineHeights = lines.map(line => {
          // Check if line is empty (blank line)
          const isEmpty = line.segments.length === 1 && line.segments[0].text === '';
          if (isEmpty) {
            return cell.fontSize * 1.3; // Use base font size for empty lines
          }
          const maxFontSize = line.segments.reduce((max, seg) =>
            Math.max(max, seg.fontSize || cell.fontSize), cell.fontSize);
          return maxFontSize * 1.3; // Slightly more spacing to prevent overlap
        });

        // Calculate cumulative Y positions
        let currentY = startY;

        lines.forEach((line, lineIndex) => {
          const { segments, alignment: lineAlignment } = line;
          // Ensure alignment is valid, default to 'left' if undefined/invalid
          const alignment = (lineAlignment === 'left' || lineAlignment === 'center' || lineAlignment === 'right' || lineAlignment === 'justify')
            ? lineAlignment
            : 'left';

          const totalWidth = segments.reduce((sum, seg) => {
            const segFontSize = seg.fontSize || cell.fontSize;
            const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
            ctx.font = font;
            return sum + ctx.measureText(seg.text).width;
          }, 0);

          let currentX: number;
          if (alignment === 'left') {
            currentX = x + 12;
          } else if (alignment === 'right') {
            currentX = x + cell.width - 12 - totalWidth;
          } else if (alignment === 'center' || alignment === 'justify') {
            // Explicitly only center when alignment is 'center' or 'justify'
            currentX = x + cell.width / 2 - totalWidth / 2;
          } else {
            // Fallback to left (should never reach here due to check above)
            currentX = x + 12;
          }
          segments.forEach(seg => {
            // Skip empty segments (blank lines)
            if (seg.text === '') return;

            const segFontSize = seg.fontSize || cell.fontSize;
            const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
            ctx.font = font;

            // Apply text color from segment or fall back to cell color
            ctx.fillStyle = seg.color || cell.textColor;
            ctx.strokeStyle = seg.color || cell.textColor;

            ctx.fillText(seg.text, currentX, currentY);

            if (cell.underline || seg.isUnderline) {
              const textWidth = ctx.measureText(seg.text).width;
              ctx.beginPath();
              ctx.moveTo(currentX, currentY + segFontSize * 0.15);
              ctx.lineTo(currentX + textWidth, currentY + segFontSize * 0.15);
              ctx.stroke();
            }
            if (cell.strikethrough || seg.isStrikethrough) {
              const textWidth = ctx.measureText(seg.text).width;
              ctx.beginPath();
              ctx.moveTo(currentX, currentY + segFontSize * 0.5);
              ctx.lineTo(currentX + textWidth, currentY + segFontSize * 0.5);
              ctx.stroke();
            }
            currentX += ctx.measureText(seg.text).width;
          });

          // Move to next line
          currentY += lineHeights[lineIndex];
        });

        // Restore context to remove clipping
        ctx.restore();
      }
    });

    const dataUrl = canvas.toDataURL('image/png');
    if (window.electron) {
      await window.electron.exportPdf(dataUrl);
    }
  }, []);

  // Check if user has seen the guide before
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenGuide');
    if (!hasSeenGuide) {
      setShowFirstLaunchGuide(true);
    }
  }, []);

  // Load backup on startup if available
  useEffect(() => {
    const loadBackupOnStartup = async () => {
      if (window.electron) {
        try {
          const backupData = await window.electron.loadBackup();
          if (backupData) {
            const parsed = JSON.parse(backupData);
            const store = useStore.getState();
            store.loadState({
              cells: parsed.cells || [],
              connections: parsed.connections || [],
              canvasBackgroundColor: parsed.canvasBackgroundColor || '#ffffff',
              colorPresets: parsed.colorPresets,
              defaultCellStyle: parsed.defaultCellStyle,
              pinnedLocations: parsed.pinnedLocations || [],
              gridEnabled: parsed.gridEnabled !== undefined ? parsed.gridEnabled : false,
              gridSize: parsed.gridSize || 50,
              gridColor: parsed.gridColor || '#cccccc',
              gridOpacity: parsed.gridOpacity !== undefined ? parsed.gridOpacity : 0.5,
              offsetX: parsed.offsetX !== undefined ? parsed.offsetX : 0,
              offsetY: parsed.offsetY !== undefined ? parsed.offsetY : 0,
              zoom: parsed.zoom || 1,
            });
            // Set window title to indicate recovered work
            await window.electron.setWindowTitle('*Recovered* - Threadsetter');
            console.log('Backup loaded successfully');
          }
        } catch (error) {
          console.error('Failed to load backup:', error);
        }
      }
    };

    loadBackupOnStartup();
  }, []); // Run only once on mount

  useEffect(() => {
    const handleSave = async () => {
      const state = useStore.getState();
      const data = JSON.stringify({
        cells: state.cells,
        connections: state.connections,
        canvasBackgroundColor: state.canvasBackgroundColor,
        colorPresets: state.colorPresets,
        defaultCellStyle: state.defaultCellStyle,
        pinnedLocations: state.pinnedLocations,
      });
      if (window.electron) {
        const filePath = await window.electron.saveFile(data);
        if (filePath) {
          const filename = filePath.split('/').pop() || filePath.split('\\').pop();
          await window.electron.setWindowTitle(`${filename} - Threadsetter`);
        }
      }
    };

    const handleSaveAs = async () => {
      const state = useStore.getState();
      const data = JSON.stringify({
        cells: state.cells,
        connections: state.connections,
        canvasBackgroundColor: state.canvasBackgroundColor,
        colorPresets: state.colorPresets,
        defaultCellStyle: state.defaultCellStyle,
        pinnedLocations: state.pinnedLocations,
      });
      if (window.electron) {
        const filePath = await window.electron.saveFileAs(data);
        if (filePath) {
          const filename = filePath.split('/').pop() || filePath.split('\\').pop();
          await window.electron.setWindowTitle(`${filename} - Threadsetter`);
        }
      }
    };

    const handleNew = async () => {
      if (confirm('Create a new timeline? Unsaved changes will be lost.')) {
        useStore.getState().resetState();
        // Reset window title to default
        if (window.electron) {
          await window.electron.setWindowTitle('Untitled - Threadsetter');
        }
      }
    };

    const handleFileOpened = async (jsonData: string) => {
      try {
        const parsed = JSON.parse(jsonData);
        useStore.getState().loadState(parsed);

        // Update window title with filename
        if (window.electron) {
          const filename = await window.electron.getCurrentFilename();
          if (filename) {
            await window.electron.setWindowTitle(`${filename} - Threadsetter`);
          }
        }
      } catch (error) {
        console.error('Failed to open file:', error);
      }
    };

    const handleExportJson = async () => {
      const state = useStore.getState();
      const data = JSON.stringify(
        {
          cells: state.cells,
          connections: state.connections,
          canvasBackgroundColor: state.canvasBackgroundColor,
          colorPresets: state.colorPresets,
          defaultCellStyle: state.defaultCellStyle,
          pinnedLocations: state.pinnedLocations,
        },
        null,
        2
      );
      if (window.electron) {
        await window.electron.exportJson(data);
      }
    };

    const handleSearch = () => {
      window.dispatchEvent(new CustomEvent('open-search'));
    };

    const handleExportRegion = () => {
      window.dispatchEvent(new CustomEvent('export-region'));
    };

    // Listen for export-region-selected event from Canvas
    const handleExportRegionSelected = (e: Event) => {
      const customEvent = e as CustomEvent<{ minX: number; maxX: number; minY: number; maxY: number }>;
      setExportRegionBounds(customEvent.detail);
      setShowExportRegionDialog(true);
    };

    window.addEventListener('export-region-selected', handleExportRegionSelected);

    if (window.electron) {
      window.electron.onMenuSave(handleSave);
      window.electron.onMenuSaveAs(handleSaveAs);
      window.electron.onMenuNew(handleNew);
      window.electron.onFileOpened(handleFileOpened);
      window.electron.onMenuExportJson(handleExportJson);
      window.electron.onMenuExportPng(handleExportPng);
      window.electron.onMenuExportPdf(handleExportPdf);
      window.electron.onMenuSearch(handleSearch);
      window.electron.onMenuExportRegion(handleExportRegion);
    }

    // Function to save backup
    const saveBackup = async () => {
      const state = useStore.getState();
      const data = JSON.stringify({
        cells: state.cells,
        connections: state.connections,
        canvasBackgroundColor: state.canvasBackgroundColor,
        colorPresets: state.colorPresets,
        defaultCellStyle: state.defaultCellStyle,
        pinnedLocations: state.pinnedLocations,
        gridEnabled: state.gridEnabled,
        gridSize: state.gridSize,
        gridColor: state.gridColor,
        gridOpacity: state.gridOpacity,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        zoom: state.zoom,
      });
      if (window.electron) {
        await window.electron.saveBackup(data);
      }
    };

    // Auto-save every 1 minute (reduced from 3 minutes for better protection)
    const autoSaveInterval = setInterval(saveBackup, 60 * 1000);

    // Save when window loses focus (user switches away)
    const handleWindowBlur = () => {
      saveBackup();
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      clearInterval(autoSaveInterval);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('export-region-selected', handleExportRegionSelected);
    };
  }, []); // Empty dependency array - only run once on mount

  const handleCloseFirstLaunchGuide = () => {
    setShowFirstLaunchGuide(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem('hasSeenGuide', 'true');
  };

  return (
    <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }}>
      <Canvas />
      {showFirstLaunchGuide && (
        <FirstLaunchGuide
          onClose={handleCloseFirstLaunchGuide}
          onDontShowAgain={handleDontShowAgain}
        />
      )}
      {showExportRegionDialog && exportRegionBounds && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 8,
              padding: 24,
              minWidth: 320,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
              Export Region
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: 14 }}>
              Choose export format for the selected region:
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={async () => {
                  await handleExportPng(exportRegionBounds);
                  setShowExportRegionDialog(false);
                  setExportRegionBounds(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Export to PNG
              </button>
              <button
                onClick={async () => {
                  await handleExportPdf(exportRegionBounds);
                  setShowExportRegionDialog(false);
                  setExportRegionBounds(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Export to PDF
              </button>
              <button
                onClick={() => {
                  setShowExportRegionDialog(false);
                  setExportRegionBounds(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
