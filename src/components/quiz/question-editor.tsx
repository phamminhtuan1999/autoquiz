"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@heroui/react";

interface QuestionEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  label?: string;
}

export function QuestionEditor({
  initialContent,
  onSave,
  onCancel,
  label = "Edit",
}: QuestionEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "min-h-[80px] w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent-border)] transition-colors",
      },
    },
  });

  function handleSave() {
    if (editor) onSave(editor.getText());
  }

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
          {label}
        </p>
      )}
      <EditorContent editor={editor} />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onPress={handleSave}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
