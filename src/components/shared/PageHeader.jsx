export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
