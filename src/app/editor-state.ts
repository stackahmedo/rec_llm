/**
 * Editor state management for PDF workspace.
 * Handles tool state, annotations, undo/redo, selection, and page navigation.
 */

import { useState, useCallback, useRef } from "react";

// --- Tool Types ---
export type EditorTool = "select" | "text" | "highlight" | "comment" | "draw" | "redact" | "ai";

export interface ToolProperties {
  color: string;
  opacity: number;
  fontSize: number;
  strokeWidth: number;
}

const defaultToolProps: Record<EditorTool, ToolProperties> = {
  select: { color: "#000000", opacity: 1, fontSize: 12, strokeWidth: 1 },
  text: { color: "#000000", opacity: 1, fontSize: 11, strokeWidth: 1 },
  highlight: { color: "#FFEB3B", opacity: 0.4, fontSize: 12, strokeWidth: 8 },
  comment: { color: "#2196F3", opacity: 1, fontSize: 10, strokeWidth: 1 },
  draw: { color: "#F44336", opacity: 1, fontSize: 12, strokeWidth: 2 },
  redact: { color: "#000000", opacity: 1, fontSize: 12, strokeWidth: 16 },
  ai: { color: "#9C27B0", opacity: 1, fontSize: 12, strokeWidth: 1 },
};

// --- Annotation Types ---
export interface Annotation {
  id: string;
  type: EditorTool;
  segmentIndex: number;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  opacity: number;
  createdAt: number;
}

// --- Selection ---
export interface Selection {
  segmentIndices: number[];
  startOffset?: number;
  endOffset?: number;
}

// --- Undo/Redo ---
interface EditorAction {
  type: "add_annotation" | "remove_annotation" | "edit_annotation" | "edit_text";
  annotation?: Annotation;
  previousAnnotation?: Annotation;
  segmentIndex?: number;
  previousText?: string;
  newText?: string;
}

// --- Editor State Hook ---
export function useEditorState() {
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [toolProps, setToolProps] = useState<Record<EditorTool, ToolProperties>>(defaultToolProps);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

  // Undo/Redo stacks
  const undoStack = useRef<EditorAction[]>([]);
  const redoStack = useRef<EditorAction[]>([]);
  const MAX_UNDO = 50;

  // --- Tool Management ---
  const selectTool = useCallback((tool: EditorTool) => {
    setActiveTool(tool);
    if (tool !== "select") setSelection(null);
  }, []);

  const updateToolProps = useCallback((tool: EditorTool, props: Partial<ToolProperties>) => {
    setToolProps((prev) => ({ ...prev, [tool]: { ...prev[tool], ...props } }));
  }, []);

  const getActiveProps = useCallback((): ToolProperties => {
    return toolProps[activeTool];
  }, [activeTool, toolProps]);

  // --- Annotation Management ---
  const addAnnotation = useCallback((annotation: Omit<Annotation, "id" | "createdAt">) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    pushUndo({ type: "add_annotation", annotation: newAnnotation });
    return newAnnotation;
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) pushUndo({ type: "remove_annotation", annotation: removed });
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const updateAnnotation = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => {
      if (a.id === id) {
        pushUndo({ type: "edit_annotation", annotation: { ...a, ...patch }, previousAnnotation: a });
        return { ...a, ...patch };
      }
      return a;
    }));
  }, []);

  const getAnnotationsForPage = useCallback((page: number) => {
    return annotations.filter((a) => a.page === page);
  }, [annotations]);

  const getAnnotationsForSegment = useCallback((segmentIndex: number) => {
    return annotations.filter((a) => a.segmentIndex === segmentIndex);
  }, [annotations]);

  // --- Selection ---
  const selectSegments = useCallback((indices: number[]) => {
    setSelection({ segmentIndices: indices });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // --- Undo/Redo ---
  function pushUndo(action: EditorAction) {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = []; // Clear redo on new action
  }

  const undo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    redoStack.current.push(action);

    switch (action.type) {
      case "add_annotation":
        setAnnotations((prev) => prev.filter((a) => a.id !== action.annotation!.id));
        break;
      case "remove_annotation":
        setAnnotations((prev) => [...prev, action.annotation!]);
        break;
      case "edit_annotation":
        setAnnotations((prev) => prev.map((a) => a.id === action.previousAnnotation!.id ? action.previousAnnotation! : a));
        break;
    }
  }, []);

  const redo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    undoStack.current.push(action);

    switch (action.type) {
      case "add_annotation":
        setAnnotations((prev) => [...prev, action.annotation!]);
        break;
      case "remove_annotation":
        setAnnotations((prev) => prev.filter((a) => a.id !== action.annotation!.id));
        break;
      case "edit_annotation":
        setAnnotations((prev) => prev.map((a) => a.id === action.previousAnnotation!.id ? action.annotation! : a));
        break;
    }
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // --- Page Navigation ---
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  return {
    // Tool state
    activeTool,
    selectTool,
    toolProps,
    updateToolProps,
    getActiveProps,

    // Annotations
    annotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    getAnnotationsForPage,
    getAnnotationsForSegment,

    // Selection
    selection,
    selectSegments,
    clearSelection,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,

    // Pages
    currentPage,
    totalPages,
    setTotalPages,
    goToPage,
    nextPage,
    prevPage,

    // Editing state
    isEditing,
    setIsEditing,
  };
}
