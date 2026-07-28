const STYLES: Record<string, string> = {
  ALLOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DENY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  STEP_UP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export function StatusBadge({ verdict }: { verdict: 'ALLOW' | 'DENY' | 'STEP_UP' }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STYLES[verdict]}`}>
      {verdict}
    </span>
  );
}
