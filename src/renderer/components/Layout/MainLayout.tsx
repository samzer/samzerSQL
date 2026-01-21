import { useCallback, useRef, useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import EditorPanel from '../Editor/EditorPanel';
import ResultsPanel from '../Results/ResultsPanel';
import Resizer from '../common/Resizer';
import ConnectionModal from '../Modals/ConnectionModal';
import NewFolderModal from '../Modals/NewFolderModal';
import PasswordPromptModal from '../Modals/PasswordPromptModal';
import { useUIStore } from '../../stores/uiStore';

export default function MainLayout() {
  const {
    sidebarWidth,
    setSidebarWidth,
    resultsPanelHeight,
    setResultsPanelHeight,
    isConnectionModalOpen,
    isNewFolderModalOpen,
    isPasswordPromptOpen,
  } = useUIStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingResults, setIsDraggingResults] = useState(false);

  const handleSidebarResize = useCallback(
    (deltaX: number) => {
      setSidebarWidth(sidebarWidth + deltaX);
    },
    [sidebarWidth, setSidebarWidth]
  );

  const handleResultsResize = useCallback(
    (deltaY: number) => {
      setResultsPanelHeight(resultsPanelHeight - deltaY);
    },
    [resultsPanelHeight, setResultsPanelHeight]
  );

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col ${isDraggingSidebar || isDraggingResults ? 'dragging' : ''}`}
    >
      {/* macOS Title Bar - Draggable area for window movement */}
      <div className="h-10 flex-shrink-0 bg-pastel-bg-secondary border-b border-pastel-border-light draggable flex items-center justify-center">
        <div className="flex items-center gap-2 no-drag">
          <img src={new URL('../../assets/logo.png', import.meta.url).href} alt="samzerSQL" className="w-6 h-6" />
          <span className="text-sm font-semibold text-pastel-text-primary">samzerSQL</span>
        </div>
      </div>

      {/* Main content below title bar */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <div
          className="h-full flex-shrink-0 bg-pastel-bg-secondary border-r border-pastel-border-light"
          style={{ width: sidebarWidth }}
        >
          <Sidebar />
        </div>

      {/* Sidebar Resizer */}
      <Resizer
        direction="vertical"
        onResize={handleSidebarResize}
        onDragStart={() => setIsDraggingSidebar(true)}
        onDragEnd={() => setIsDraggingSidebar(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor Area */}
        <div className="flex-1 min-h-0">
          <EditorPanel />
        </div>

        {/* Results Resizer */}
        <Resizer
          direction="horizontal"
          onResize={handleResultsResize}
          onDragStart={() => setIsDraggingResults(true)}
          onDragEnd={() => setIsDraggingResults(false)}
        />

        {/* Results Panel */}
        <div
          className="flex-shrink-0 bg-pastel-bg-primary border-t border-pastel-border-light"
          style={{ height: resultsPanelHeight }}
        >
          <ResultsPanel />
        </div>
      </div>

      {/* Modals */}
      {isConnectionModalOpen && <ConnectionModal />}
      {isNewFolderModalOpen && <NewFolderModal />}
      {isPasswordPromptOpen && <PasswordPromptModal />}
      </div>
    </div>
  );
}
