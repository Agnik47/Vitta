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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6">
      <div>
        <h1 className="font-heading text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
