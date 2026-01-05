import { useEffect, useRef, useState } from 'react';
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
}

function parseHtmlToSegments(html: string, baseFontSize: number): TextSegment[][] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];

  const traverse = (node: Node, inheritedBold = false, inheritedItalic = false, inheritedUnderline = false, inheritedStrikethrough = false, inheritedFontSize?: number) => {
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
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Handle line breaks
      if (tagName === 'br') {
        lines.push([...currentLine]);
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

      // Traverse children
      node.childNodes.forEach(child => traverse(child, isBold, isItalic, isUnderline, isStrikethrough, fontSize));

      // Handle block elements that create new lines
      if (['div', 'p', 'li'].includes(tagName) && currentLine.length > 0) {
        lines.push([...currentLine]);
        currentLine = [];
      }
    }
  };

  traverse(tempDiv);

  // Add any remaining content
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // If no lines, return a single empty line
  if (lines.length === 0) {
    lines.push([{ text: '', isBold: false, isItalic: false, isUnderline: false, isStrikethrough: false }]);
  }

  return lines;
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

    const handleNew = () => {
      if (confirm('Create a new timeline? Unsaved changes will be lost.')) {
        useStore.getState().resetState();
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

    const handleExportPng = async () => {
      if (!canvasContainerRef.current) return;

      const state = useStore.getState();
      const { cells, connections, canvasBackgroundColor } = state;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // If no cells, don't export
      if (cells.length === 0) return;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      cells.forEach((cell) => {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x + cell.width);
        maxY = Math.max(maxY, cell.y + cell.height);
      });

      const padding = 25;
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;

      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = canvasBackgroundColor;
      ctx.fillRect(0, 0, width, height);

      connections.forEach((conn) => {
        const fromCell = cells.find((c) => c.id === conn.fromCellId);
        const toCell = cells.find((c) => c.id === conn.toCellId);
        if (!fromCell || !toCell) return;

        const x1 = fromCell.x - minX + padding + fromCell.width / 2;
        const y1 = fromCell.y - minY + padding + fromCell.height / 2;
        let x2 = toCell.x - minX + padding + toCell.width / 2;
        let y2 = toCell.y - minY + padding + toCell.height / 2;

        // For Arrow style, calculate intersection with destination cell border
        if (conn.style === 'Arrow') {
          const dx = x2 - x1;
          const dy = y2 - y1;

          const cellLeft = toCell.x - minX + padding;
          const cellRight = toCell.x - minX + padding + toCell.width;
          const cellTop = toCell.y - minY + padding;
          const cellBottom = toCell.y - minY + padding + toCell.height;

          const intersections: Array<{ x: number; y: number; dist: number }> = [];

          // Top edge
          if (dy !== 0) {
            const t = (cellTop - y1) / dy;
            if (t > 0 && t <= 1) {
              const ix = x1 + t * dx;
              if (ix >= cellLeft && ix <= cellRight) {
                const dist = Math.sqrt((ix - x1) ** 2 + (cellTop - y1) ** 2);
                intersections.push({ x: ix, y: cellTop, dist });
              }
            }
          }

          // Bottom edge
          if (dy !== 0) {
            const t = (cellBottom - y1) / dy;
            if (t > 0 && t <= 1) {
              const ix = x1 + t * dx;
              if (ix >= cellLeft && ix <= cellRight) {
                const dist = Math.sqrt((ix - x1) ** 2 + (cellBottom - y1) ** 2);
                intersections.push({ x: ix, y: cellBottom, dist });
              }
            }
          }

          // Left edge
          if (dx !== 0) {
            const t = (cellLeft - x1) / dx;
            if (t > 0 && t <= 1) {
              const iy = y1 + t * dy;
              if (iy >= cellTop && iy <= cellBottom) {
                const dist = Math.sqrt((cellLeft - x1) ** 2 + (iy - y1) ** 2);
                intersections.push({ x: cellLeft, y: iy, dist });
              }
            }
          }

          // Right edge
          if (dx !== 0) {
            const t = (cellRight - x1) / dx;
            if (t > 0 && t <= 1) {
              const iy = y1 + t * dy;
              if (iy >= cellTop && iy <= cellBottom) {
                const dist = Math.sqrt((cellRight - x1) ** 2 + (iy - y1) ** 2);
                intersections.push({ x: cellRight, y: iy, dist });
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

        if (conn.style === 'Dotted') {
          ctx.setLineDash([2, 4]);
        } else if (conn.style === 'Dashed') {
          ctx.setLineDash([8, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrow head for Arrow style
        if (conn.style === 'Arrow') {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const arrowSize = 10;
          ctx.fillStyle = conn.color;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - arrowSize * Math.cos(angle - Math.PI / 6),
            y2 - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - arrowSize * Math.cos(angle + Math.PI / 6),
            y2 - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      });

      cells.forEach((cell) => {
        const x = cell.x - minX + padding;
        const y = cell.y - minY + padding;

        if (cell.isTimeline && cell.timelineConfig) {
          // Render timeline cell
          const config = cell.timelineConfig;
          const numbers: number[] = [];
          const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
          const display = config.displayInterval || 1;

          // When reverse is checked, start from the higher number and go down
          let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
          const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
          const startForModulo = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

          if (config.reverse) {
            while (current >= end) {
              if ((startForModulo - current) % display === 0) {
                numbers.push(current);
              }
              current -= step;
            }
          } else {
            while (current <= end) {
              if ((current - startForModulo) % display === 0) {
                numbers.push(current);
              }
              current += step;
            }
          }

          const isHorizontal = config.orientation === 'Horizontal';
          const itemWidth = isHorizontal ? 60 : 40;
          const itemHeight = isHorizontal ? 40 : 60;

          // Background
          ctx.fillStyle = cell.backgroundColor;
          ctx.fillRect(x, y, cell.width, cell.height);

          // Numbers
          ctx.fillStyle = cell.textColor;
          ctx.font = `${cell.fontSize}px ${cell.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          numbers.forEach((num, index) => {
            const itemX = isHorizontal ? x + index * itemWidth : x;
            const itemY = isHorizontal ? y : y + index * itemHeight;
            const drawWidth = isHorizontal ? itemWidth : cell.width;
            const drawHeight = isHorizontal ? cell.height : itemHeight;

            // Draw number
            ctx.fillText(String(num), itemX + drawWidth / 2, itemY + drawHeight / 2);

            // Draw divider lines
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
          // Render regular cell
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

          ctx.fillStyle = cell.textColor;
          ctx.font = `${cell.italic ? 'italic ' : ''}${cell.bold ? 'bold ' : ''}${cell.fontSize}px ${cell.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Parse HTML content or fall back to plain text
          const htmlContent = cell.htmlContent || cell.text.replace(/\n/g, '<br>');
          const lines = parseHtmlToSegments(htmlContent, cell.fontSize);
          const lineHeight = cell.fontSize * 1.5;
          const totalTextHeight = lines.length * lineHeight;
          const startY = y + cell.height / 2 - totalTextHeight / 2 + lineHeight / 2;

          lines.forEach((segments, lineIndex) => {
            // Calculate total width for centering
            const totalWidth = segments.reduce((sum, seg) => {
              const segFontSize = seg.fontSize || cell.fontSize;
              const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
              ctx.font = font;
              return sum + ctx.measureText(seg.text).width;
            }, 0);

            // Draw segments
            let currentX = x + cell.width / 2 - totalWidth / 2;
            segments.forEach(seg => {
              const segFontSize = seg.fontSize || cell.fontSize;
              const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
              ctx.font = font;

              const textY = startY + lineIndex * lineHeight;
              ctx.fillText(seg.text, currentX, textY);

              // Draw underline
              if (cell.underline || seg.isUnderline) {
                const textWidth = ctx.measureText(seg.text).width;
                ctx.beginPath();
                ctx.moveTo(currentX, textY + segFontSize * 0.1);
                ctx.lineTo(currentX + textWidth, textY + segFontSize * 0.1);
                ctx.stroke();
              }

              // Draw strikethrough
              if (cell.strikethrough || seg.isStrikethrough) {
                const textWidth = ctx.measureText(seg.text).width;
                ctx.beginPath();
                ctx.moveTo(currentX, textY - segFontSize * 0.2);
                ctx.lineTo(currentX + textWidth, textY - segFontSize * 0.2);
                ctx.stroke();
              }

              currentX += ctx.measureText(seg.text).width;
            });
          });
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      if (window.electron) {
        await window.electron.exportPng(dataUrl);
      }
    };

    const handleExportPdf = async () => {
      // Reuse the same canvas rendering as PNG
      if (!canvasContainerRef.current) return;

      const state = useStore.getState();
      const { cells, connections, canvasBackgroundColor } = state;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (cells.length === 0) return;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      cells.forEach((cell) => {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x + cell.width);
        maxY = Math.max(maxY, cell.y + cell.height);
      });

      const padding = 25;
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;

      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = canvasBackgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw connections (same as PNG export)
      connections.forEach((conn) => {
        const fromCell = cells.find((c) => c.id === conn.fromCellId);
        const toCell = cells.find((c) => c.id === conn.toCellId);
        if (!fromCell || !toCell) return;

        const x1 = fromCell.x - minX + padding + fromCell.width / 2;
        const y1 = fromCell.y - minY + padding + fromCell.height / 2;
        let x2 = toCell.x - minX + padding + toCell.width / 2;
        let y2 = toCell.y - minY + padding + toCell.height / 2;

        // For Arrow style, calculate intersection with destination cell border
        if (conn.style === 'Arrow') {
          const dx = x2 - x1;
          const dy = y2 - y1;

          const cellLeft = toCell.x - minX + padding;
          const cellRight = toCell.x - minX + padding + toCell.width;
          const cellTop = toCell.y - minY + padding;
          const cellBottom = toCell.y - minY + padding + toCell.height;

          const intersections: Array<{ x: number; y: number; dist: number }> = [];

          // Top edge
          if (dy !== 0) {
            const t = (cellTop - y1) / dy;
            if (t > 0 && t <= 1) {
              const ix = x1 + t * dx;
              if (ix >= cellLeft && ix <= cellRight) {
                const dist = Math.sqrt((ix - x1) ** 2 + (cellTop - y1) ** 2);
                intersections.push({ x: ix, y: cellTop, dist });
              }
            }
          }

          // Bottom edge
          if (dy !== 0) {
            const t = (cellBottom - y1) / dy;
            if (t > 0 && t <= 1) {
              const ix = x1 + t * dx;
              if (ix >= cellLeft && ix <= cellRight) {
                const dist = Math.sqrt((ix - x1) ** 2 + (cellBottom - y1) ** 2);
                intersections.push({ x: ix, y: cellBottom, dist });
              }
            }
          }

          // Left edge
          if (dx !== 0) {
            const t = (cellLeft - x1) / dx;
            if (t > 0 && t <= 1) {
              const iy = y1 + t * dy;
              if (iy >= cellTop && iy <= cellBottom) {
                const dist = Math.sqrt((cellLeft - x1) ** 2 + (iy - y1) ** 2);
                intersections.push({ x: cellLeft, y: iy, dist });
              }
            }
          }

          // Right edge
          if (dx !== 0) {
            const t = (cellRight - x1) / dx;
            if (t > 0 && t <= 1) {
              const iy = y1 + t * dy;
              if (iy >= cellTop && iy <= cellBottom) {
                const dist = Math.sqrt((cellRight - x1) ** 2 + (iy - y1) ** 2);
                intersections.push({ x: cellRight, y: iy, dist });
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

        if (conn.style === 'Dotted') {
          ctx.setLineDash([2, 4]);
        } else if (conn.style === 'Dashed') {
          ctx.setLineDash([8, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrow head for Arrow style
        if (conn.style === 'Arrow') {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const arrowSize = 10;
          ctx.fillStyle = conn.color;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - arrowSize * Math.cos(angle - Math.PI / 6),
            y2 - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - arrowSize * Math.cos(angle + Math.PI / 6),
            y2 - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      });

      // Draw cells (same as PNG export - includes timeline rendering)
      cells.forEach((cell) => {
        const x = cell.x - minX + padding;
        const y = cell.y - minY + padding;

        if (cell.isTimeline && cell.timelineConfig) {
          const config = cell.timelineConfig;
          const numbers: number[] = [];
          const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
          const display = config.displayInterval || 1;

          // When reverse is checked, start from the higher number and go down
          let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
          const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
          const startForModulo = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;

          if (config.reverse) {
            while (current >= end) {
              if ((startForModulo - current) % display === 0) {
                numbers.push(current);
              }
              current -= step;
            }
          } else {
            while (current <= end) {
              if ((current - startForModulo) % display === 0) {
                numbers.push(current);
              }
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

          ctx.fillStyle = cell.textColor;
          ctx.font = `${cell.italic ? 'italic ' : ''}${cell.bold ? 'bold ' : ''}${cell.fontSize}px ${cell.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Parse HTML content or fall back to plain text
          const htmlContent = cell.htmlContent || cell.text.replace(/\n/g, '<br>');
          const lines = parseHtmlToSegments(htmlContent, cell.fontSize);
          const lineHeight = cell.fontSize * 1.5;
          const totalTextHeight = lines.length * lineHeight;
          const startY = y + cell.height / 2 - totalTextHeight / 2 + lineHeight / 2;

          lines.forEach((segments, lineIndex) => {
            // Calculate total width for centering
            const totalWidth = segments.reduce((sum, seg) => {
              const segFontSize = seg.fontSize || cell.fontSize;
              const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
              ctx.font = font;
              return sum + ctx.measureText(seg.text).width;
            }, 0);

            // Draw segments
            let currentX = x + cell.width / 2 - totalWidth / 2;
            segments.forEach(seg => {
              const segFontSize = seg.fontSize || cell.fontSize;
              const font = `${cell.italic || seg.isItalic ? 'italic ' : ''}${seg.isBold || cell.bold ? 'bold ' : ''}${segFontSize}px ${cell.fontFamily}`;
              ctx.font = font;

              const textY = startY + lineIndex * lineHeight;
              ctx.fillText(seg.text, currentX, textY);

              // Draw underline
              if (cell.underline || seg.isUnderline) {
                const textWidth = ctx.measureText(seg.text).width;
                ctx.beginPath();
                ctx.moveTo(currentX, textY + segFontSize * 0.1);
                ctx.lineTo(currentX + textWidth, textY + segFontSize * 0.1);
                ctx.stroke();
              }

              // Draw strikethrough
              if (cell.strikethrough || seg.isStrikethrough) {
                const textWidth = ctx.measureText(seg.text).width;
                ctx.beginPath();
                ctx.moveTo(currentX, textY - segFontSize * 0.2);
                ctx.lineTo(currentX + textWidth, textY - segFontSize * 0.2);
                ctx.stroke();
              }

              currentX += ctx.measureText(seg.text).width;
            });
          });
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      if (window.electron) {
        await window.electron.exportPdf(dataUrl);
      }
    };

    const handleSearch = () => {
      window.dispatchEvent(new CustomEvent('open-search'));
    };

    if (window.electron) {
      window.electron.onMenuSave(handleSave);
      window.electron.onMenuSaveAs(handleSaveAs);
      window.electron.onMenuNew(handleNew);
      window.electron.onFileOpened(handleFileOpened);
      window.electron.onMenuExportJson(handleExportJson);
      window.electron.onMenuExportPng(handleExportPng);
      window.electron.onMenuExportPdf(handleExportPdf);
      window.electron.onMenuSearch(handleSearch);
    }

    // Auto-save every 3 minutes
    const autoSaveInterval = setInterval(async () => {
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
    }, 3 * 60 * 1000);

    return () => {
      clearInterval(autoSaveInterval);
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
    </div>
  );
}

export default App;
