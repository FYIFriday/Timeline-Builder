import { useState, useRef, useEffect, useCallback } from 'react';
import { Cell, TimelineConfig, Connection } from '../types';
import { useStore } from '../store';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import ImageCellComponent from './ImageCellComponent';

interface CellComponentProps {
  cell: Cell;
  isSelected: boolean;
}

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

// Parse text for markdown-style formatting: **bold**, *italic*, __underline__, ~~strikethrough~~
function renderFormattedText(text: string) {
  // Must check ** before * to avoid conflicts
  const regex = /(\*\*.*?\*\*|\*.*?\*|__.*?__|~~.*?~~)/g;
  const parts = text.split(regex).filter(part => part !== '');

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    } else if (part.startsWith('__') && part.endsWith('__')) {
      return <u key={index}>{part.slice(2, -2)}</u>;
    } else if (part.startsWith('~~') && part.endsWith('~~')) {
      return <s key={index}>{part.slice(2, -2)}</s>;
    }
    return part;
  });
}

// Convert markdown text to HTML
function markdownToHtml(text: string): string {
  let html = text;
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Underline
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');
  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Strip HTML tags to get plain text
function htmlToPlainText(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

function CellComponent({ cell, isSelected }: CellComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState(cell.fontSize);
  const [fontSizeInput, setFontSizeInput] = useState(cell.fontSize.toString());
  const [currentAlignment, setCurrentAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('center');
  const editableRef = useRef<HTMLDivElement>(null);
  const fontSizeInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [isHoveringForConnection, setIsHoveringForConnection] = useState(false);
  const [connectionTargetId, setConnectionTargetId] = useState<string | null>(null);
  const [connectionTargetPinIndex, setConnectionTargetPinIndex] = useState<number | undefined>(undefined);
  const [connectionFromPinIndex, setConnectionFromPinIndex] = useState<number | undefined>(undefined);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightColorPicker, setShowHighlightColorPicker] = useState(false);
  const [showTextCustomPicker, setShowTextCustomPicker] = useState(false);
  const [showHighlightCustomPicker, setShowHighlightCustomPicker] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#000000');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('#ffff00');

  // Use refs to avoid stale closures in event handlers
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const resizeDirectionRef = useRef<ResizeDirection>(null);
  const allCellsResizeStartRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const hasDraggedRef = useRef(false); // Track if actual dragging occurred

  const {
    updateCell,
    setSelectedCells,
    addSelectedCell,
    selectedCellIds,
    zoom,
    offsetX,
    offsetY,
    saveHistory,
    addConnection,
    cells,
    defaultCellStyle,
    colorPresets,
  } = useStore();

  useEffect(() => {
    if (isEditing && editableRef.current) {
      // Listen for selection changes to update font size display and alignment
      const handleSelectionChange = () => {
        if (document.activeElement === editableRef.current || editableRef.current?.contains(document.activeElement)) {
          const detectedSize = getSelectionFontSize();
          setFontSizeInput(detectedSize);

          const detectedAlignment = getCurrentAlignment();
          if (detectedAlignment) {
            setCurrentAlignment(detectedAlignment);
          }
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }
  }, [isEditing]);

  // Set initial content and select all when first entering edit mode
  useEffect(() => {
    if (isEditing && editableRef.current) {
      // Set the initial HTML content
      editableRef.current.innerHTML = editHtml;
      editableRef.current.focus();

      // Select all content
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editableRef.current);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]); // Only run when isEditing changes, not when editHtml changes

  const handleCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If we just finished dragging, don't change selection
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    if (e.shiftKey) {
      addSelectedCell(cell.id);
    } else if (cell.groupId) {
      // If this cell is grouped, handle group selection
      const groupedCells = cells.filter(c => c.groupId === cell.groupId);
      const groupedCellIds = groupedCells.map(c => c.id);

      // Check if all cells in the group are already selected
      const allGroupSelected = groupedCellIds.every(id => selectedCellIds.includes(id));

      if (allGroupSelected && groupedCellIds.length === selectedCellIds.length) {
        // If all group cells are selected and nothing else, select just this cell
        setSelectedCells([cell.id]);
      } else {
        // Otherwise, select all cells in the group
        setSelectedCells(groupedCellIds);
      }
    } else {
      setSelectedCells([cell.id]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // If editing, don't handle context menu - let it bubble to Canvas
    // which will check for contentEditable and show native menu
    if (isEditing) {
      return;
    }

    // Select the cell when right-clicking, but don't stop propagation
    // so the canvas can show the context menu
    if (!selectedCellIds.includes(cell.id)) {
      if (cell.groupId) {
        // If this cell is grouped, select all cells in the group
        const groupedCells = cells.filter(c => c.groupId === cell.groupId);
        const groupedCellIds = groupedCells.map(c => c.id);
        setSelectedCells(groupedCellIds);
      } else {
        setSelectedCells([cell.id]);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Initialize HTML content from markdown text if it doesn't exist
    if (!cell.htmlContent && cell.text) {
      setEditHtml(markdownToHtml(cell.text));
    } else {
      setEditHtml(cell.htmlContent || '');
    }
    setIsEditing(true);
  };

  const handleContentInput = () => {
    // Don't update state on input to prevent cursor jumping
    // The content will be read from the ref on blur
  };

  const getSelectionFontSize = (): string => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editableRef.current) {
      return currentFontSize.toString();
    }

    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      return currentFontSize.toString();
    }

    // Get all nodes in the selection
    const container = range.commonAncestorContainer;
    const nodes: Node[] = [];

    const collectNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        nodes.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        node.childNodes.forEach(collectNodes);
      }
    };

    if (container.nodeType === Node.TEXT_NODE) {
      nodes.push(container);
    } else {
      collectNodes(container);
    }

    // Check font sizes of all text nodes
    const sizes = new Set<string>();
    nodes.forEach(node => {
      let element = node.parentElement;
      while (element && element !== editableRef.current) {
        const fontSize = window.getComputedStyle(element).fontSize;
        if (fontSize) {
          sizes.add(fontSize);
          break;
        }
        element = element.parentElement;
      }
    });

    if (sizes.size === 0) {
      return currentFontSize.toString();
    } else if (sizes.size > 1) {
      return ''; // Mixed sizes
    } else {
      const fontSize = Array.from(sizes)[0];
      return fontSize.replace('px', '');
    }
  };

  const applyTypedFontSize = () => {
    const size = parseInt(fontSizeInput);
    if (isNaN(size) || size < 8 || size > 72) {
      setFontSizeInput(currentFontSize.toString());
      return;
    }

    if (!editableRef.current) return;

    // Restore the saved selection
    const sel = window.getSelection();
    if (!sel) return;

    if (savedSelectionRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current.cloneRange());
      } catch (e) {
        console.error('Failed to restore selection:', e);
        return;
      }
    }

    if (sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText.length > 0) {
      // Create a wrapper to contain the selection
      const wrapper = document.createElement('span');
      wrapper.className = 'temp-size-marker';

      try {
        range.surroundContents(wrapper);
      } catch (e) {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }

      // Apply the uniform size to all text within the wrapper
      const applyUniformSize = (element: HTMLElement) => {
        // Remove any existing font-size styling on child elements
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_ELEMENT,
          null
        );

        const elements: HTMLElement[] = [element];
        let node;
        while (node = walker.nextNode()) {
          elements.push(node as HTMLElement);
        }

        elements.forEach(el => {
          if (el.style.fontSize) {
            el.style.fontSize = '';
          }
        });
      };

      applyUniformSize(wrapper);

      // Set the uniform font size on the wrapper
      wrapper.style.fontSize = `${size}px`;
      wrapper.classList.remove('temp-size-marker');

      // Unwrap if it's just a simple wrapper, otherwise keep it
      setTimeout(() => {
        try {
          const newRange = document.createRange();
          newRange.selectNodeContents(wrapper);
          sel.removeAllRanges();
          sel.addRange(newRange);
          editableRef.current?.focus();
        } catch (e) {
          editableRef.current?.focus();
        }
      }, 0);
    }

    setCurrentFontSize(size);
    setFontSizeInput(size.toString());
  };

  const handleContentBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Check if focus is moving to the toolbar or font size input
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && (
      relatedTarget === fontSizeInputRef.current ||
      relatedTarget.closest('[data-formatting-toolbar]')
    )) {
      // Don't close edit mode if clicking within toolbar
      return;
    }

    setIsEditing(false);

    if (!editableRef.current) return;

    const htmlContent = editableRef.current.innerHTML;
    const plainText = htmlToPlainText(htmlContent);

    // Auto-delete if cell is completely empty
    if (plainText.trim() === '') {
      const { deleteCells } = useStore.getState();
      deleteCells([cell.id]);
      return;
    }

    // Only auto-resize if the cell hasn't been manually resized
    if (!cell.manuallyResized) {
      // Create a temporary div to measure content height
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.width = `${cell.width}px`; // Use current cell width to calculate wrapped height
      tempDiv.style.height = 'auto';
      tempDiv.style.whiteSpace = 'pre-wrap';
      tempDiv.style.wordBreak = 'break-word';
      tempDiv.style.fontFamily = cell.fontFamily;
      tempDiv.style.fontSize = `${cell.fontSize}px`;
      tempDiv.style.padding = '12px';
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      const newHeight = Math.max(30, tempDiv.scrollHeight + 24);

      document.body.removeChild(tempDiv);

      updateCell(cell.id, {
        text: plainText,
        htmlContent: htmlContent,
        height: newHeight
      });
    } else {
      // Just update the content, keep the size
      updateCell(cell.id, {
        text: plainText,
        htmlContent: htmlContent
      });
    }

    saveHistory();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    const pasteWithoutFormatting = e.shiftKey && cmdOrCtrl;

    e.preventDefault();

    const clipboardData = e.clipboardData;
    let pastedContent = '';

    if (pasteWithoutFormatting) {
      // Paste as plain text only
      pastedContent = clipboardData.getData('text/plain');
    } else {
      // Try to get HTML first
      let html = clipboardData.getData('text/html');

      if (html) {
        // Create a temporary div to parse the HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Function to recursively extract text with inline formatting only
        const extractFormattedText = (node: Node): string => {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();

            // Skip these elements entirely (including their content)
            if (['style', 'script', 'meta', 'link'].includes(tagName)) {
              return '';
            }

            // Preserve these inline formatting tags
            if (['b', 'strong', 'i', 'em', 'u', 'span', 'mark'].includes(tagName)) {
              let content = '';
              for (let i = 0; i < element.childNodes.length; i++) {
                content += extractFormattedText(element.childNodes[i]);
              }

              // Only wrap in tag if there's actual content
              if (content.trim()) {
                // Normalize tags: strong->b, em->i
                let normalizedTag = tagName;
                if (tagName === 'strong') normalizedTag = 'b';
                if (tagName === 'em') normalizedTag = 'i';
                if (tagName === 'mark') normalizedTag = 'mark';

                // For span, just return content without wrapper
                if (tagName === 'span') {
                  return content;
                }

                return `<${normalizedTag}>${content}</${normalizedTag}>`;
              }
              return content;
            }

            // For block elements or line breaks, just get text
            if (['br'].includes(tagName)) {
              return '\n';
            }

            // For all other elements (div, p, etc), just extract text recursively
            let content = '';
            for (let i = 0; i < element.childNodes.length; i++) {
              content += extractFormattedText(element.childNodes[i]);
            }
            return content;
          }

          return '';
        };

        // Extract the formatted text
        let extracted = extractFormattedText(temp);

        // Trim and normalize whitespace
        extracted = extracted.trim();

        // Replace multiple newlines with a single space (since we're in inline content)
        extracted = extracted.replace(/\n+/g, ' ');

        // Replace multiple spaces with single space
        extracted = extracted.replace(/\s+/g, ' ');

        pastedContent = extracted;
      } else {
        // Fallback to plain text
        pastedContent = clipboardData.getData('text/plain');
      }
    }

    // Insert the cleaned content at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      if (pasteWithoutFormatting) {
        // Insert as plain text
        const textNode = document.createTextNode(pastedContent);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
      } else {
        // Insert as HTML
        const fragment = range.createContextualFragment(pastedContent);
        const lastNode = fragment.lastChild;
        range.insertNode(fragment);

        // Position cursor after the inserted content
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.setEndAfter(lastNode);
        }
      }

      // Collapse the range to a cursor (no selection)
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Trigger input event to save changes
      if (editableRef.current) {
        setEditHtml(editableRef.current.innerHTML);
      }
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      // Reset content
      if (cell.htmlContent) {
        setEditHtml(cell.htmlContent);
      } else {
        setEditHtml(markdownToHtml(cell.text));
      }
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Select All - manually select all content in the contentEditable
    if (cmdOrCtrl && e.key === 'a') {
      e.preventDefault();
      e.stopPropagation();
      if (editableRef.current) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editableRef.current);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      return;
    }

    // Format shortcuts
    if (cmdOrCtrl && e.key === 'b') {
      e.preventDefault();
      applyFormat('bold');
    } else if (cmdOrCtrl && e.key === 'i') {
      e.preventDefault();
      applyFormat('italic');
    } else if (cmdOrCtrl && e.key === 'u') {
      e.preventDefault();
      applyFormat('underline');
    } else if (cmdOrCtrl && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      applyFormat('strikeThrough');
    } else if (cmdOrCtrl && (e.key === '+' || e.key === '=')) {
      // Increase font size (+ or = key, since + requires shift)
      e.preventDefault();
      changeFontSize(2);
    } else if (cmdOrCtrl && (e.key === '-' || e.key === '_')) {
      // Decrease font size
      e.preventDefault();
      changeFontSize(-2);
    }
  };

  const applyFormat = (command: string) => {
    if (!editableRef.current) return;
    editableRef.current.focus();
    document.execCommand(command, false);
  };

  const applyTextColor = (color: string) => {
    if (!editableRef.current) return;
    editableRef.current.focus();

    // Restore saved selection if it exists
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    }

    document.execCommand('foreColor', false, color);

    // Update the HTML state
    setEditHtml(editableRef.current.innerHTML);
  };

  const applyBackgroundColor = (color: string) => {
    if (!editableRef.current) return;
    editableRef.current.focus();

    // Restore saved selection if it exists
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    }

    // Use hiliteColor for better browser compatibility
    // Try both commands as different browsers support different ones
    try {
      document.execCommand('hiliteColor', false, color);
    } catch (e) {
      document.execCommand('backColor', false, color);
    }

    // Update the HTML state
    setEditHtml(editableRef.current.innerHTML);
  };

  const applyAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (!editableRef.current) return;
    editableRef.current.focus();

    const commandMap = {
      'left': 'justifyLeft',
      'center': 'justifyCenter',
      'right': 'justifyRight',
      'justify': 'justifyFull'
    };

    document.execCommand(commandMap[alignment], false);
  };

  const getCurrentAlignment = (): 'left' | 'center' | 'right' | 'justify' | null => {
    if (!editableRef.current || !isEditing) return cell.textAlign || 'center';

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return cell.textAlign || 'center';

    // Get the element at the current selection
    let node = sel.anchorNode;
    if (!node) return cell.textAlign || 'center';

    // If it's a text node, get its parent element
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;

    // Walk up to find an element with text-align or alignment attribute
    while (element && element !== editableRef.current) {
      const textAlign = window.getComputedStyle(element).textAlign;
      const align = element.getAttribute('align');

      if (align) {
        if (align === 'left') return 'left';
        if (align === 'center') return 'center';
        if (align === 'right') return 'right';
        if (align === 'justify') return 'justify';
      }

      if (textAlign && textAlign !== 'start') {
        if (textAlign === 'left') return 'left';
        if (textAlign === 'center') return 'center';
        if (textAlign === 'right') return 'right';
        if (textAlign === 'justify') return 'justify';
      }

      element = element.parentElement;
    }

    return cell.textAlign || 'center';
  };

  const changeFontSize = (delta: number) => {
    if (!editableRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText.length === 0) return;

    // Create a wrapper span to mark our selection
    const wrapper = document.createElement('span');
    wrapper.className = 'temp-size-adjustment';

    try {
      // Try to wrap the selection
      range.surroundContents(wrapper);
    } catch (e) {
      // If that fails, extract and wrap
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
    }

    // Now find all text-containing elements within the wrapper and adjust their sizes
    const adjustElement = (element: HTMLElement) => {
      // Get computed style before making changes
      const computedSize = window.getComputedStyle(element).fontSize;
      const currentSize = parseInt(computedSize);
      const newSize = Math.max(8, Math.min(72, currentSize + delta));

      // If this element has text children, wrap them or adjust the element
      if (element.childNodes.length > 0) {
        Array.from(element.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            // Text node - get its current size and wrap in span
            const textComputedSize = window.getComputedStyle(element).fontSize;
            const textCurrentSize = parseInt(textComputedSize);
            const textNewSize = Math.max(8, Math.min(72, textCurrentSize + delta));

            const span = document.createElement('span');
            span.style.fontSize = `${textNewSize}px`;
            span.textContent = child.textContent;
            child.replaceWith(span);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            adjustElement(child as HTMLElement);
          }
        });
      }

      // Also set size on the element itself if it has inline font-size
      if (element.style.fontSize) {
        element.style.fontSize = `${newSize}px`;
      }
    };

    // Adjust all elements in the wrapper
    adjustElement(wrapper);

    // Unwrap the temp wrapper but keep its contents
    const parent = wrapper.parentNode;
    if (parent) {
      const children = Array.from(wrapper.childNodes);
      children.forEach(child => {
        parent.insertBefore(child, wrapper);
      });
      parent.removeChild(wrapper);

      // Re-select the modified content
      setTimeout(() => {
        try {
          if (children.length > 0) {
            const newRange = document.createRange();
            newRange.setStartBefore(children[0]);
            newRange.setEndAfter(children[children.length - 1]);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
          editableRef.current?.focus();

          // Update the font size display
          const detectedSize = getSelectionFontSize();
          setFontSizeInput(detectedSize);
        } catch (e) {
          editableRef.current?.focus();
        }
      }, 0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      // Reset drag flag at start of mouse interaction
      hasDraggedRef.current = false;

      // Ctrl/Cmd+drag to create connection
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isConnectionModifier = isMac ? e.metaKey : e.ctrlKey;

      if (isConnectionModifier) {
        e.preventDefault();

        // Check if clicking on a timeline pin
        if (cell.isTimeline) {
          const target = e.target as HTMLElement;
          const pinElement = target.closest('[data-pin-index]');
          if (pinElement) {
            const pinIndex = pinElement.getAttribute('data-pin-index');
            if (pinIndex !== null) {
              setConnectionFromPinIndex(parseInt(pinIndex));
            }
          }
        }

        setIsConnecting(true);
        setConnectionEnd({ x: e.clientX, y: e.clientY });
      } else {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;

      // Mark that actual dragging occurred
      if (dx !== 0 || dy !== 0) {
        hasDraggedRef.current = true;
      }

      selectedCellIds.forEach((id) => {
        const targetCell = useStore.getState().cells.find((c) => c.id === id);
        if (targetCell) {
          updateCell(id, {
            x: targetCell.x + dx,
            y: targetCell.y + dy,
          });
        }
      });

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (isResizing) {
      const dx = (e.clientX - resizeStartRef.current.x) / zoom;
      const dy = (e.clientY - resizeStartRef.current.y) / zoom;
      const dir = resizeDirectionRef.current;

      let newX = resizeStartRef.current.cellX;
      let newY = resizeStartRef.current.cellY;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Handle horizontal resizing
      if (dir?.includes('e')) {
        newWidth = Math.max(50, resizeStartRef.current.width + dx);
      } else if (dir?.includes('w')) {
        const widthChange = -dx;
        newWidth = Math.max(50, resizeStartRef.current.width + widthChange);
        newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      }

      // Handle vertical resizing
      if (dir?.includes('s')) {
        newHeight = Math.max(30, resizeStartRef.current.height + dy);
      } else if (dir?.includes('n')) {
        const heightChange = -dy;
        newHeight = Math.max(30, resizeStartRef.current.height + heightChange);
        newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
      }

      // Calculate scale factors
      const widthScale = newWidth / resizeStartRef.current.width;
      const heightScale = newHeight / resizeStartRef.current.height;

      // Update the current cell
      updateCell(cell.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

      // Apply proportional scaling to all other selected cells
      selectedCellIds.forEach((id) => {
        if (id !== cell.id) {
          const initialDims = allCellsResizeStartRef.current.get(id);
          if (initialDims) {
            let otherNewWidth = initialDims.width * widthScale;
            let otherNewHeight = initialDims.height * heightScale;
            let otherNewX = initialDims.x;
            let otherNewY = initialDims.y;

            // Adjust position for west/north directions
            if (dir?.includes('w')) {
              otherNewX = initialDims.x + (initialDims.width - otherNewWidth);
            }
            if (dir?.includes('n')) {
              otherNewY = initialDims.y + (initialDims.height - otherNewHeight);
            }

            updateCell(id, {
              x: otherNewX,
              y: otherNewY,
              width: Math.max(50, otherNewWidth),
              height: Math.max(30, otherNewHeight),
            });
          }
        }
      });
    } else if (isConnecting) {
      setConnectionEnd({ x: e.clientX, y: e.clientY });

      // Find which cell is under the cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);

      // Check if hovering over a timeline pin
      const pinElement = element?.closest('[data-pin-index]');
      const cellElement = element?.closest('[data-cell-id]');

      if (cellElement) {
        const targetId = cellElement.getAttribute('data-cell-id');
        if (targetId && targetId !== cell.id) {
          setConnectionTargetId(targetId);

          // If it's a timeline cell, get the pin index
          if (pinElement) {
            const pinIndex = pinElement.getAttribute('data-pin-index');
            if (pinIndex !== null) {
              setConnectionTargetPinIndex(parseInt(pinIndex));
            }
          } else {
            setConnectionTargetPinIndex(undefined);
          }

          setIsHoveringForConnection(true);
        } else {
          setConnectionTargetId(null);
          setConnectionTargetPinIndex(undefined);
          setIsHoveringForConnection(false);
        }
      } else {
        setConnectionTargetId(null);
        setConnectionTargetPinIndex(undefined);
        setIsHoveringForConnection(false);
      }
    }
  }, [isDragging, isResizing, isConnecting, zoom, offsetX, offsetY, selectedCellIds, updateCell, cell.id]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      saveHistory();
    }
    if (isResizing) {
      // Mark all selected cells as manually resized
      selectedCellIds.forEach((id) => {
        updateCell(id, { manuallyResized: true });
      });
    }
    if (isConnecting) {
      // Create connection if we have a target
      if (connectionTargetId && connectionTargetId !== cell.id) {
        const newConnection = {
          id: `conn-${Date.now()}`,
          fromCellId: cell.id,
          toCellId: connectionTargetId,
          color: defaultCellStyle.defaultConnectionColor,
          style: defaultCellStyle.defaultConnectionStyle,
          strokeWidth: defaultCellStyle.defaultConnectionThickness,
          fromPinIndex: connectionFromPinIndex,
          toPinIndex: connectionTargetPinIndex,
        };
        addConnection(newConnection);
        saveHistory();
      }
      setIsConnecting(false);
      setIsHoveringForConnection(false);
      setConnectionTargetId(null);
      setConnectionTargetPinIndex(undefined);
      setConnectionFromPinIndex(undefined);
    }
    setIsDragging(false);
    setIsResizing(false);
  }, [isDragging, isResizing, isConnecting, connectionTargetId, connectionTargetPinIndex, connectionFromPinIndex, cell.id, addConnection, saveHistory, updateCell, defaultCellStyle]);

  const handleMouseEnterForConnection = (targetCellId: string) => {
    if (isConnecting && targetCellId !== cell.id) {
      setIsHoveringForConnection(true);
      setConnectionTargetId(targetCellId);
    }
  };

  const handleMouseLeaveForConnection = () => {
    setIsHoveringForConnection(false);
    setConnectionTargetId(null);
  };

  useEffect(() => {
    if (isDragging || isResizing || isConnecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isConnecting, handleMouseMove, handleMouseUp]);

  const handleResizeMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: cell.width,
      height: cell.height,
      cellX: cell.x,
      cellY: cell.y,
    };
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: cell.width,
      height: cell.height,
      cellX: cell.x,
      cellY: cell.y,
    });

    // Store initial dimensions of all selected cells for multi-cell resizing
    const initialDimensions = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectedCellIds.forEach((id) => {
      const targetCell = cells.find((c) => c.id === id);
      if (targetCell) {
        initialDimensions.set(id, {
          x: targetCell.x,
          y: targetCell.y,
          width: targetCell.width,
          height: targetCell.height,
        });
      }
    });
    allCellsResizeStartRef.current = initialDimensions;
  };

  const fontStyle = {
    fontFamily: cell.fontFamily,
    fontSize: `${cell.fontSize}px`,
    fontWeight: cell.bold ? 'bold' : 'normal',
    fontStyle: cell.italic ? 'italic' : 'normal',
    textDecoration: `${cell.underline ? 'underline' : ''} ${cell.strikethrough ? 'line-through' : ''}`.trim(),
  };

  // Render image cell
  if (cell.isImage && cell.imageData) {
    return (
      <ImageCellComponent
        cell={cell}
        isSelected={isSelected}
        onCellClick={handleCellClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        isDragging={isDragging}
        zoom={zoom}
      />
    );
  }

  // Render connection dot
  if (cell.isDot) {
    const dotShape = cell.dotShape || 'circle';
    const getBorderRadius = () => {
      if (dotShape === 'circle') return '50%';
      if (dotShape === 'square') return '0';
      return '0'; // diamond also uses 0, but we'll handle it with transform
    };

    const getTransform = () => {
      if (dotShape === 'diamond') {
        return 'rotate(45deg)';
      }
      return undefined;
    };

    return (
      <div
        data-cell-id={cell.id}
        onClick={handleCellClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => handleMouseEnterForConnection(cell.id)}
        onMouseLeave={handleMouseLeaveForConnection}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
          backgroundColor: cell.backgroundColor,
          border: isSelected
            ? '2px solid #3b82f6'
            : isHoveringForConnection
            ? '2px solid #10b981'
            : 'none',
          borderRadius: getBorderRadius(),
          transform: getTransform(),
          cursor: isConnecting ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: 10,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  if (cell.isTimeline && cell.timelineConfig) {
    return (
      <TimelineCell
        cell={cell}
        isSelected={isSelected}
        onCellClick={handleCellClick}
        onMouseDown={handleMouseDown}
        zoom={zoom}
        offsetX={offsetX}
        offsetY={offsetY}
        updateCell={updateCell}
        saveHistory={saveHistory}
      />
    );
  }

  return (
    <>
      <div
        data-cell-id={cell.id}
        onClick={handleCellClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => handleMouseEnterForConnection(cell.id)}
        onMouseLeave={handleMouseLeaveForConnection}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
          backgroundColor: cell.backgroundColor,
          color: cell.textColor,
          border: isSelected
            ? '2px solid #3b82f6'
            : isHoveringForConnection
            ? '2px solid #10b981'
            : cell.borderThickness > 0
            ? `${cell.borderThickness}px solid ${cell.borderColor}`
            : 'none',
          borderRadius: `${cell.borderRadius}px`,
          padding: '12px',
          cursor: isConnecting ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          display: 'flex',
          alignItems: isEditing ? 'flex-start' : 'center',
          justifyContent: isEditing ? 'flex-start' : 'center',
          zIndex: isEditing ? 1000 : 10,
          boxSizing: 'border-box',
          ...fontStyle,
        }}
      >
      {isEditing ? (
        <>
          {/* Formatting Toolbar */}
          <div
            data-formatting-toolbar
            style={{
              position: 'absolute',
              top: -40,
              left: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: '4px',
              display: 'flex',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 9999,
            }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('bold');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('italic');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontStyle: 'italic',
              }}
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('underline');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              title="Underline (Ctrl+U)"
            >
              U
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('strikeThrough');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                textDecoration: 'line-through',
              }}
              title="Strikethrough (Ctrl+Shift+S)"
            >
              S
            </button>
            <div style={{ width: 1, backgroundColor: '#ccc' }} />
            <div style={{ position: 'relative' }}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  // Save current selection
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                  }
                  setShowTextColorPicker(!showTextColorPicker);
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
                title="Text Color"
              >
                A
              </button>
              {showTextColorPicker && !showTextCustomPicker && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    padding: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    minWidth: 180,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyTextColor(preset.textColor);
                          setShowTextColorPicker(false);
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: preset.textColor,
                          border: '2px solid #ccc',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                        title={preset.name}
                      />
                    ))}
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowTextCustomPicker(true);
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: '#f0f0f0',
                        border: '2px dashed #999',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 18,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Custom Color"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {showTextColorPicker && showTextCustomPicker && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    padding: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <input
                    type="color"
                    value={selectedTextColor}
                    onChange={(e) => setSelectedTextColor(e.target.value)}
                    style={{
                      width: 60,
                      height: 40,
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowTextCustomPicker(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Back
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyTextColor(selectedTextColor);
                        setShowTextColorPicker(false);
                        setShowTextCustomPicker(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: 3,
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  // Save current selection
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                  }
                  setShowHighlightColorPicker(!showHighlightColorPicker);
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  position: 'relative',
                }}
                title="Text Highlight"
              >
                <span style={{
                  backgroundColor: '#ffff00',
                  padding: '2px 4px',
                  borderRadius: 2,
                }}>
                  H
                </span>
              </button>
              {showHighlightColorPicker && !showHighlightCustomPicker && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    padding: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    minWidth: 180,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyBackgroundColor(preset.bgColor);
                          setShowHighlightColorPicker(false);
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: preset.bgColor,
                          border: '2px solid #ccc',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                        title={preset.name}
                      />
                    ))}
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowHighlightCustomPicker(true);
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: '#f0f0f0',
                        border: '2px dashed #999',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 18,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Custom Color"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {showHighlightColorPicker && showHighlightCustomPicker && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    padding: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <input
                    type="color"
                    value={selectedHighlightColor}
                    onChange={(e) => setSelectedHighlightColor(e.target.value)}
                    style={{
                      width: 60,
                      height: 40,
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowHighlightCustomPicker(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Back
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyBackgroundColor(selectedHighlightColor);
                        setShowHighlightColorPicker(false);
                        setShowHighlightCustomPicker(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: 3,
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ width: 1, backgroundColor: '#ccc' }} />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                changeFontSize(-1);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="Decrease Font Size"
            >
              −
            </button>
            <input
              ref={fontSizeInputRef}
              type="text"
              value={fontSizeInput}
              placeholder="—"
              onFocus={() => {
                // Save the current selection before focusing the input
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Also save selection on mouse down
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                }
              }}
              onChange={(e) => {
                setFontSizeInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyTypedFontSize();
                  editableRef.current?.focus();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setFontSizeInput(currentFontSize.toString());
                  editableRef.current?.focus();
                }
              }}
              onBlur={() => {
                if (fontSizeInput.trim() !== '') {
                  applyTypedFontSize();
                }
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                width: '45px',
                textAlign: 'center',
                fontSize: '12px',
                cursor: 'text',
              }}
              title="Font Size (8-72px)"
            />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                changeFontSize(1);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="Increase Font Size"
            >
              +
            </button>
            <div style={{ width: 1, backgroundColor: '#ccc' }} />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('left');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: currentAlignment === 'left' ? '#e0e0e0' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Align Left"
            >
              <AlignLeft size={16} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('center');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: currentAlignment === 'center' ? '#e0e0e0' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Align Center"
            >
              <AlignCenter size={16} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('right');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: currentAlignment === 'right' ? '#e0e0e0' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Align Right"
            >
              <AlignRight size={16} />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                applyAlignment('justify');
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 3,
                backgroundColor: currentAlignment === 'justify' ? '#e0e0e0' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Justify"
            >
              <AlignJustify size={16} />
            </button>
          </div>

          {/* ContentEditable Div */}
          <div
            ref={editableRef}
            contentEditable
            onInput={handleContentInput}
            onBlur={handleContentBlur}
            onKeyDown={handleContentKeyDown}
            onPaste={handlePaste}
            spellCheck={true}
            suppressContentEditableWarning
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: cell.textColor,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'text',
              ...fontStyle,
            }}
          />
        </>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{
            __html: cell.htmlContent || markdownToHtml(cell.text || '')
          }}
        />
      )}

      {isSelected && !isEditing && (
        <>
          {/* Corner handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            style={{
              position: 'absolute',
              left: -3,
              top: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            style={{
              position: 'absolute',
              right: -3,
              top: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nwse-resize',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            style={{
              position: 'absolute',
              left: -3,
              bottom: -3,
              width: 5,
              height: 5,
              backgroundColor: '#3b82f6',
              cursor: 'nesw-resize',
            }}
          />
          {/* Edge handles */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
            style={{
              position: 'absolute',
              left: '50%',
              top: -2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -2,
              width: 16,
              height: 4,
              backgroundColor: '#3b82f6',
              cursor: 'ns-resize',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
            style={{
              position: 'absolute',
              right: -2,
              top: '50%',
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              transform: 'translateY(-50%)',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
            style={{
              position: 'absolute',
              left: -2,
              top: '50%',
              width: 4,
              height: 16,
              backgroundColor: '#3b82f6',
              cursor: 'ew-resize',
              transform: 'translateY(-50%)',
            }}
          />
        </>
      )}
    </div>

    {/* Preview line disabled - coordinates were not aligning correctly */}
    {/* {isConnecting && (() => {
      // Calculate start position based on whether it's a timeline pin
      let startX = cell.x * zoom + offsetX + (cell.width * zoom) / 2;
      let startY = cell.y * zoom + offsetY + (cell.height * zoom) / 2;

      if (cell.isTimeline && connectionFromPinIndex !== undefined && cell.timelineConfig) {
        const config = cell.timelineConfig;
        const isHorizontal = config.orientation === 'Horizontal';

        // Calculate number of intervals
        let current = config.reverse ? Math.max(config.startNumber, config.endNumber) : config.startNumber;
        const end = config.reverse ? Math.min(config.startNumber, config.endNumber) : config.endNumber;
        const step = config.granularity === 'Custom' && config.customInterval ? config.customInterval : 1;
        const display = config.displayInterval || 1;
        let intervalCount = 0;

        if (config.reverse) {
          while (current >= end) {
            if ((Math.max(config.startNumber, config.endNumber) - current) % display === 0) {
              intervalCount++;
            }
            current -= step;
          }
        } else {
          while (current <= end) {
            if ((current - config.startNumber) % display === 0) {
              intervalCount++;
            }
            current += step;
          }
        }

        // Calculate item dimensions
        let itemWidth: number;
        let itemHeight: number;

        if (cell.manuallyResized) {
          itemWidth = isHorizontal ? cell.width / intervalCount : cell.width;
          itemHeight = isHorizontal ? cell.height : cell.height / intervalCount;
        } else {
          itemWidth = isHorizontal ? 60 : 40;
          itemHeight = isHorizontal ? 40 : 60;
        }

        if (isHorizontal) {
          startX = (cell.x + connectionFromPinIndex * itemWidth + itemWidth / 2) * zoom + offsetX;
          startY = (cell.y + itemHeight / 2) * zoom + offsetY;
        } else {
          startX = (cell.x + itemWidth / 2) * zoom + offsetX;
          startY = (cell.y + connectionFromPinIndex * itemHeight + itemHeight / 2) * zoom + offsetY;
        }
      }

      return (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <line
            x1={startX}
            y1={startY}
            x2={connectionEnd.x}
            y2={connectionEnd.y}
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="5 5"
          />
        </svg>
      );
    })()} */}
    </>
  );
}

interface TimelineCellProps {
  cell: Cell;
  isSelected: boolean;
  onCellClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  zoom: number;
  offsetX: number;
  offsetY: number;
  updateCell: (id: string, updates: Partial<Cell>) => void;
  saveHistory: () => void;
}

function TimelineCell({ cell, isSelected, onCellClick, onMouseDown, zoom, offsetX, offsetY, updateCell, saveHistory }: TimelineCellProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const isClickingToolbarRef = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cellX: 0, cellY: 0 });
  const resizeDirectionRef = useRef<ResizeDirection>(null);
  const allCellsResizeStartRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const lastClickRef = useRef<{ index: number; time: number } | null>(null);

  const { selectedCellIds, cells } = useStore();
  const config = cell.timelineConfig!;
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

  // If manually resized, calculate item size based on cell dimensions
  // Otherwise use default sizes
  let itemWidth: number;
  let itemHeight: number;
  let totalWidth: number;
  let totalHeight: number;

  if (cell.manuallyResized) {
    // Use the cell's actual dimensions
    totalWidth = cell.width;
    totalHeight = cell.height;
    itemWidth = isHorizontal ? cell.width / numbers.length : cell.width;
    itemHeight = isHorizontal ? cell.height : cell.height / numbers.length;
  } else {
    // Use default sizes
    itemWidth = isHorizontal ? 60 : 40;
    itemHeight = isHorizontal ? 40 : 60;
    totalWidth = isHorizontal ? numbers.length * itemWidth : itemWidth;
    totalHeight = isHorizontal ? itemHeight : numbers.length * itemHeight;
  }

  const handleResizeMouseDown = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: totalWidth,  // Use actual rendered width
      height: totalHeight, // Use actual rendered height
      cellX: cell.x,
      cellY: cell.y,
    };

    // Store initial dimensions of all selected cells for multi-cell resizing
    const initialDimensions = new Map<string, { x: number; y: number; width: number; height: number }>();
    selectedCellIds.forEach((id) => {
      const targetCell = cells.find((c) => c.id === id);
      if (targetCell) {
        // For timeline cells, we need to calculate their actual rendered dimensions
        let actualWidth = targetCell.width;
        let actualHeight = targetCell.height;

        if (targetCell.isTimeline && targetCell.timelineConfig) {
          const config = targetCell.timelineConfig;
          const isHorizontal = config.orientation === 'Horizontal';
          const numbers: number[] = [];
          for (let i = config.startNumber; i <= config.endNumber; i++) {
            numbers.push(i);
          }

          if (targetCell.manuallyResized) {
            actualWidth = targetCell.width;
            actualHeight = targetCell.height;
          } else {
            const itemWidth = isHorizontal ? 60 : 40;
            const itemHeight = isHorizontal ? 40 : 60;
            actualWidth = isHorizontal ? numbers.length * itemWidth : itemWidth;
            actualHeight = isHorizontal ? itemHeight : numbers.length * itemHeight;
          }
        }

        initialDimensions.set(id, {
          x: targetCell.x,
          y: targetCell.y,
          width: actualWidth,
          height: actualHeight,
        });
      }
    });
    allCellsResizeStartRef.current = initialDimensions;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const dx = (e.clientX - resizeStartRef.current.x) / zoom;
      const dy = (e.clientY - resizeStartRef.current.y) / zoom;
      const dir = resizeDirectionRef.current;

      let newX = resizeStartRef.current.cellX;
      let newY = resizeStartRef.current.cellY;
      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Handle horizontal resizing
      if (dir?.includes('e')) {
        newWidth = Math.max(50, resizeStartRef.current.width + dx);
      } else if (dir?.includes('w')) {
        const widthChange = -dx;
        newWidth = Math.max(50, resizeStartRef.current.width + widthChange);
        newX = resizeStartRef.current.cellX + (resizeStartRef.current.width - newWidth);
      }

      // Handle vertical resizing
      if (dir?.includes('s')) {
        newHeight = Math.max(30, resizeStartRef.current.height + dy);
      } else if (dir?.includes('n')) {
        const heightChange = -dy;
        newHeight = Math.max(30, resizeStartRef.current.height + heightChange);
        newY = resizeStartRef.current.cellY + (resizeStartRef.current.height - newHeight);
      }

      // Calculate scale factors
      const widthScale = newWidth / resizeStartRef.current.width;
      const heightScale = newHeight / resizeStartRef.current.height;

      // Update the current cell
      updateCell(cell.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

      // Apply proportional scaling to all other selected cells
      selectedCellIds.forEach((id) => {
        if (id !== cell.id) {
          const initialDims = allCellsResizeStartRef.current.get(id);
          if (initialDims) {
            let otherNewWidth = initialDims.width * widthScale;
            let otherNewHeight = initialDims.height * heightScale;
            let otherNewX = initialDims.x;
            let otherNewY = initialDims.y;

            // Adjust position for west/north directions
            if (dir?.includes('w')) {
              otherNewX = initialDims.x + (initialDims.width - otherNewWidth);
            }
            if (dir?.includes('n')) {
              otherNewY = initialDims.y + (initialDims.height - otherNewHeight);
            }

            updateCell(id, {
              x: otherNewX,
              y: otherNewY,
              width: Math.max(50, otherNewWidth),
              height: Math.max(30, otherNewHeight),
            });
          }
        }
      });
    }
  }, [isResizing, zoom, cell.id, updateCell, selectedCellIds]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      saveHistory();
      // Mark all selected cells as manually resized
      selectedCellIds.forEach((id) => {
        updateCell(id, { manuallyResized: true });
      });
    }
    setIsResizing(false);
    setResizeDirection(null);
    resizeDirectionRef.current = null;
  }, [isResizing, cell.id, updateCell, saveHistory, selectedCellIds]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      // Set the initial HTML content
      editInputRef.current.innerHTML = editingValue;

      editInputRef.current.focus();
      // Select all content in contentEditable div
      const range = document.createRange();
      range.selectNodeContents(editInputRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [editingIndex]); // Only run when entering edit mode, not when editingValue changes

  // Close editing mode when cell is deselected
  useEffect(() => {
    if (!isSelected && editingIndex !== null) {
      setEditingIndex(null);
      setEditingValue('');
    }
  }, [isSelected, editingIndex]);

  // Save selection when it changes in contentEditable
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      const handleSelectionChange = () => {
        // Don't update if we're currently interacting with toolbar
        if (isClickingToolbarRef.current) {
          return;
        }

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editInputRef.current?.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0);
          // Save the selection for toolbar interactions
          savedSelectionRef.current = range.cloneRange();
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }
  }, [editingIndex]);

  const handleSegmentClick = (e: React.MouseEvent, index: number, currentLabel: string | { text: string; html: string } | undefined) => {
    const now = Date.now();
    const lastClick = lastClickRef.current;

    const currentValue = typeof currentLabel === 'object' ? currentLabel.html : (currentLabel || String(numbers[index]));

    // Check if this is a double-click (within 300ms on the same segment)
    if (lastClick && lastClick.index === index && now - lastClick.time < 300) {
      e.stopPropagation();
      e.preventDefault();
      setEditingIndex(index);
      setEditingValue(currentValue);
      lastClickRef.current = null; // Reset
    } else {
      // Single click - just record it
      lastClickRef.current = { index, time: now };
    }
  };

  const handleEditBlur = () => {
    // If clicking on toolbar, don't close the editor
    if (isClickingToolbarRef.current) {
      return;
    }

    // Save immediately to avoid race conditions with deselection
    if (editingIndex !== null && editInputRef.current) {
      const htmlContent = editInputRef.current.innerHTML;
      const textContent = editInputRef.current.textContent || '';

      const newCustomLabels = { ...(config.customLabels || {}) };

      // Check if there's any HTML formatting
      const hasFormatting = htmlContent !== textContent && (
        htmlContent.includes('<b>') ||
        htmlContent.includes('<i>') ||
        htmlContent.includes('<u>') ||
        htmlContent.includes('style=') ||
        htmlContent.includes('<span')
      );

      // Remove if empty or (same as original number AND no formatting)
      if (textContent.trim() === '' || (textContent === String(numbers[editingIndex]) && !hasFormatting)) {
        delete newCustomLabels[editingIndex];
      } else {
        if (hasFormatting) {
          newCustomLabels[editingIndex] = {
            text: textContent,
            html: htmlContent
          };
        } else {
          // Plain text, just store as string
          newCustomLabels[editingIndex] = textContent;
        }
      }

      updateCell(cell.id, {
        timelineConfig: {
          ...config,
          customLabels: Object.keys(newCustomLabels).length > 0 ? newCustomLabels : undefined,
        },
      });
      saveHistory();

      // Small delay before closing to allow toolbar clicks to register
      setTimeout(() => {
        if (!isClickingToolbarRef.current) {
          setEditingIndex(null);
        }
      }, 150);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditBlur();
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  // Formatting commands for timeline segment editing
  const applyFormat = (command: string, value?: string) => {
    // Restore saved selection if it exists
    if (savedSelectionRef.current && editInputRef.current) {
      // First, refocus the contentEditable
      editInputRef.current.focus();

      // Then restore the selection
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelectionRef.current);

      // Apply the formatting using document.execCommand
      document.execCommand(command, false, value);

      // Keep the contentEditable focused
      editInputRef.current.focus();
    } else {
      // No saved selection, apply to current selection
      document.execCommand(command, false, value);
      editInputRef.current?.focus();
    }
  };

  return (
    <>
      <div
        data-cell-id={cell.id}
        onClick={onCellClick}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;

          // If currently editing a segment, only block drag on the contentEditable and toolbar
          if (editingIndex !== null) {
            if (target.isContentEditable ||
                target.closest('[contenteditable="true"]') ||
                target.closest('button') ||
                target.closest('input[type="color"]')) {
              e.stopPropagation();
              return;
            }
            // Allow dragging by clicking on other parts of the cell
          }

          // Allow drag - pass to parent handler
          if (!isResizing && onMouseDown) {
            onMouseDown(e);
          }
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: totalWidth,
          height: totalHeight,
          backgroundColor: cell.backgroundColor,
          color: cell.textColor,
          fontSize: `${cell.fontSize}px`,
          fontFamily: cell.fontFamily,
          fontWeight: cell.bold ? 'bold' : 'normal',
          fontStyle: cell.italic ? 'italic' : 'normal',
          textDecoration: `${cell.underline ? 'underline' : ''} ${cell.strikethrough ? 'line-through' : ''}`.trim() || 'none',
          border: isSelected ? '2px solid #3b82f6' : 'none',
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          cursor: isResizing ? 'default' : 'grab',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        {numbers.map((num, index) => {
          const customLabel = config.customLabels?.[index];
          const displayValue = typeof customLabel === 'object' ? customLabel.text : (customLabel ?? String(num));
          const displayHTML = typeof customLabel === 'object' ? customLabel.html : (customLabel ?? String(num));

          return (
            <div
              key={index}
              data-pin-index={index}
              data-timeline-segment="true"
              onClick={(e) => handleSegmentClick(e, index, customLabel)}
              style={{
                width: isHorizontal ? itemWidth : '100%',
                height: isHorizontal ? '100%' : itemHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isHorizontal ? '2px 0' : '0 2px',
                boxSizing: 'border-box',
                borderRight: isHorizontal && index < numbers.length - 1 ? `1px solid ${cell.borderColor}` : 'none',
                borderBottom: !isHorizontal && index < numbers.length - 1 ? `1px solid ${cell.borderColor}` : 'none',
                position: 'relative',
                cursor: 'text',
              }}
            >
              {editingIndex === index ? (
                <>
                  <div
                    ref={editInputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={handleEditBlur}
                    onKeyDown={handleEditKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      width: '90%',
                      minHeight: '60%',
                      maxHeight: '80%',
                      textAlign: 'center',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                      border: '1px solid #3b82f6',
                      borderRadius: 2,
                      backgroundColor: 'white',
                      color: cell.textColor,
                      outline: 'none',
                      overflow: 'auto',
                      padding: '2px 4px',
                    }}
                  />
                  {/* Formatting Toolbar */}
                  <div
                    onMouseDown={(e) => {
                      // Only stop propagation for actual toolbar elements, not the container
                      const target = e.target as HTMLElement;
                      if (target !== e.currentTarget) {
                        e.stopPropagation();
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '-32px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: 4,
                      padding: '4px',
                      display: 'flex',
                      gap: '2px',
                      zIndex: 100,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      pointerEvents: 'auto',
                    }}
                  >
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        // Save selection before button click
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onClick={() => applyFormat('bold')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px',
                      }}
                      title="Bold (Ctrl/Cmd+B)"
                    >
                      B
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onClick={() => applyFormat('italic')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontStyle: 'italic',
                        fontSize: '12px',
                      }}
                      title="Italic (Ctrl/Cmd+I)"
                    >
                      I
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onClick={() => applyFormat('underline')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: 2,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '12px',
                      }}
                      title="Underline (Ctrl/Cmd+U)"
                    >
                      U
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onClick={() => applyFormat('strikethrough')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: 2,
                        cursor: 'pointer',
                        textDecoration: 'line-through',
                        fontSize: '12px',
                      }}
                      title="Strikethrough"
                    >
                      S
                    </button>
                    <div style={{ width: '1px', backgroundColor: '#4b5563', margin: '0 4px' }} />
                    <input
                      type="color"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        isClickingToolbarRef.current = true;
                        // Save selection before color picker gains focus
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onChange={(e) => {
                        applyFormat('foreColor', e.target.value);
                        setTimeout(() => {
                          editInputRef.current?.focus();
                          isClickingToolbarRef.current = false;
                        }, 10);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          isClickingToolbarRef.current = false;
                        }, 10);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 2,
                      }}
                      title="Text Color"
                    />
                    <input
                      type="color"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        isClickingToolbarRef.current = true;
                        // Save selection before color picker gains focus
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
                        }
                      }}
                      onChange={(e) => {
                        applyFormat('backColor', e.target.value);
                        setTimeout(() => {
                          editInputRef.current?.focus();
                          isClickingToolbarRef.current = false;
                        }, 10);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          isClickingToolbarRef.current = false;
                        }, 10);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 2,
                      }}
                      title="Background Color"
                    />
                  </div>
                </>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: displayHTML }} />
                )
              }
              {isHovering && editingIndex !== index && (
                <div
                  data-connection-pin="true"
                  data-cell-id={cell.id}
                  data-pin-index={index}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    backgroundColor: '#3b82f6',
                    borderRadius: '50%',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          );
        })}
        {/* Continuous edge resize handles - drag anywhere on borders */}
        {isSelected && (
          <>
            {/* Edge handles - continuous along entire borders */}
            {/* Top edge - full width */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
              style={{
                position: 'absolute',
                left: 0,
                top: -4,
                width: '100%',
                height: 8,
                cursor: 'ns-resize',
                zIndex: 11,
              }}
            />
            {/* Bottom edge - full width */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 's')}
              style={{
                position: 'absolute',
                left: 0,
                bottom: -4,
                width: '100%',
                height: 8,
                cursor: 'ns-resize',
                zIndex: 11,
              }}
            />
            {/* Left edge - full height */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
              style={{
                position: 'absolute',
                left: -4,
                top: 0,
                width: 8,
                height: '100%',
                cursor: 'ew-resize',
                zIndex: 11,
              }}
            />
            {/* Right edge - full height */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
              style={{
                position: 'absolute',
                right: -4,
                top: 0,
                width: 8,
                height: '100%',
                cursor: 'ew-resize',
                zIndex: 11,
              }}
            />

            {/* Corner zones - higher z-index for diagonal resizing */}
            {/* Top-left corner */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
              style={{
                position: 'absolute',
                left: -4,
                top: -4,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                zIndex: 12,
              }}
            />
            {/* Top-right corner */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
              style={{
                position: 'absolute',
                right: -4,
                top: -4,
                width: 16,
                height: 16,
                cursor: 'nesw-resize',
                zIndex: 12,
              }}
            />
            {/* Bottom-right corner */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                zIndex: 12,
              }}
            />
            {/* Bottom-left corner */}
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
              style={{
                position: 'absolute',
                left: -4,
                bottom: -4,
                width: 16,
                height: 16,
                cursor: 'nesw-resize',
                zIndex: 12,
              }}
            />

            {/* Visual corner indicators */}
            <div
              style={{
                position: 'absolute',
                left: -3,
                top: -3,
                width: 6,
                height: 6,
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 13,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: -3,
                top: -3,
                width: 6,
                height: 6,
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 13,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 6,
                height: 6,
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 13,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -3,
                bottom: -3,
                width: 6,
                height: 6,
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 13,
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

export default CellComponent;
