/* 3案共通のデータ層：研究・学習・観測のデータをブラウザ内(localStorage)に保存する */
(function () {
  const KEY = 'future-lab-v1';
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 9);

  const seed = () => ({
    research: [
      { id: 'r1', title: '睡眠と集中力の関係', stage: '実験', tags: ['健康', '学習効率'], updated: '2026-11-20',
        hypothesis: '就寝時刻を一定にすると、翌日の勉強時の集中時間が伸びる。',
        survey: '睡眠負債と認知機能に関する文献を3本読む。体内時計の仕組みを整理。',
        experiment: '2週間、23:30就寝で固定。毎日ポモドーロ数を記録する。',
        conclusion: '' },
      { id: 'r2', title: '少子化はなぜ止まらないのか', stage: '調査', tags: ['人口', '社会'], updated: '2026-11-15',
        hypothesis: '経済的要因より「将来の見通し」の不安が大きく影響している。',
        survey: '出生数の推移を世界観測室に保存。各国の家族政策を比較中。',
        experiment: '', conclusion: '' },
      { id: 'r3', title: '複利で考える自己投資', stage: '結論', tags: ['お金', '学習効率'], updated: '2026-10-30',
        hypothesis: '毎日1%の改善は1年で約37倍になる、は現実の学習にも当てはまるか。',
        survey: '学習曲線・習慣化の研究を調べた。',
        experiment: '英単語学習を3か月継続し、定着率を計測。',
        conclusion: '伸びは直線ではなく停滞期がある。ただし継続した人ほど後半で加速した。' }
    ],
    skills: [
      { id: 's1', name: '数学的思考', level: 55, area: '基礎学力', tags: ['論理'] },
      { id: 's2', name: '英語', level: 48, area: '基礎学力', tags: ['言語'] },
      { id: 's3', name: '文章力', level: 62, area: '表現', tags: ['言語'] },
      { id: 's4', name: 'お金の知識', level: 35, area: '社会', tags: ['お金'] },
      { id: 's5', name: 'データ分析', level: 30, area: 'IT', tags: ['統計', '人口'] },
      { id: 's6', name: '健康管理', level: 50, area: '生活', tags: ['健康'] }
    ],
    logs: [
      { id: 'l1', date: '2026-11-23', skill: 's2', minutes: 40, note: '長文読解1題' },
      { id: 'l2', date: '2026-11-22', skill: 's1', minutes: 60, note: '確率の基礎' },
      { id: 'l3', date: '2026-11-22', skill: 's4', minutes: 25, note: '複利と単利' },
      { id: 'l4', date: '2026-11-21', skill: 's3', minutes: 30, note: '要約の練習' },
      { id: 'l5', date: '2026-11-20', skill: 's5', minutes: 45, note: '平均と中央値の違い' }
    ],
    series: [
      { id: 'o1', title: '日本の出生数', unit: '万人', source: '厚生労働省 人口動態統計（概数・サンプル）', tags: ['人口', '社会'],
        points: [['2000', 119.1], ['2005', 106.3], ['2010', 107.1], ['2015', 100.6], ['2020', 84.1], ['2022', 77.1], ['2023', 72.7], ['2024', 68.6]] },
      { id: 'o2', title: '世界人口', unit: '億人', source: '国連 World Population Prospects（概数・サンプル）', tags: ['人口'],
        points: [['2000', 61.5], ['2005', 65.4], ['2010', 69.9], ['2015', 74.3], ['2020', 78.4], ['2024', 81.6]] },
      { id: 'o3', title: '日本の総人口', unit: '億人', source: '総務省 人口推計（概数・サンプル）', tags: ['人口', '社会'],
        points: [['2000', 1.269], ['2005', 1.278], ['2010', 1.281], ['2015', 1.271], ['2020', 1.261], ['2024', 1.238]] }
    ],
    visions: [
      { id: 'v1', when: '1年後', text: '研究テーマを5つ結論まで持っていく' },
      { id: 'v2', when: '5年後', text: 'データで社会課題を語れる人になる' },
      { id: 'v3', when: '10年後', text: '自分の研究を仕事にしている' }
    ],
    journal: []
  });

  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { data = seed(); }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

  /* タグを共有している他の部屋のアイテムを探す＝「相互につながる」仕組み */
  function allItems() {
    return [
      ...data.research.map(x => ({ room: 'research', id: x.id, title: x.title, tags: x.tags })),
      ...data.skills.map(x => ({ room: 'learning', id: x.id, title: x.name, tags: x.tags })),
      ...data.series.map(x => ({ room: 'observe', id: x.id, title: x.title, tags: x.tags }))
    ];
  }
  function related(id) {
    const me = allItems().find(i => i.id === id);
    if (!me) return [];
    return allItems().filter(i => i.id !== id && i.tags.some(t => me.tags.includes(t)));
  }

  /* 依存なしの折れ線グラフ(SVG) */
  function lineChart(series, { w = 520, h = 200, color = 'currentColor', grid = 'rgba(128,128,128,.25)' } = {}) {
    const pts = series.points;
    if (!pts.length) return '<p>データがまだありません</p>';
    const pad = { l: 44, r: 14, t: 14, b: 28 };
    const vs = pts.map(p => +p[1]);
    let min = Math.min(...vs), max = Math.max(...vs);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min; min -= span * 0.1; max += span * 0.1;
    const x = i => pad.l + (pts.length === 1 ? 0 : i * (w - pad.l - pad.r) / (pts.length - 1));
    const y = v => pad.t + (max - v) * (h - pad.t - pad.b) / (max - min);
    const fmt = v => (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(0));
    let g = '';
    for (let k = 0; k <= 3; k++) {
      const v = min + (max - min) * k / 3, yy = y(v);
      g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}" stroke="${grid}"/>` +
           `<text x="${pad.l - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity=".6">${fmt(v)}</text>`;
    }
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(+p[1])}`).join('');
    const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(+p[1])}" r="3.5" fill="${color}"><title>${p[0]}: ${p[1]}${series.unit}</title></circle>` +
      `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">${p[0]}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${series.title}">${g}<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
  }

  function change(series) {
    const p = series.points; if (p.length < 2) return null;
    const a = +p[0][1], b = +p[p.length - 1][1];
    return { from: p[0][0], to: p[p.length - 1][0], pct: ((b - a) / a * 100) };
  }

  function streak() {
    const days = new Set(data.logs.map(l => l.date));
    let n = 0, d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.Lab = {
    get data() { return data; }, save, uid, today, related, allItems, lineChart, change, streak, esc,
    STAGES: ['仮説', '調査', '実験', '結論'],
    ROOMS: { research: '総合研究室', learning: '学習室', observe: '世界観測室' },
    reset() { data = seed(); save(); }
  };
})();
