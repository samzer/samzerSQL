interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-pastel-bg-tertiary';

  const variantStyles = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        <Skeleton width={120} height={20} />
        <Skeleton width={150} height={20} />
        <Skeleton width={100} height={20} />
        <Skeleton width={180} height={20} />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton width={120} height={16} />
          <Skeleton width={150} height={16} />
          <Skeleton width={100} height={16} />
          <Skeleton width={180} height={16} />
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Section header */}
      <Skeleton width={80} height={12} />

      {/* Items */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 pl-2">
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton width={100 + Math.random() * 60} height={14} />
        </div>
      ))}

      {/* Another section */}
      <div className="pt-4">
        <Skeleton width={60} height={12} />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 pl-2">
          <Skeleton width={16} height={16} />
          <Skeleton width={80 + Math.random() * 50} height={14} />
        </div>
      ))}
    </div>
  );
}
