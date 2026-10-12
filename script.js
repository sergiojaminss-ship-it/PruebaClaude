(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E A D G B E, afinación estándar
  const INTERVALS = ['T', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // null = cuerda apagada, 0 = cuerda al aire. Orden: cuerda 6 a cuerda 1.
  const CHORDS = [
    { id: 'am7', name: 'Am7 / C/A', frets: [null, 0, 2, 0, 1, 0], root: 9,
      readings: 'Con el La en el bajo se oye Am7. Las notas agudas (E G C E) forman por sí solas una tríada de Do mayor, así que también puede leerse como C/A.' },
    { id: 'cmaj7', name: 'Cmaj7', frets: [null, 3, 2, 0, 0, 0], root: 0,
      readings: 'Lectura directa: Do mayor con séptima mayor. Las notas agudas E G B forman Mi menor, por lo que también puede oírse como Em sobre bajo Do.' },
    { id: 'cadd9', name: 'Cadd9', frets: [null, 3, 2, 0, 3, 0], root: 0,
      readings: 'Tríada de Do mayor con novena añadida (Re) y sin séptima. La novena da color sin crear una tensión que pida resolverse.' },
    { id: 'em9', name: 'Em9', frets: [0, 2, 2, 0, 3, 2], root: 4,
      readings: 'Mi menor con séptima y novena. Las notas G B D F# forman Gmaj7, así que se puede leer como Gmaj7 sobre bajo Mi.' },
    { id: 'dsus2', name: 'Dsus2', frets: [null, null, 0, 2, 3, 0], root: 2,
      readings: 'No contiene tercera: no es mayor ni menor. Esa ausencia deja abierta la lectura, que depende de lo que suceda antes y después.' },
    { id: 'cuartal', name: 'Cuartal A D G C', frets: [null, 0, 0, 0, 1, null], root: 9,
      readings: 'Cuatro notas apiladas por cuartas justas. No se organiza por terceras. Puede leerse como Am7(11) sin quinta, o como un bloque de cuartas sin centro fijo.' }
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fretToMidi(stringIndex, fret) { return OPEN_MIDI[stringIndex] + fret; }

  function pitchClasses(frets) {
    return frets.map((f, i) => (f === null ? null : fretToMidi(i, f))).filter(m => m !== null);
  }

  function noteNames(frets) {
    const seen = [];
    pitchClasses(frets).forEach(m => { const n = NOTES[m % 12]; if (!seen.includes(n)) seen.push(n); });
    return seen;
  }

  function intervalNames(frets, rootPc) {
    const seen = [];
    pitchClasses(frets).forEach(m => {
      const iv = INTERVALS[(m - rootPc + 120) % 12];
      if (!seen.includes(iv)) seen.push(iv);
    });
    return seen;
  }

  // Diagrama SVG: 6 cuerdas verticales (grave a la izquierda), 5 casillas.
  function buildDiagram(frets, label) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 140 170');
    svg.setAttribute('class', 'diagram');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
    const x = i => 20 + i * 20, y = r => 30 + r * 26;
    let s = '';
    for (let i = 0; i < 6; i++) s += `<path class="g" d="M${x(i)} 30V160"/>`;
    for (let r = 0; r <= 5; r++) s += `<path class="g${r === 0 ? ' nut' : ''}" d="M20 ${y(r)}H120"/>`;
    frets.forEach((f, i) => {
      if (f === null) s += `<path class="mute" d="M${x(i) - 5} 14l10 10m0-10l-10 10"/>`;
      else if (f === 0) s += `<circle class="open" cx="${x(i)}" cy="19" r="5"/>`;
      else s += `<circle class="dot" cx="${x(i)}" cy="${y(f - 1) + 13}" r="8"/><text x="${x(i)}" y="${y(f - 1) + 16}" style="fill:#FAF9F5">${f}</text>`;
    });
    svg.innerHTML = s;
    return svg;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function factList(items) {
    const dl = el('dl', 'facts');
    items.forEach(([k, v]) => { dl.append(el('dt', null, k), el('dd', null, v)); });
    return dl;
  }

  // Sonido opcional: tonos triangulares sintetizados, solo al pulsar el botón.
  let audioCtx = null;
  function playChord(frets) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let t = audioCtx.currentTime;
    frets.forEach((f, i) => {
      if (f === null) return;
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (fretToMidi(i, f) - 69) / 12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 1.7);
      t += 0.07;
    });
  }

  function chordPanel(chord) {
    const panel = el('article', 'panel');
    panel.append(el('h3', null, chord.name));
    panel.append(buildDiagram(chord.frets, `Diagrama de ${chord.name}. De la cuerda 6 a la 1: ${chord.frets.map(f => f === null ? 'apagada' : f === 0 ? 'al aire' : 'traste ' + f).join(', ')}.`));
    const btn = el('button', 'plain sound', 'Escuchar tonos sintetizados');
    btn.type = 'button';
    btn.addEventListener('click', () => playChord(chord.frets));
    panel.append(btn);
    panel.append(factList([
      ['Notas', noteNames(chord.frets).join(' ')],
      ['Intervalos desde ' + NOTES[chord.root], intervalNames(chord.frets, chord.root).join(' ')],
      ['Posibles lecturas', chord.readings],
      ['Estatus', 'Ejemplo pedagógico ilustrativo. No es una digitación histórica.']
    ]));
    return panel;
  }

  function initExplorer() {
    const buttons = $('#chord-buttons'), select = $('#compare-select'), panels = $('#panels'), empty = $('#empty'), reset = $('#reset');
    if (!buttons || !select || !panels || !empty) return;
    const state = { main: null, other: null };

    CHORDS.forEach(c => {
      const b = el('button', null, c.name);
      b.type = 'button'; b.dataset.id = c.id; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { state.main = state.main === c.id ? null : c.id; render(); });
      buttons.append(b);
      const o = el('option', null, c.name); o.value = c.id; select.append(o);
    });
    select.addEventListener('change', () => { state.other = select.value || null; render(); });
    if (reset) reset.addEventListener('click', () => { state.main = state.other = null; select.value = ''; render(); });

    function render() {
      $$('button', buttons).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === state.main)));
      panels.replaceChildren();
      [state.main, state.other].filter(Boolean).forEach(id => panels.append(chordPanel(CHORDS.find(c => c.id === id))));
      empty.hidden = panels.children.length > 0;
    }
    render();
  }

  // Laboratorio: mismas cuerdas 4, 3 y 1; cambian bajo y nota de la cuerda 2.
  function initLab() {
    const out = $('#lab-out');
    if (!out) return;
    const NAMES = { A1: 'Am7 (o C/A)', C1: 'Do mayor', C0: 'Cmaj7', C3: 'Cadd9', E1: 'C/E' };
    const BASS = { A: [null, 0, 2, 0], C: [null, 3, 2, 0], E: [0, null, 2, 0] };

    function render() {
      const bass = $('input[name="bass"]:checked').value, top = Number($('input[name="top"]:checked').value);
      const frets = [...BASS[bass], top, 0];
      const bassMidi = Math.min(...pitchClasses(frets));
      const bassPc = bassMidi % 12;
      const ivs = intervalNames(frets, bassPc);
      const name = NAMES[bass + top];
      out.replaceChildren(
        buildDiagram(frets, `Diagrama del laboratorio con bajo en ${bass}`),
        factList([
          ['Notas', noteNames(frets).join(' ')],
          ['Intervalos sobre el bajo (' + NOTES[bassPc] + ')', ivs.join(' ')],
          ['Lectura', name ? `Se reconoce como ${name}.` : 'No tiene un nombre convencional único. Varias lecturas son posibles según el contexto.'],
          ['Qué observar', 'Canta una melodía sobre estas notas. Fíjate si el bajo confirma o contradice el centro que sugieren las voces agudas.']
        ])
      );
    }
    $$('input[name="bass"], input[name="top"]').forEach(i => i.addEventListener('change', render));
    render();
  }

  function initReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    items.forEach(i => io.observe(i));
  }

  function initSectionIndicator() {
    const links = $$('.top nav a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + e.target.id)));
    }), { rootMargin: '-40% 0px -55% 0px' });
    links.forEach(l => { const s = $(l.getAttribute('href')); if (s) io.observe(s); });
  }

  initExplorer();
  initLab();
  initReveal();
  initSectionIndicator();
})();