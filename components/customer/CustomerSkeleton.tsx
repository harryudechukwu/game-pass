const PREVIEW_ROWS = [0, 1, 2];
const LIST_ROWS = [0, 1, 2, 3];

function SkeletonRows({ rows }: { rows: number[] }) {
  return rows.map((row) => (
    <div key={row} className="gp-item gp-skel-row">
      <div className="skel gp-skel-tile" />
      <div className="gp-skel-row-copy">
        <div className="skel gp-skel-row-title" />
        <div className="skel gp-skel-row-subtitle" />
      </div>
      <div className="skel gp-skel-row-amount" />
    </div>
  ));
}

function SkeletonSection({ rows }: { rows: number[] }) {
  return (
    <section className="gp-sec">
      <div className="gp-sec-head gp-skel-section-head">
        <div className="skel gp-skel-section-title" />
        <div className="skel gp-skel-section-link" />
      </div>
      <SkeletonRows rows={rows} />
    </section>
  );
}

export function CustomerSkeleton({ pathname }: { pathname: string }) {
  const isHome = pathname === "/home";
  const page = (
    <>
      <header className="gp-head">
        {!isHome && <div className="skel gp-skel-back" />}
        <div className="skel gp-skel-greeting" />
        <div className="skel gp-skel-subtitle" />
      </header>

      <div className="gp-sheet">
        {isHome ? (
          <>
            <div className="gp-hero gp-skel-hero">
              <div className="gp-hero-inner">
                <div className="skel gp-skel-hero-label" />
                <div className="skel gp-skel-hero-amount" />
              </div>
            </div>
            <SkeletonSection rows={PREVIEW_ROWS} />
            <SkeletonSection rows={[0]} />
          </>
        ) : <SkeletonRows rows={LIST_ROWS} />}
      </div>
    </>
  );

  return (
    <div className="gp-app gp-app--shell gp-skeleton" role="status" aria-label="Loading your account" aria-busy="true">
      <aside className="gp-sidebar" aria-hidden="true">
        <div className="gp-side-logo">
          <div className="skel gp-skel-side-icon" />
          <div className="skel gp-skel-side-title" />
        </div>
        <div className="gp-side-nav">
          <div className="gp-skel-side-link"><div className="skel gp-skel-side-icon" /><div className="skel gp-skel-side-label" /></div>
          <div className="gp-skel-side-link"><div className="skel gp-skel-side-icon" /><div className="skel gp-skel-side-label" /></div>
        </div>
      </aside>

      <div className="gp-topbar" aria-hidden="true" />
      <div className="gp-hamburger gp-skel-mobile-menu" aria-hidden="true"><div className="skel gp-skel-mobile-mark" /></div>

      <div className="gp-main" aria-hidden="true">
        {page}
      </div>
    </div>
  );
}
