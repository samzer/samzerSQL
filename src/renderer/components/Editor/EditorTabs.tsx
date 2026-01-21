import { useEditorStore } from '../../stores/editorStore';

export default function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab, createTab } = useEditorStore();

  return (
    <div className="flex items-center bg-pastel-bg-secondary border-b border-pastel-border-light">
      {/* Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            id={tab.id}
            name={tab.name}
            isDirty={tab.isDirty}
            isActive={tab.id === activeTabId}
            isExecuting={tab.isExecuting}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <button
        onClick={() => createTab()}
        className="flex-shrink-0 p-2 text-pastel-text-muted hover:text-pastel-text-primary hover:bg-pastel-bg-hover transition-colors"
        title="New Query"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}

interface TabProps {
  id: string;
  name: string;
  isDirty: boolean;
  isActive: boolean;
  isExecuting: boolean;
  onClick: () => void;
  onClose: () => void;
}

function Tab({ name, isDirty, isActive, isExecuting, onClick, onClose }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center gap-2 px-4 py-2 border-r border-pastel-border-light cursor-pointer
        ${isActive ? 'bg-pastel-bg-primary border-b-2 border-b-pastel-accent-blue' : 'hover:bg-pastel-bg-hover'}
        min-w-[120px] max-w-[200px]
      `}
    >
      {/* Executing indicator */}
      {isExecuting && (
        <svg className="w-3 h-3 animate-spin text-pastel-accent-blue-text" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {/* Tab name */}
      <span className="flex-1 text-sm text-pastel-text-primary truncate">
        {name}
      </span>

      {/* Dirty indicator */}
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-pastel-accent-blue flex-shrink-0" />
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-pastel-bg-active text-pastel-text-muted hover:text-pastel-text-primary transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
