import { useCallback, useEffect, useRef } from 'react';

interface ResizerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function Resizer({
  direction,
  onResize,
  onDragStart,
  onDragEnd,
}: ResizerProps) {
  const isDragging = useRef(false);
  const lastPosition = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastPosition.current = direction === 'horizontal' ? e.clientY : e.clientX;
      onDragStart?.();
    },
    [direction, onDragStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const currentPosition = direction === 'horizontal' ? e.clientY : e.clientX;
      const delta = currentPosition - lastPosition.current;
      lastPosition.current = currentPosition;

      onResize(delta);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onDragEnd?.();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, onResize, onDragEnd]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      className={`
        ${isHorizontal ? 'h-1 cursor-row-resize w-full' : 'w-1 cursor-col-resize h-full'}
        bg-pastel-border-light hover:bg-pastel-accent-blue active:bg-pastel-accent-blue
        transition-colors duration-150 flex-shrink-0
      `}
      onMouseDown={handleMouseDown}
    />
  );
}
