import EditorTabs from './EditorTabs';
import Toolbar from './Toolbar';
import SQLEditor from './SQLEditor';
import { useEditorStore } from '../../stores/editorStore';

export default function EditorPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />
      <Toolbar />
      <div className="flex-1 min-h-0">
        {activeTab ? (
          <SQLEditor
            key={activeTab.id}
            tabId={activeTab.id}
            initialContent={activeTab.content}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-pastel-text-muted">
            No query open
          </div>
        )}
      </div>
    </div>
  );
}
