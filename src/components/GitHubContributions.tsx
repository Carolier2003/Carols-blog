import { useEffect, useState } from 'react';

interface Props {
  username: string;
}

interface ContributionDay {
  date: string;
  count: number;
  githubCount: number;
  gitcodeCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface ContributionResponse {
  weeks: ContributionDay[][];
  total: number;
  githubTotal: number;
  gitcodeTotal: number;
  updatedAt: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
  githubCount: number;
  gitcodeCount: number;
}

// API 基础地址
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:8787'
  : 'https://api.kon-carol.xyz';

// Simple SVG-based contribution heatmap component
export default function GitHubContributions({ username }: Props) {
  const [weeks, setWeeks] = useState<ContributionDay[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    github: 0,
    gitcode: 0,
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    count: 0,
    githubCount: 0,
    gitcodeCount: 0,
  });

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE}/api/contributions`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch contributions');
        }

        const data = result.data as ContributionResponse;

        setWeeks(data.weeks);
        setStats({
          total: data.total,
          github: data.githubTotal,
          gitcode: data.gitcodeTotal,
        });
      } catch (err) {
        console.error('Failed to fetch contributions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // 降级到模拟数据
        setWeeks(generateMockData());
        setStats({ total: 0, github: 0, gitcode: 0 });
      } finally {
        setLoading(false);
      }
    };

    // 初始加载
    fetchContributions();

    // View Transitions 后重新加载（Astro 页面导航）
    const handlePageLoad = () => {
      fetchContributions();
    };

    document.addEventListener('astro:page-load', handlePageLoad);

    return () => {
      document.removeEventListener('astro:page-load', handlePageLoad);
    };
  }, []);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleMouseEnter = (
    e: React.MouseEvent,
    day: ContributionDay
  ) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY - 10,
      date: formatDate(day.date),
      count: day.count,
      githubCount: day.githubCount,
      gitcodeCount: day.gitcodeCount,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltip((prev) => ({
      ...prev,
      x: e.clientX,
      y: e.clientY - 10,
    }));
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="mt-2 text-sm text-foreground/60">Loading contributions...</p>
      </div>
    );
  }

  const getColor = (level: number, isDark: boolean) => {
    if (level === 0) return isDark ? '#2d333b' : '#ebedf0';
    if (isDark) {
      const colors = [
        '',
        'rgba(255, 107, 1, 0.3)',
        'rgba(255, 107, 1, 0.5)',
        'rgba(255, 107, 1, 0.75)',
        'rgb(255, 107, 1)',
      ];
      return colors[level];
    } else {
      const colors = [
        '',
        'rgba(0, 108, 172, 0.3)',
        'rgba(0, 108, 172, 0.5)',
        'rgba(0, 108, 172, 0.75)',
        'rgb(0, 108, 172)',
      ];
      return colors[level];
    }
  };

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const cellSize = 10;
  const cellGap = 3;

  return (
    <div className="github-contributions overflow-x-auto flex flex-col items-center relative">
      {/* Stats summary */}
      <div className="flex items-center gap-4 mb-4 text-xs text-foreground/60">
        <span>
          <strong className="text-foreground">{stats.total}</strong> contributions in the last year
        </span>
        {stats.github > 0 && (
          <span className="hidden sm:inline">
            GitHub: <strong>{stats.github}</strong>
          </span>
        )}
        {stats.gitcode > 0 && (
          <span className="hidden sm:inline">
            GitCode: <strong>{stats.gitcode}</strong>
          </span>
        )}
        {error && <span className="text-amber-500">(using demo data)</span>}
      </div>

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
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => (
            <rect
              key={`${weekIndex}-${dayIndex}`}
              x={10 + weekIndex * (cellSize + cellGap)}
              y={20 + dayIndex * (cellSize + cellGap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(day.level, false)}
              className={`contribution-cell level-${day.level} cursor-pointer`}
              data-level={day.level}
              onMouseEnter={(e) => handleMouseEnter(e, day)}
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
            color: 'var(--foreground, #24292e)',
          }}
        >
          <div className="font-semibold">
            {tooltip.count === 0
              ? 'No contributions'
              : tooltip.count === 1
                ? '1 contribution'
                : `${tooltip.count} contributions`}
          </div>
          {(tooltip.githubCount > 0 || tooltip.gitcodeCount > 0) && (
            <div className="mt-1 text-[10px] opacity-70">
              {tooltip.githubCount > 0 && (
                <span className="mr-2">GitHub: {tooltip.githubCount}</span>
              )}
              {tooltip.gitcodeCount > 0 && (
                <span>GitCode: {tooltip.gitcodeCount}</span>
              )}
            </div>
          )}
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

// 降级用的模拟数据
function generateMockData(): ContributionDay[][] {
  const weeks: ContributionDay[][] = [];
  const today = new Date();

  for (let w = 0; w < 52; w++) {
    const week: ContributionDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (52 - w) * 7 + d);
      const count = Math.random() > 0.6 ? Math.floor(Math.random() * 12) + 1 : 0;

      week.push({
        date: date.toISOString().split('T')[0],
        count,
        githubCount: count,
        gitcodeCount: 0,
        level: calculateLevel(count),
      });
    }
    weeks.push(week);
  }

  return weeks;
}

function calculateLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}
