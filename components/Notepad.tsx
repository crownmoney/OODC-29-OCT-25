import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  noteKey?: string;
}

const DB_NAME = 'CrownMoneyNotepad';
const STORE_NAME = 'notes';

function openNotepadDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNote(html: string, noteKey: string) {
  const idb = await openNotepadDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id: noteKey, html, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadNote(noteKey: string): Promise<string> {
  // Notes are stored on this device only
  const idb = await openNotepadDB();
  return new Promise<string>((resolve) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(noteKey);
    req.onsuccess = () => resolve(req.result?.html || '');
    req.onerror = () => resolve('');
  });
}

const FONTS = ['Default', 'Georgia', 'Times New Roman', 'Arial', 'Courier New', 'Verdana', 'Trebuchet MS'];
const FONTSIZES = ['12', '14', '16', '18', '20', '24', '28', '32'];
const COLORS = ['#250B40', '#5B21B6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#000000', '#6b7280', '#ffffff'];

const Notepad: React.FC<Props> = ({ isOpen, onClose, noteKey = 'main_note' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [wordCount, setWordCount] = useState(0);
  const isCloudSyncActive = false; // notes are stored on this device only
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, strikeThrough: false });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen && editorRef.current) {
      loadNote(noteKey).then(html => {
        if (editorRef.current) {
          editorRef.current.innerHTML = html || '<p><br></p>';
          updateWordCount();
        }
      });
    }
  }, [isOpen, noteKey]);

  const updateWordCount = useCallback(() => {
    const text = editorRef.current?.innerText || '';
    const count = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(count);
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveNote(editorRef.current?.innerHTML || '', noteKey);
      setSaveStatus('saved');
    }, 800);
  }, [noteKey]);

  const handleInput = useCallback(() => {
    updateWordCount();
    scheduleSave();
    updateActiveFormats();
  }, [updateWordCount, scheduleSave]);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    });
  }, []);

  const execCmd = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
    scheduleSave();
  }, [scheduleSave, updateActiveFormats]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      execCmd('insertText', '    ');
    }
    // CMD/CTRL shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); execCmd('bold'); }
      if (e.key === 'i') { e.preventDefault(); execCmd('italic'); }
      if (e.key === 'u') { e.preventDefault(); execCmd('underline'); }
      if (e.key === 's') { e.preventDefault(); saveNote(editorRef.current?.innerHTML || '', noteKey).then(() => setSaveStatus('saved')); }
    }
  }, [execCmd]);

  const handleHighlight = (color: string) => {
    execCmd('hiliteColor', color);
  };

  const handleFontColor = (color: string) => {
    execCmd('foreColor', color);
  };

  const ToolbarBtn: React.FC<{ onClick: () => void; active?: boolean; title: string; children: React.ReactNode; danger?: boolean }> = ({ onClick, active, title, children, danger }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-all ${active ? 'bg-[var(--title-color)] text-white shadow-inner' : danger ? 'hover:bg-red-100 text-red-500' : 'hover:bg-[var(--border-color)] text-[var(--text-color)]'}`}
    >{children}</button>
  );

  const Divider = () => <div className="w-px h-5 bg-[var(--border-color)] mx-1 self-center" />;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-[var(--card-bg-color)] rounded-2xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden"
        style={{ width: 'min(900px, 95vw)', height: 'min(700px, 90vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--title-color)] to-purple-500">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm uppercase tracking-wider">📋 Crown Money Notepad</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${saveStatus === 'saved' ? 'bg-green-400/20 text-green-200' : saveStatus === 'saving' ? 'bg-yellow-400/20 text-yellow-200' : 'bg-white/20 text-white/70'}`}>
              {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '...' : '● Unsaved'}
            </span>
            <span className="text-xs text-white/70">{wordCount} words</span>
            <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1 transition-colors text-lg leading-none">&times;</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-color)] overflow-x-auto">
          {/* Font family */}
          <select
            onMouseDown={e => e.stopPropagation()}
            onChange={e => execCmd('fontName', e.target.value === 'Default' ? 'inherit' : e.target.value)}
            className="text-xs border border-[var(--input-border-color)] bg-[var(--input-bg-color)] rounded px-1 py-1 h-7 text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-[var(--title-color)]"
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          {/* Font size */}
          <select
            onMouseDown={e => e.stopPropagation()}
            onChange={e => execCmd('fontSize', String(parseInt(e.target.value) > 20 ? 7 : parseInt(e.target.value) > 16 ? 6 : parseInt(e.target.value) > 14 ? 5 : parseInt(e.target.value) > 12 ? 4 : 3))}
            className="w-14 text-xs border border-[var(--input-border-color)] bg-[var(--input-bg-color)] rounded px-1 py-1 h-7 text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-[var(--title-color)]"
          >
            {FONTSIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <Divider />

          {/* Heading */}
          <select
            onMouseDown={e => e.stopPropagation()}
            onChange={e => { execCmd('formatBlock', e.target.value); (e.target as HTMLSelectElement).value = 'p'; }}
            className="text-xs border border-[var(--input-border-color)] bg-[var(--input-bg-color)] rounded px-1 py-1 h-7 text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-[var(--title-color)]"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="pre">Code block</option>
          </select>

          <Divider />

          {/* Format buttons */}
          <ToolbarBtn onClick={() => execCmd('bold')} active={activeFormats.bold} title="Bold (Ctrl+B)"><b>B</b></ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('italic')} active={activeFormats.italic} title="Italic (Ctrl+I)"><i>I</i></ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('underline')} active={activeFormats.underline} title="Underline (Ctrl+U)"><u>U</u></ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('strikeThrough')} active={activeFormats.strikeThrough} title="Strikethrough"><s>S</s></ToolbarBtn>

          <Divider />

          {/* Lists */}
          <ToolbarBtn onClick={() => execCmd('insertUnorderedList')} title="Bullet List">≡</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('insertOrderedList')} title="Numbered List">1.</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('outdent')} title="Outdent">⇤</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('indent')} title="Indent">⇥</ToolbarBtn>

          <Divider />

          {/* Alignment */}
          <ToolbarBtn onClick={() => execCmd('justifyLeft')} title="Align Left">⇐</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('justifyCenter')} title="Center">☰</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('justifyRight')} title="Align Right">⇒</ToolbarBtn>

          <Divider />

          {/* Text color */}
          <div className="relative group/color">
            <button title="Text Color" className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--border-color)] text-xs font-bold border border-[var(--input-border-color)]">A</button>
            <div className="absolute top-8 left-0 hidden group-hover/color:flex flex-wrap gap-1 bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-lg p-2 shadow-xl z-20 w-32">
              {COLORS.map(c => (
                <button key={c} onMouseDown={e => { e.preventDefault(); handleFontColor(c); }} className="w-6 h-6 rounded-full border border-[var(--border-color)] flex-shrink-0 hover:scale-110 transition-transform" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>

          {/* Highlight color */}
          <div className="relative group/highlight">
            <button title="Highlight" className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--border-color)] text-xs" style={{ background: '#fef08a' }}>🖊</button>
            <div className="absolute top-8 left-0 hidden group-hover/highlight:flex flex-wrap gap-1 bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-lg p-2 shadow-xl z-20 w-32">
              {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', 'transparent'].map(c => (
                <button key={c} onMouseDown={e => { e.preventDefault(); handleHighlight(c); }} className="w-6 h-6 rounded-full border border-[var(--border-color)] flex-shrink-0 hover:scale-110 transition-transform text-xs" style={{ background: c === 'transparent' ? 'white' : c }} title={c === 'transparent' ? 'Remove highlight' : c}>{c === 'transparent' ? '✕' : ''}</button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Undo / Redo */}
          <ToolbarBtn onClick={() => execCmd('undo')} title="Undo (Ctrl+Z)">↩</ToolbarBtn>
          <ToolbarBtn onClick={() => execCmd('redo')} title="Redo (Ctrl+Y)">↪</ToolbarBtn>

          <Divider />

          {/* Clear */}
          <ToolbarBtn onClick={() => { if (window.confirm('Clear all notes?')) { if (editorRef.current) { editorRef.current.innerHTML = '<p><br></p>'; } scheduleSave(); }}} title="Clear all notes" danger>🗑</ToolbarBtn>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={updateActiveFormats}
          onKeyUp={updateActiveFormats}
          className="flex-1 overflow-y-auto p-6 outline-none text-[var(--text-color)] leading-relaxed"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '15px',
            minHeight: '200px',
          }}
          data-placeholder="Start typing your notes here..."
          spellCheck
        />

        <style>{`
          [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--text-color-muted); opacity: 0.5; pointer-events: none; }
          [contenteditable] h1 { font-size: 2em; font-weight: 900; margin: 0.5em 0; color: var(--title-color); }
          [contenteditable] h2 { font-size: 1.5em; font-weight: 800; margin: 0.5em 0; color: var(--title-color); }
          [contenteditable] h3 { font-size: 1.2em; font-weight: 700; margin: 0.5em 0; }
          [contenteditable] pre { background: #f1f5f9; padding: 0.75em 1em; border-radius: 8px; font-family: monospace; font-size: 0.9em; }
          [contenteditable] ul { list-style-type: disc; padding-left: 1.5em; }
          [contenteditable] ol { list-style-type: decimal; padding-left: 1.5em; }
          [contenteditable] p { margin: 0.3em 0; }
        `}</style>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-color)] flex items-center justify-between text-xs text-[var(--text-color-muted)]">
          <span>Ctrl+B Bold · Ctrl+I Italic · Ctrl+U Underline · Ctrl+S Save</span>
          <span className="flex items-center gap-1">
            {isCloudSyncActive ? '☁️ Cloud Sync Active' : '💾 Local Save Only'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Notepad;
