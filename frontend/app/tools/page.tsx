import Link from 'next/link';

function CalcIcon() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M80,120h96a8,8,0,0,0,8-8V64a8,8,0,0,0-8-8H80a8,8,0,0,0-8,8v48A8,8,0,0,0,80,120Zm8-48h80v32H88ZM200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24Zm0,192H56V40H200ZM100,148a12,12,0,1,1-12-12A12,12,0,0,1,100,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,148Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,148Zm-80,40a12,12,0,1,1-12-12A12,12,0,0,1,100,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,140,188Zm40,0a12,12,0,1,1-12-12A12,12,0,0,1,180,188Z" />
    </svg>
  );
}

const TOOLS = [
  {
    href: '/tools/risk-calculator',
    title: 'Risk Calculator',
    description: 'Calculate position size based on your risk tolerance and stop loss distance.',
    badge: 'Beta',
    icon: <CalcIcon />,
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-page">
      <header className="tools-heading">
        <div className="tools-heading-row">
          <div className="tools-brand-lockup" aria-hidden>
            <span className="tools-brand-mark">PF</span>
            <span className="tools-brand-name">PropFirm</span>
          </div>
          <div className="tools-heading-rule" />
          <h1>Trading Tools</h1>
        </div>
        <p>Professional-grade tools to sharpen your trading edge.</p>
      </header>

      <section aria-label="Available tools">
        <div className="tools-grid">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="tools-card" aria-label={tool.title}>
              <div className="tools-card-header">
                <div className="tools-card-top">
                  <span className="tools-card-icon">{tool.icon}</span>
                  {tool.badge ? <span className="tools-badge">{tool.badge}</span> : null}
                </div>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
              </div>
              <div className="tools-card-actions">
                <span className="tools-open-btn">Open Tool</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
