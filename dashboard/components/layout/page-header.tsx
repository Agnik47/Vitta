/**
 * Every page opens with this: a display-face title plus a one-line
 * description, written for narration clarity during the live demo, not just
 * as decoration. See DESIGN.md § Layout System.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-[28px] font-medium tracking-tight text-foreground sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
