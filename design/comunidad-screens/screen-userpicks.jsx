/* SCREEN · Porra de un jugador — pronósticos agrupados por jornada/fase
   Puntuación oficial: 4 chips por partido (Signo +1 · vs IA +1 · Goleador +2 · Exacto +3). */
(function () {
  const { signOf, chips } = window.PCutil;
  const { useState } = React;

  // puntos confirmados de una jornada (solo partidos 'final')
  function jornadaPts(j) {
    return j.matches.filter(m => m.phase === 'final').reduce((s, m) => s + chips.call(window.PCutil, m).pts, 0);
  }

  function ChipTag({ on, gold, children }) {
    return <span className={'up-chip' + (on ? ' on' : '') + (on && gold ? ' gold' : '')}>{children}</span>;
  }

  function MatchCard({ m }) {
    const isFinal = m.phase === 'final';
    const isLive = m.phase === 'live';
    const c = isFinal ? chips.call(window.PCutil, m, m.real)
      : isLive ? chips.call(window.PCutil, m, m.live) : null;
    const cls = ['up-match'];
    if (isFinal) cls.push(c.pts > 0 ? (c.exact ? 'k-exact' : 'k-sign') : 'k-fail');
    else cls.push(m.phase);

    const status = isFinal ? 'Final'
      : isLive ? <React.Fragment><span className="dot"></span>En vivo · {m.time}</React.Fragment>
      : m.time;

    return (
      <div className={cls.join(' ')}>
        <div className="up-match__head">
          <span className="up-match__status">{status}</span>
          {m.boost && <span className="up-boost">⚡ Boost ×2</span>}
        </div>
        <div className="up-match__teams">
          <div className="up-team up-team--home">
            <Flag code={m.home.c} className="up-team__flag" />
            <span className="up-team__code">{m.home.c}</span>
          </div>
          <div className="up-pred">
            <span className="up-pred__lbl">Pronóstico</span>
            <span className="up-pred__score">{m.pred.h}<span className="up-pred__sep">–</span>{m.pred.a}</span>
          </div>
          <div className="up-team up-team--away">
            <span className="up-team__code">{m.away.c}</span>
            <Flag code={m.away.c} className="up-team__flag" />
          </div>
        </div>

        {m.scorer && (
          <div className="up-scorer">⚽ Goleador: <b className={isFinal && c.gol ? 'gol-ok' : ''}>{m.scorer}</b>{isFinal && c.gol ? ' ✓' : ''}</div>
        )}

        {(isFinal || isLive) && (
          <div className="up-chips">
            <ChipTag on={c.signo}>Signo +1</ChipTag>
            <ChipTag on={c.vsIA}>vs IA +1</ChipTag>
            <ChipTag on={c.gol}>⚽ Gol +2</ChipTag>
            <ChipTag on={c.exact} gold>Exacto +3</ChipTag>
          </div>
        )}

        <div className="up-match__foot">
          {isFinal ? (<React.Fragment>
            <span className="up-foot__real">Resultado <b>{m.real.h}–{m.real.a}</b></span>
            <span className="up-foot__pts">{c.pts} pts{c.boosted ? ' · ⚡×2' : ''}</span>
          </React.Fragment>) : isLive ? (<React.Fragment>
            <span className="up-foot__real">En directo <b>{m.live.h}–{m.live.a}</b></span>
            <span className="up-foot__pts">{c.pts} pts prov.</span>
          </React.Fragment>) : (
            <span className="up-foot__real">Aún por jugar</span>
          )}
        </div>
      </div>
    );
  }

  const STATE_LABEL = { done: 'Cerrada', live: 'En juego', upcoming: 'Próximamente' };

  function ScreenUserPicks() {
    const uc = window.PC.userCard;
    const [active, setActive] = useState('j2');
    const aj = uc.jornadas.find(j => j.id === active);

    const settled = uc.jornadas.reduce((a, j) => a.concat(j.matches.filter(m => m.phase === 'final')), []);
    const totalPts = uc.jornadas.reduce((s, j) => s + jornadaPts(j), 0);
    const exactos = settled.filter(m => chips.call(window.PCutil, m, m.real).exact).length;
    const ajPts = jornadaPts(aj);
    const ajSettled = aj.matches.filter(m => m.phase === 'final').length;

    return (
      <div className="pc-screen up-app">
        <div className="up-fixed">
          <ScreenNav title={'Porra de ' + uc.user.name} back="Liga" />

          <div className="up-profile">
            <div className="up-avatar">{uc.user.initials}</div>
            <div className="up-id">
              <div className="up-id__name">{uc.user.name}</div>
              <div className="up-id__meta">{uc.user.league} · <b>Tú</b></div>
            </div>
          </div>

          <div className="up-stats">
            <div className="up-stat"><span className="up-stat__num"><b>{totalPts}</b></span><span className="up-stat__lbl">Puntos torneo</span></div>
            <div className="up-stat"><span className="up-stat__num">#{uc.rank}</span><span className="up-stat__lbl">de {uc.totalPlayers} · liga</span></div>
            <div className="up-stat"><span className="up-stat__num">{exactos}<small style={{ fontSize: '12px', color: 'var(--ink-500)' }}>/{settled.length}</small></span><span className="up-stat__lbl">Exactos</span></div>
          </div>

          <div className="up-tabs">
            {uc.jornadas.map(j => (
              <button key={j.id} type="button" className={['up-tab', j.state, active === j.id ? 'active' : ''].join(' ')} onClick={() => setActive(j.id)}>
                <span className="up-tab__t">{j.short}</span>
                <span className="up-tab__s">{j.state === 'done' ? jornadaPts(j) + ' pts' : j.state === 'live' ? 'en juego' : 'próx.'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="up-scroll">
          <div className="pc-body">
            <div className="up-jornada">{aj.label} <span>{aj.dates} · {STATE_LABEL[aj.state]}{ajSettled ? ' · ' + ajPts + ' pts' : ''}</span></div>
            <div className="up-list">
              {aj.matches.map((m, i) => <MatchCard key={i} m={m} />)}
            </div>
          </div>
        </div>

        <div className="pc-footer">
          <div className="pc-footer__l">
            <div className="pc-footer__lbl">Total torneo · posición #{uc.rank}</div>
            <div className="pc-footer__val"><b>{totalPts}</b> pts · {exactos} exactos</div>
          </div>
        </div>
      </div>
    );
  }

  window.ScreenUserPicks = ScreenUserPicks;
})();
