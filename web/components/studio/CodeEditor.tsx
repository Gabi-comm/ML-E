"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("mle", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a6a6a", fontStyle: "italic" },
      { token: "keyword", foreground: "ffffff", fontStyle: "bold" },
      { token: "string", foreground: "7cffb2" },
      { token: "number", foreground: "ffd166" },
      { token: "", foreground: "d6d6d6" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.lineHighlightBackground": "#101010",
      "editorLineNumber.foreground": "#4a4a4a",
      "editorLineNumber.activeForeground": "#ffffff",
      "editorCursor.foreground": "#ffffff",
      "editor.selectionBackground": "#3a3a3a",
      "editorIndentGuide.background1": "#161616",
      "editorWidget.background": "#070707",
      "editorWidget.border": "#242424",
    },
  });
};

export default function CodeEditor({
  value,
  onChange,
  onCursorLine,
  onRun,
  onAsk,
}: {
  value: string;
  onChange: (value: string) => void;
  onCursorLine: (line: number) => void;
  onRun: () => void;
  onAsk?: (code: string) => void;
}) {
  const run = useRef(onRun);
  const ask = useRef(onAsk);
  useEffect(() => {
    run.current = onRun;
    ask.current = onAsk;
  }, [onRun, onAsk]);

  const onMount: OnMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((event) => onCursorLine(event.position.lineNumber));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run.current());
    // right-click (or Ctrl+I) on code to ask what it means: the selection, or the whole line
    editor.addAction({
      id: "mle.ask",
      label: "Ask ML-E about this",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      run: (ed) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (!model || !selection) return;
        const picked = model.getValueInRange(selection).trim() || model.getLineContent(selection.startLineNumber).trim();
        if (picked) ask.current?.(picked.slice(0, 600));
      },
    });
  };

  return (
    <Editor
      language="python"
      theme="mle"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      beforeMount={beforeMount}
      onMount={onMount}
      loading={<span className="label">Loading editor…</span>}
      options={{
        fontSize: 13,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        padding: { top: 10 },
        renderLineHighlight: "line",
        overviewRulerLanes: 0,
      }}
    />
  );
}
