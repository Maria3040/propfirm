export default function StubPage({
  title,
  blurb,
}: {
  title: string;
  blurb?: string;
}) {
  return (
    <div className="app-stub">
      <h1>{title}</h1>
      <p>{blurb || 'This section is a demo placeholder matching the FundingPips navigation.'}</p>
    </div>
  );
}
