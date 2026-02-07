import { useState, useCallback } from 'react';
import ConnectionList from './ConnectionList';
import FolderTree from './FolderTree';
import SchemaBrowser from './SchemaBrowser';
import Resizer from '../common/Resizer';

type SidebarSection = 'connections' | 'queries' | 'schema';

const MIN_SCHEMA_HEIGHT = 100;
const MAX_SCHEMA_HEIGHT = 600;
const DEFAULT_SCHEMA_HEIGHT = 250;

export default function Sidebar() {
  const [expandedSections, setExpandedSections] = useState<Set<SidebarSection>>(
    new Set(['connections', 'queries', 'schema'])
  );
  const [schemaHeight, setSchemaHeight] = useState(DEFAULT_SCHEMA_HEIGHT);

  const toggleSection = (section: SidebarSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSchemaResize = useCallback((delta: number) => {
    setSchemaHeight((prev) => {
      // Delta is positive when moving down, negative when moving up
      // We want to increase height when dragging up (negative delta)
      const newHeight = prev - delta;
      return Math.max(MIN_SCHEMA_HEIGHT, Math.min(MAX_SCHEMA_HEIGHT, newHeight));
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Connections section */}
      <div className="flex-shrink-0 max-h-[25%] flex flex-col">
        <SectionHeader
          title="Connections"
          isExpanded={expandedSections.has('connections')}
          onToggle={() => toggleSection('connections')}
        />
        {expandedSections.has('connections') && (
          <div className="overflow-auto">
            <ConnectionList />
          </div>
        )}
      </div>

      {/* Queries section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <SectionHeader
          title="Queries"
          isExpanded={expandedSections.has('queries')}
          onToggle={() => toggleSection('queries')}
        />
        {expandedSections.has('queries') && (
          <div className="flex-1 overflow-auto">
            <FolderTree />
          </div>
        )}
      </div>

      {/* Resizer for Database Browser */}
      <Resizer direction="horizontal" onResize={handleSchemaResize} />

      {/* Database Browser section */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{ height: expandedSections.has('schema') ? schemaHeight : 'auto' }}
      >
        <SectionHeader
          title="Database Browser"
          isExpanded={expandedSections.has('schema')}
          onToggle={() => toggleSection('schema')}
        />
        {expandedSections.has('schema') && (
          <div className="flex-1 overflow-hidden">
            <SchemaBrowser />
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ title, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-pastel-text-muted hover:bg-pastel-bg-hover transition-colors flex-shrink-0"
    >
      <svg
        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      {title}
    </button>
  );
}
