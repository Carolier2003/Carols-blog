import { useEffect, useState } from 'react';

interface Props {
  username: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
}

// Simple SVG-based contribution heatmap component
export default function GitHubContributions({ username }: Props) {
  const [data, setData] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    count: 0
  });

  useEffect(() => {
    // Generate sample data (replace with actual GitHub API call if needed)
    const generateData = () => {
      const weeks = 52;
      const days = 7;
      const result: number[][] = [];

      for (let w = 0; w < weeks; w++) {
        const week: number[] = [];
        for (let d = 0; d < days; d++) {
          // Random contribution level 0-4
          const level = Math.random() > 0.6 ? Math.floor(Math.random() * 4) + 1 : 0;
          week.push(level);
        }
        result.push(week);
      }
      return result;
    };

    setData(generateData());
    setLoading(false);
  }, []);

  // Calculate date for a given week and day index
  const getDateForCell = (weekIndex: number, dayIndex: number): string => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (52 * 7));

    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + (weekIndex * 7) + dayIndex);

    return cellDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate contribution count from level
  const getContributionCount = (level: number): number => {
    if (level === 0) return 0;
    return level * Math.floor(Math.random() * 3 + 1);
  };

  const handleMouseEnter = (e: React.MouseEvent, weekIndex: number, dayIndex: number, level: number) => {
    const count = getContributionCount(level);
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY - 10,
      date: getDateForCell(weekIndex, dayIndex),
      count: count
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltip(prev => ({
      ...prev,
      x: e.clientX,
      y: e.clientY - 10
    }));
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  if (loading) {
    return <div className="text-center py-4">Loading contributions...</div>;
  }

  const getColor = (level: number, isDark: boolean) => {
    if (level === 0) return isDark ? '#2d333b' : '#ebedf0';
    if (isDark) {
      // Orange theme for dark mode
      const colors = ['', 'rgba(255, 107, 1, 0.3)', 'rgba(255, 107, 1, 0.5)', 'rgba(255, 107, 1, 0.75)', 'rgb(255, 107, 1)'];
      return colors[level];
    } else {
      // Blue theme for light mode
      const colors = ['', 'rgba(0, 108, 172, 0.3)', 'rgba(0, 108, 172, 0.5)', 'rgba(0, 108, 172, 0.75)', 'rgb(0, 108, 172)'];
      return colors[level];
    }
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cellSize = 10;
  const cellGap = 3;

  return (
    <div className="github-contributions overflow-x-auto flex flex-col items-center relative">
      <svg
        viewBox={`0 0 ${52 * (cellSize + cellGap) + 20} ${7 * (cellSize + cellGap) + 30}`}
        className="w-full min-w-[700px] mx-auto"
        style={{ maxWidth: '100%' }}
      >
        {/* Month labels */}
        {months.map((month, i) => (
          <text
            key={month}
            x={10 + i * 4.3 * (cellSize + cellGap)}
            y={15}
            fontSize={10}
            fill="currentColor"
            className="opacity-50"
          >
            {month}
          </text>
        ))}

        {/* Contribution cells */}
        {data.map((week, weekIndex) =>
          week.map((level, dayIndex) => (
            <rect
              key={`${weekIndex}-${dayIndex}`}
              x={10 + weekIndex * (cellSize + cellGap)}
              y={20 + dayIndex * (cellSize + cellGap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(level, false)}
              className={`contribution-cell level-${level} cursor-pointer`}
              data-level={level}
              onMouseEnter={(e) => handleMouseEnter(e, weekIndex, dayIndex, level)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          ))
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs opacity-50">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`w-3 h-3 rounded-sm contribution-cell level-${level}`}
            style={{ backgroundColor: getColor(level, false) }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 text-xs rounded-md shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--background, #fff)',
            border: '1px solid var(--border, #e1e4e8)',
            color: 'var(--foreground, #24292e)'
          }}
        >
          <div className="font-semibold">
            {tooltip.count === 0 ? 'No contributions' :
             tooltip.count === 1 ? '1 contribution' :
             `${tooltip.count} contributions`}
          </div>
          <div className="opacity-70">{tooltip.date}</div>
        </div>
      )}

      <style>{`
        .github-contributions {
          color: var(--foreground);
        }
        [data-theme="dark"] .contribution-cell[data-level="0"] { fill: #2d333b !important; }
        [data-theme="dark"] .contribution-cell[data-level="1"] { fill: rgba(255, 107, 1, 0.3) !important; }
        [data-theme="dark"] .contribution-cell[data-level="2"] { fill: rgba(255, 107, 1, 0.5) !important; }
        [data-theme="dark"] .contribution-cell[data-level="3"] { fill: rgba(255, 107, 1, 0.75) !important; }
        [data-theme="dark"] .contribution-cell[data-level="4"] { fill: rgb(255, 107, 1) !important; }

        [data-theme="dark"] .contribution-cell.level-0 { background-color: #2d333b !important; }
        [data-theme="dark"] .contribution-cell.level-1 { background-color: rgba(255, 107, 1, 0.3) !important; }
        [data-theme="dark"] .contribution-cell.level-2 { background-color: rgba(255, 107, 1, 0.5) !important; }
        [data-theme="dark"] .contribution-cell.level-3 { background-color: rgba(255, 107, 1, 0.75) !important; }
        [data-theme="dark"] .contribution-cell.level-4 { background-color: rgb(255, 107, 1) !important; }
      `}</style>
    </div>
  );
}
