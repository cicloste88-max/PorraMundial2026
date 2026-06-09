/* Shared shell pieces for both variants. Exports to window. */
const { signOf, label, fmt, signText } = window.PCutil;

function Flag({ code, className }) {
  return <div className={'pc-flag ' + (className || '')} data-c={code} aria-label={code}></div>;
}

function ScreenNav({ title, back }) {
  return (
    <nav className="pc-nav">
      <button className="pc-nav__back" type="button">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>
        <span>{back || 'Ficha'}</span>
      </button>
      <div className="pc-nav__title">{title || 'La comunidad opina'}</div>
      <div className="pc-nav__spacer"></div>
    </nav>
  );
}

function ScreenHero({ m, state }) {
  const final = state === 'final';
  return (
    <React.Fragment>
      <div className="pc-meta">
        <div className="pc-meta__eyebrow">{m.eyebrow}</div>
        <div className="pc-meta__time">{final ? 'Finalizado' : m.time}</div>
        <div className="pc-meta__stadium">{m.stadium}</div>
      </div>
      <div className="pc-hero">
        <div className="pc-team pc-team--a">
          <Flag code={m.home.code} className="pc-team__flag" />
          <div className="pc-team__name">{m.home.name}</div>
          <div className="pc-team__sub">Local</div>
        </div>
        <div className={'pc-score' + (final ? ' pc-score--final' : '')}>
          <div className="pc-score__label">{final ? 'Resultado' : 'Por jugar'}</div>
          <div className={'pc-score__nums' + (final ? '' : ' is-empty')}>
            <span>{final ? m.real.home : '–'}</span>
            <span className="pc-score__sep">:</span>
            <span>{final ? m.real.away : '–'}</span>
          </div>
        </div>
        <div className="pc-team pc-team--b">
          <Flag code={m.away.code} className="pc-team__flag" />
          <div className="pc-team__name">{m.away.name}</div>
          <div className="pc-team__sub">Visitante</div>
        </div>
      </div>
    </React.Fragment>
  );
}

function ScreenFooter({ m, lg, state }) {
  const final = state === 'final';
  const mine = lg.myScore;
  const exact = final && mine.home === m.real.home && mine.away === m.real.away;
  const signOk = final && signOf(mine.home, mine.away) === signOf(m.real.home, m.real.away);
  return (
    <div className="pc-footer">
      <div className="pc-footer__l">
        <div className="pc-footer__lbl">{final ? 'Tu resultado' : 'Tu pronóstico'}</div>
        <div className="pc-footer__val">
          {m.home.code} <b>{mine.home}–{mine.away}</b> {m.away.code}
          {final && (exact
            ? <span className="pc-chip-ok"> · ✓ Exacto</span>
            : signOk ? <span className="pc-chip-ok"> · ✓ Signo</span> : <span style={{ color: 'var(--ink-500)' }}> · Fallado</span>)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Flag, ScreenNav, ScreenHero, ScreenFooter });
