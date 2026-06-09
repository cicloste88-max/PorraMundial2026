/* VARIANTE B — Espaciosa / donut + podio */
(function () {
  const { signOf, label, fmt } = window.PCutil;

  function Donut({ lg, m }) {
    const { p1, pX, p2 } = lg.sign;
    const a = p1, b = p1 + pX;
    const dominant = Math.max(p1, pX, p2);
    const domSign = p1 === dominant ? '1' : pX === dominant ? 'X' : '2';
    const grad = `conic-gradient(var(--team-a) 0 ${a}%, var(--ink-400) ${a}% ${b}%, var(--team-b) ${b}% 100%)`;
    return (
      <div className="b-sign">
        <div className="b-donut" style={{ background: grad }}>
          <div className="b-donut__center">
            <div className="b-donut__pct">{dominant}%</div>
            <div className="b-donut__lbl">{domSign === '1' ? m.home.code : domSign === '2' ? m.away.code : 'Empate'}</div>
          </div>
        </div>
        <div className="b-signleg">
          <div className={'b-signleg__row' + (lg.myPick === '1' ? ' mine' : '')}>
            <span className="b-signleg__dot b-signleg__dot--1"></span>
            <span className="b-signleg__name">{m.home.name} gana</span>
            <span className="b-signleg__pct">{p1}%</span>
          </div>
          <div className={'b-signleg__row' + (lg.myPick === 'X' ? ' mine' : '')}>
            <span className="b-signleg__dot b-signleg__dot--x"></span>
            <span className="b-signleg__name">Empate</span>
            <span className="b-signleg__pct">{pX}%</span>
          </div>
          <div className={'b-signleg__row' + (lg.myPick === '2' ? ' mine' : '')}>
            <span className="b-signleg__dot b-signleg__dot--2"></span>
            <span className="b-signleg__name">{m.away.name} gana</span>
            <span className="b-signleg__pct">{p2}%</span>
          </div>
        </div>
      </div>
    );
  }

  function Podium({ lg, m, final }) {
    const top = lg.scores[0];
    const rest = lg.scores.slice(1);
    const max = Math.max(...lg.scores.map(s => s.count));
    const topExact = final && top.home === m.real.home && top.away === m.real.away;
    return (
      <div className="b-podium">
        <div className={'b-top' + (topExact ? ' is-exact' : '')}>
          <div className="b-top__head">
            <span className="b-top__rank">#1 · Más jugado</span>
            {topExact && <span className="a-tag a-tag--exact">✓ Exacto</span>}
          </div>
          <div className="b-top__main">
            <span className="b-top__score">{label(top.home, top.away)}</span>
            <span className="b-top__count">
              <span className="b-top__countnum">{top.count}</span>
              <span className="b-top__countlbl">jugadores</span>
            </span>
          </div>
          <div className="b-names">
            {top.players.map((p, i) => <span key={i} className="b-name">{p}</span>)}
          </div>
        </div>
        <div className="b-rest">
          {rest.map((s, i) => {
            const sign = signOf(s.home, s.away);
            const exact = final && s.home === m.real.home && s.away === m.real.away;
            return (
              <div key={i} className={'b-restrow sign' + sign + (exact ? ' is-exact' : '')}>
                <span className="b-restrow__rank">{i + 2}</span>
                <span className="b-restrow__score">{label(s.home, s.away)}{exact && ' ✓'}</span>
                <span className="b-restrow__track"><span className="b-restrow__fill" style={{ width: (s.count / max * 100) + '%' }}></span></span>
                <span className="b-restrow__cnt">{s.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function GlobalHero({ g, m }) {
    return (
      <div className="b-global">
        <div className="b-global__num">{fmt(g.total)}</div>
        <div className="b-global__sub">pronósticos en toda la porra</div>
        <div className="b-global__cards">
          <div className="b-gcard">
            <span className="b-gcard__k">Signo más elegido</span>
            <span className="b-gcard__v">{g.sign.winner === '1' ? m.home.code : g.sign.winner === '2' ? m.away.code : 'X'}</span>
            <span className="b-gcard__pct">{g.sign.pct}%</span>
          </div>
          <div className="b-gcard">
            <span className="b-gcard__k">Marcador top</span>
            <span className="b-gcard__v">{label(g.topScore.home, g.topScore.away)}</span>
            <span className="b-gcard__pct">{g.topScore.pct}%</span>
          </div>
        </div>
      </div>
    );
  }

  function IAcard({ ia, m, final }) {
    const hit = final && ia.score.home === m.real.home && ia.score.away === m.real.away;
    return (
      <div className="b-ia">
        <div className="b-ia__badge">✦</div>
        <div className="b-ia__k">Resultado más probable · IA + estadística</div>
        <div className="b-ia__score">{ia.score.home} – {ia.score.away}</div>
        <div className="b-ia__ring">
          <div className="b-ia__bartrack"><div className="b-ia__barfill" style={{ width: ia.confidence + '%' }}></div></div>
          <span className="b-ia__conf">{ia.confidence}%</span>
        </div>
        {hit && <div className="b-ia__hit">✓ La IA clavó el marcador</div>}
      </div>
    );
  }

  function ScreenB({ state }) {
    const { match: m, league: lg, global: g, ia } = window.PC;
    const final = state === 'final';
    return (
      <div className="pc-screen">
        <ScreenNav />
        <ScreenHero m={m} state={state} />
        <div className="pc-body">
          <section className="pc-section">
            <div className="pc-section__title">Signo · tu liga <span className="pc-section__count">{lg.total} votos</span></div>
            <Donut lg={lg} m={m} />
          </section>
          <section className="pc-section">
            <div className="pc-section__title">Marcadores más jugados <span className="pc-section__count">ranking ↓</span></div>
            <Podium lg={lg} m={m} final={final} />
          </section>
          <section className="pc-section">
            <div className="pc-section__title">Tendencia global</div>
            <GlobalHero g={g} m={m} />
          </section>
          <section className="pc-section">
            <div className="pc-section__title">Pronóstico de la IA</div>
            <IAcard ia={ia} m={m} final={final} />
          </section>
        </div>
        <ScreenFooter m={m} lg={lg} state={state} />
      </div>
    );
  }

  window.ScreenB = ScreenB;
})();
