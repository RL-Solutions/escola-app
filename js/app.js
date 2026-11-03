/* Escola App: PWA mobile-first com três perfis sobre Supabase.
   Sem framework: cache em `db` (ver api.carregar), render por string e
   delegação de eventos. */

const vazioDB = () => ({ turmas: [], alunos: [], responsaveis: [], admins: [], grade: [], comunicados: [], produtos: [], lidos: new Set() });
let db = vazioDB();
// fase: carregando | login | codigo | escolha | onboarding | app
const auth = { fase: 'carregando', email: '', user: null, vinculos: [] };
let sessao = null; // { perfil, id (membro), escolaId, escola }
let canal = null;
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TIPOS = { aviso: 'Aviso', evento: 'Evento', urgente: 'Urgente' };
const TIPO_IC = { aviso: 'megafone', evento: 'cal', urgente: 'alert' };
const ui = { anim: true, tab: null, filho: 'todos', dia: diaUtilHoje(), pessoas: 'alunos', busca: '', turma: null };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (list, id) => list.find(x => x.id === id);
const iniciais = n => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const nomeTurma = id => byId(db.turmas, id)?.nome ?? 'Turma removida';
// Cada turma ganha uma das quatro cores das pílulas da marca, na ordem da lista.
const corTurma = id => `--tc: var(--t${(db.turmas.findIndex(t => t.id === id) % 4 + 4) % 4 + 1})`;
const turmaChip = (id, sm) => `<span class="chip static ${sm ? 'sm' : ''}" style="${corTurma(id)}">${esc(nomeTurma(id))}</span>`;
const MARCA = ESCOLA_CONFIG.marca || {};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const dataLonga = () => { const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); return t[0].toUpperCase() + t.slice(1); };
// Faixa escura de marca no topo de cada tela. O primeiro bloco da tela
// (classe .lift) sobe por cima dela. render() separa a faixa pelo marcador.
const HERO_FIM = '<!--/hero-->';
const hero = (titulo, sub = '', extra = '', antes = '') => `<section class="hero${ui.anim ? ' enter' : ''}"><div class="hero-in">${antes}${sub ? `<p class="hero-k">${sub}</p>` : ''}<h1 class="hero-t">${titulo}</h1>${extra}</div></section>${HERO_FIM}`;

function diaUtilHoje() { const d = new Date().getDay(); return d >= 1 && d <= 5 ? d : 1; }
async function recarregar() {
  db = await api.carregar(sessao.escolaId, sessao.id);
  render();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  // Dentro do sheet aberto, senão o toast fica atrás da camada do modal.
  ($('#sheet').open ? $('#sheet') : document.body).appendChild(t); t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
function dataRel(iso) {
  const d = new Date(iso), dias = Math.floor((Date.now() - d) / 864e5);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 7) return `Há ${dias} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const ICONS = {
  mural: 'M4 5h16v11H8l-4 4V5Z',
  megafone: 'M3 10v4h4l7 5V5l-7 5H3Zm15-1.5a5 5 0 0 1 0 7',
  cal: 'M4 6h16v14H4V6Zm0 4h16M8 3v5m8-5v5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 10a6 6 0 0 1 12 0m1-10a3 3 0 1 0 0-6m2 16a5 5 0 0 0-3-5',
  home: 'M3 11 12 4l9 7v9h-6v-6H9v6H3v-9Z',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4V4Zm16 0h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6V4Z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  pin: 'M9 4h6l-1 6 3 3H7l3-3-1-6Zm3 9v7',
  alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v.5',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  card: 'M3 6h18v12H3V6Zm3 3h5v5H6V9Zm8 1h4m-4 3h3',
  loja: 'M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.7-2 3-4 3S8.5 5.7 8 4Z',
  sol: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  lua: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  chev: 'M9 5l7 7-7 7',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

/* ---------- Sessão ---------- */
function usuario() {
  const s = sessao; if (!s) return null;
  const lista = { admin: db.admins, pai: db.responsaveis, aluno: db.alunos }[s.perfil];
  const m = byId(lista, s.id);
  return m ? { ...m, perfil: s.perfil } : null;
}

async function iniciar() {
  if (!sb) { auth.fase = 'config'; return render(); }
  try {
    auth.user = await api.usuarioAtual();
    if (!auth.user) { auth.fase = 'login'; return render(); }
    auth.vinculos = await api.meusVinculos(auth.user.id);
    if (!auth.vinculos.length) { auth.fase = 'onboarding'; return render(); }
    const salvo = localStorageGet('escola-app:vinculo');
    const v = auth.vinculos.find(x => x.id === salvo) || (auth.vinculos.length === 1 && auth.vinculos[0]);
    if (v) return entrar(v);
    auth.fase = 'escolha'; render();
  } catch (e) { auth.fase = 'login'; render(); toast(e.message); }
}

async function entrar(v) {
  sessao = { perfil: v.perfil, id: v.id, escolaId: v.escola_id, escola: v.escola };
  localStorageSet('escola-app:vinculo', v.id);
  ui.tab = null; ui.filho = 'todos'; ui.turma = null;
  auth.fase = 'carregando'; render();
  await recarregar();
  auth.fase = 'app'; render();
  canal?.unsubscribe();
  canal = api.ouvirComunicados(sessao.escolaId, () => recarregar().catch(() => {}));
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
const filhosDe = rid => db.alunos.filter(a => a.responsavelIds.includes(rid));

const TABS = {
  aluno: [['mural', 'Mural', 'mural'], ['horario', 'Horário', 'clock'], ['perfil', 'Perfil', 'user']],
  pai: [['mural', 'Mural', 'mural'], ['horario', 'Horário', 'clock'], ['loja', 'Loja', 'loja'], ['filhos', 'Filhos', 'users']],
  admin: [['painel', 'Painel', 'home'], ['comunicados', 'Comunicados', 'mural'], ['pessoas', 'Pessoas', 'users'], ['turmas', 'Turmas', 'book']],
};

/* ---------- Render ---------- */
function render() {
  if (auth.fase !== 'app') { $('#app').innerHTML = viewAuth(); return; }
  const u = usuario();
  if (!u) { $('#app').innerHTML = viewAuth(); return; }
  const tabs = TABS[u.perfil];
  // A loja do admin abre pelo Painel, sem aba própria.
  if (!tabs.some(t => t[0] === ui.tab) && !(u.perfil === 'admin' && ui.tab === 'loja')) ui.tab = tabs[0][0];
  const views = { mural: viewMural, horario: viewHorario, perfil: viewPerfil, filhos: viewFilhos, painel: viewPainel, comunicados: viewComunicadosAdmin, pessoas: viewPessoas, turmas: viewTurmas, loja: viewLoja };
  const html = views[ui.tab](u);
  const [hero_, corpo] = html.includes(HERO_FIM) ? html.split(HERO_FIM) : ['', html];
  const naoLidos = u.perfil !== 'admin' ? muralDe(u).filter(c => !lido(c)).length : 0;
  $('#app').innerHTML = `
    <header class="top">
      <div class="top-in">
        <div class="brand">${MARCA.selo ? `<span class="selo"><img src="${MARCA.selo}" alt="" width="30" height="30"></span>` : icon('book')}<span>${esc(sessao.escola)}</span></div>
        <span class="top-acts"><button class="tema-btn" data-act="alternarTema">${iconeTema()}</button>
        <button class="avatar" data-act="conta" aria-label="Conta de ${esc(u.nome)}">${esc(iniciais(u.nome))}</button></span>
      </div>
    </header>
    ${hero_}<main class="view${ui.anim ? ' enter' : ''}" id="main">${corpo}</main>
    <nav class="tabbar" aria-label="Navegação">
      ${tabs.map(([k, l, i]) => `<button data-act="tab" data-id="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>
        <span class="tab-ic">${icon(i)}${k === 'mural' && naoLidos ? `<b class="dot">${naoLidos}</b>` : ''}</span><span>${l}</span></button>`).join('')}
    </nav>`;
  ui.anim = false;
  aplicarTema();
}

const PERFIS = { admin: 'Administração', pai: 'Responsável', aluno: 'Aluno' };

function viewAuth() {
  const topo = `<section class="hero auth"><div class="hero-in">${MARCA.logo ? `<span class="logo-plate"><img src="${MARCA.logo}" alt="${esc(MARCA.nome || 'Escola')}" width="410" height="110" fetchpriority="high"></span>` : icon('book')}
    <h1 class="hero-t">Comunicados, horários e a rotina da escola no seu celular.</h1></div></section>`;
  const f = auth.fase;
  let corpo = '';
  if (f === 'config') corpo = `<section class="card pad stack"><p><b>Falta conectar o Supabase.</b></p>
      <p class="help">Preencha <code>supabaseUrl</code> e <code>supabaseAnonKey</code> em <code>js/config.js</code>. O passo a passo está no README.</p></section>`;
  if (f === 'carregando') return `<section class="hero"><div class="hero-in"><h1 class="hero-t">&nbsp;</h1></div></section><main class="view" aria-busy="true"><span class="skel" aria-label="Carregando…"><i></i><i></i><i></i><i></i></span></main>`;
  if (f === 'login') corpo = `<form class="card pad stack" data-form="email">
      <label class="field"><span>Seu e-mail</span><input name="email" type="email" required autocomplete="email" inputmode="email" value="${esc(auth.email)}" spellcheck="false" placeholder="voce@exemplo.com"></label>
      <button class="btn primary block">Receber acesso por e-mail</button>
      <p class="help">Use o e-mail que a escola cadastrou. Não tem senha: mandamos um link (ou código) a cada acesso.</p></form>`;
  if (f === 'codigo') corpo = `<form class="card pad stack" data-form="codigo">
      <p>Enviamos um e-mail para <b>${esc(auth.email)}</b>. Abra o link nele, neste aparelho, ou digite o código se ele vier no e-mail.</p>
      <label class="field"><span>Código</span><input name="token" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" class="otp"></label>
      <button class="btn primary block">Entrar</button>
      <button type="button" class="btn ghost block" data-act="trocarEmail">Usar outro e-mail</button>
      <p class="help">Também dá para tocar no link do e-mail neste aparelho.</p></form>`;
  if (f === 'escolha') corpo = `<p class="hint">Sua conta tem mais de um acesso. Escolha qual abrir.</p>
      <section class="card list">${auth.vinculos.map(v => `<button class="row" data-act="vinculo" data-id="${v.id}">
        <span class="avatar sm">${esc(iniciais(v.nome))}</span><span class="row-main"><b>${esc(v.escola)}</b><small>${PERFIS[v.perfil]} · ${esc(v.nome)}</small></span>${icon('chev', 'muted')}</button>`).join('')}</section>
      <button class="btn ghost block" data-act="sair">${icon('logout')}Sair</button>`;
  if (f === 'onboarding') corpo = `<section class="card pad stack">
      <p><b>${esc(auth.user?.email)}</b> ainda não está cadastrado em nenhuma escola.</p>
      <p class="help">Pais e alunos: peça para a secretaria cadastrar este e-mail e entre de novo.</p></section>
      <form class="card pad stack" data-form="escola"><h2 class="h2" style="margin:0">Sou da secretaria: criar escola</h2>
      <label class="field"><span>Nome da escola</span><input name="escola" required></label>
      <label class="field"><span>Seu nome</span><input name="nome" required autocomplete="name"></label>
      <button class="btn primary block">Criar escola</button></form>
      <button class="btn ghost block" data-act="sair">${icon('logout')}Sair</button>`;
  return `${topo}<main class="login"><div class="stack lift">${corpo}</div></main>`;
}

// Formulários fora do sheet (login e criação de escola).
document.addEventListener('submit', async e => {
  const tipo = e.target.dataset.form; if (!tipo) return;
  e.preventDefault();
  const fd = new FormData(e.target), btn = e.target.querySelector('.btn.primary');
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  try {
    if (tipo === 'email') { auth.email = fd.get('email').trim(); await api.enviarCodigo(auth.email); auth.fase = 'codigo'; render(); $('.otp')?.focus(); }
    if (tipo === 'codigo') { await api.confirmarCodigo(auth.email, fd.get('token').trim()); await iniciar(); }
    if (tipo === 'escola') { await api.criarEscola(fd.get('escola').trim(), fd.get('nome').trim()); await iniciar(); toast('Escola criada. Comece pelas turmas.'); }
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
});

/* ---------- Mural (aluno e pai) ---------- */
function alunosContexto(u) {
  if (u.perfil === 'aluno') return [byId(db.alunos, u.id)];
  const filhos = filhosDe(u.id);
  return ui.filho === 'todos' ? filhos : filhos.filter(f => f.id === ui.filho);
}
function muralDe(u) {
  const ctx = alunosContexto(u);
  return db.comunicados.filter(c => visivelPara(c, u.perfil, ctx))
    .sort((a, b) => (b.fixado - a.fixado) || b.data.localeCompare(a.data));
}
const lido = c => db.lidos.has(c.id);

function seletorFilhos(u, comTodos) {
  const filhos = filhosDe(u.id);
  if (!comTodos && ui.filho === 'todos') ui.filho = filhos[0]?.id;
  if (filhos.length < 2 && comTodos) return '';
  return `<div class="chips scroll" role="tablist" aria-label="Filho">
    ${comTodos ? `<button class="chip" data-act="filho" data-id="todos" aria-pressed="${ui.filho === 'todos'}">Todos</button>` : ''}
    ${filhos.map(f => `<button class="chip" data-act="filho" data-id="${f.id}" aria-pressed="${ui.filho === f.id}">${esc(f.nome.split(' ')[0])}</button>`).join('')}
  </div>`;
}

function cardComunicado(c, u, admin) {
  let sobre = '';
  if (u?.perfil === 'pai') {
    const quem = filhosDe(u.id).filter(f => atingeAluno(c, f)).map(f => f.nome.split(' ')[0]);
    if (quem.length) sobre = `<small class="meta">Sobre: ${esc(quem.join(', '))}</small>`;
  }
  if (admin) {
    const r = alcance(db, c);
    sobre = `<small class="meta">${esc(descPublico(c))}</small><small class="meta">Alcança ${plural(r.alunos + r.pais, 'pessoa', 'pessoas')}, lido por ${c.leituras}</small>`;
  }
  const novo = !admin && !lido(c);
  return `<button class="card post ${c.tipo} ${novo ? 'unread' : ''}" data-act="${admin ? 'editarCom' : 'abrirCom'}" data-id="${c.id}">
    <span class="post-ic">${icon(TIPO_IC[c.tipo])}</span><span class="post-body">
    <span class="post-top"><span class="kind">${TIPOS[c.tipo]}</span>${c.fixado ? `<span class="pin">${icon('pin')}Fixado</span>` : ''}<time datetime="${c.data}">${dataRel(c.data)}</time>${novo ? '<span class="sr">Não lido.</span>' : ''}</span>
    <b class="post-t">${esc(c.titulo)}</b>
    <span class="post-x">${esc(c.texto)}</span>
    ${sobre}</span>
  </button>`;
}

function viewMural(u) {
  const lista = muralDe(u);
  const nome = u.nome.split(' ')[0];
  const novos = lista.filter(c => !lido(c)).length;
  return `${hero(`Olá, ${esc(nome)}`, dataLonga(), u.perfil === 'pai' ? seletorFilhos(u, true) : '')}
    ${proximaAula(u) || `<div class="card next lift"><span class="next-ic">${icon('mural')}</span><span class="next-main"><small>Mural</small>
      <b>${novos ? plural(novos, 'comunicado novo', 'comunicados novos') : 'Tudo em dia'}</b><span>${novos ? 'Marcados com um ponto colorido.' : 'Você já leu todos os comunicados.'}</span></span></div>`}
    <h2 class="h2">Comunicados</h2>
    ${lista.length ? `<div class="stack">${lista.map(c => cardComunicado(c, u)).join('')}</div>` : vazio('Nenhum comunicado por aqui.')}`;
}
const vazio = t => `<p class="empty">${esc(t)}</p>`;

/* ---------- Horário ---------- */
function aulasDe(aluno, dia) {
  return db.grade.filter(g => g.dia === dia && aluno.turmaIds.includes(g.turmaId)).sort((a, b) => a.inicio.localeCompare(b.inicio));
}
const agoraHM = () => new Date().toTimeString().slice(0, 5);

function proximaAula(u) {
  const aluno = u.perfil === 'aluno' ? byId(db.alunos, u.id) : (ui.filho !== 'todos' ? byId(db.alunos, ui.filho) : null);
  if (!aluno) return '';
  const hoje = new Date().getDay(), hm = agoraHM();
  const aula = aulasDe(aluno, hoje).find(g => g.fim > hm);
  if (!aula) return '';
  const emCurso = aula.inicio <= hm;
  const min = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const pct = emCurso ? Math.round((min(hm) - min(aula.inicio)) / (min(aula.fim) - min(aula.inicio)) * 100) : 0;
  return `<div class="card next lift"><span class="next-ic">${icon('clock')}</span><span class="next-main">
    <small>${emCurso ? 'Agora' : 'Próxima aula'}${u.perfil === 'pai' ? ', ' + esc(aluno.nome.split(' ')[0]) : ''}</small>
    <b>${esc(aula.disciplina)}</b><span>${aula.inicio} às ${aula.fim}${aula.sala ? ', ' + esc(aula.sala) : ''}</span></span>
    ${emCurso ? `<span class="next-bar" style="--p: ${pct}%" role="progressbar" aria-label="Andamento da aula" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></span>` : ''}</div>`;
}

function viewHorario(u) {
  const aluno = u.perfil === 'aluno' ? byId(db.alunos, u.id) : byId(db.alunos, (seletorFilhos(u, false), ui.filho));
  if (!aluno) return `${hero('Horário')}<div class="lift">${vazio('Nenhum aluno vinculado a esta conta.')}</div>`;
  const aulas = aulasDe(aluno, ui.dia);
  const hoje = new Date().getDay(), hm = agoraHM();
  return `${hero('Horário', esc(aluno.turmaIds.map(nomeTurma).join(', ') || 'Sem turma'), u.perfil === 'pai' ? seletorFilhos(u, false) : '')}
    <div class="days lift" role="tablist" aria-label="Dia da semana">
      ${[1, 2, 3, 4, 5].map(d => `<button role="tab" data-act="dia" data-id="${d}" aria-selected="${ui.dia === d}" ${d === hoje ? 'class="today"' : ''}>${DIAS[d]}</button>`).join('')}
    </div>
    <h2 class="h2">${DIAS_LONGOS[ui.dia]}${ui.dia === hoje ? ', hoje' : ''}</h2>
    ${aulas.length ? `<ol class="timeline">${aulas.map((g, i) => {
      const agora = ui.dia === hoje && g.inicio <= hm && hm < g.fim;
      const choque = aulas.some((o, j) => j !== i && o.inicio < g.fim && g.inicio < o.fim);
      return `<li class="slot ${agora ? 'now' : ''}">
        <span class="slot-h"><b>${g.inicio}</b><small>${g.fim}</small></span>
        <span class="slot-c" style="${corTurma(g.turmaId)}">${agora ? '<small class="now-tag">Agora</small>' : ''}<b>${esc(g.disciplina)}</b><small>${esc([g.professor, g.sala].filter(Boolean).join(' · '))}</small>
        <small class="tag">${esc(nomeTurma(g.turmaId))}</small>${choque ? '<small class="warn">Conflito de horário</small>' : ''}</span></li>`;
    }).join('')}</ol>` : vazio('Sem aulas neste dia.')}`;
}

/* ---------- Perfil / Filhos ---------- */
function viewPerfil(u) {
  const a = byId(db.alunos, u.id);
  return `${hero(esc(a.nome), a.matricula ? `Matrícula ${esc(a.matricula)}` : 'Aluno')}
    <button class="card carteira-cta lift" data-act="carteirinha" data-id="${a.id}"><span class="next-ic">${icon('card')}</span><span class="row-main"><b>Carteirinha estudantil</b><small>${a.ra ? `RA ${esc(a.ra)} · ` : ''}baixar em PDF</small></span>${icon('chev', 'muted')}</button>
    <div class="card pad stack"><b>Turmas</b><div class="chips">${a.turmaIds.map(t => turmaChip(t)).join('') || '<span class="muted">Sem turma</span>'}</div></div>
    <h2 class="h2">Responsáveis</h2>
    <div class="card list">${a.responsavelIds.map(id => byId(db.responsaveis, id)).filter(Boolean).map(r => `<div class="row"><span class="avatar sm">${esc(iniciais(r.nome))}</span><span class="row-main"><b>${esc(r.nome)}</b><small>${esc(r.telefone)}</small></span></div>`).join('') || '<p class="empty">Nenhum responsável cadastrado.</p>'}</div>
    ${seletorTema()}
    ${trocaDeAcesso()}
    <button class="btn ghost block" data-act="sair">${icon('logout')}Sair</button>`;
}

function viewFilhos(u) {
  const filhos = filhosDe(u.id);
  return `${hero('Filhos', plural(filhos.length, 'aluno vinculado', 'alunos vinculados'))}
    <div class="stack lift">${filhos.map(f => `<div class="card kid"><span class="avatar">${esc(iniciais(f.nome))}</span>
      <span class="row-main"><b>${esc(f.nome)}</b><small>Matrícula ${esc(f.matricula)}</small>
      <span class="chips">${f.turmaIds.map(t => turmaChip(t, true)).join('')}</span></span>
      <span class="kid-acts"><button class="btn sm" data-act="verHorario" data-id="${f.id}">Horário</button><button class="btn sm" data-act="carteirinha" data-id="${f.id}" aria-label="Carteirinha de ${esc(f.nome)} em PDF">${icon('card')}Carteirinha</button></span></div>`).join('') || vazio('Nenhum aluno vinculado. Fale com a secretaria.')}</div>
    <h2 class="h2">Seus dados</h2>
    <div class="card list"><div class="row"><span class="row-main"><b>${esc(u.nome)}</b><small>${esc([u.telefone, u.email].filter(Boolean).join(' · '))}</small></span></div></div>
    ${seletorTema()}
    ${trocaDeAcesso()}
    <button class="btn ghost block" data-act="sair">${icon('logout')}Sair</button>`;
}

/* ---------- Admin: painel ---------- */
function viewPainel() {
  const semResp = db.alunos.filter(a => !a.responsavelIds.length);
  const semTurma = db.alunos.filter(a => !a.turmaIds.length);
  const stat = (n, l, tab) => `<button class="card stat" data-act="tab" data-id="${tab}"><b>${n}</b><small>${l}</small></button>`;
  const alerta = (a, msg) => `<button class="row" data-act="editarAluno" data-id="${a.id}">${icon('alert', 'warn-ic')}<span class="row-main"><b>${esc(a.nome)}</b><small>${msg}</small></span>${icon('chev', 'muted')}</button>`;
  return `${hero('Painel', dataLonga())}
    <div class="stats lift">${stat(db.alunos.length, 'Alunos', 'pessoas')}${stat(db.responsaveis.length, 'Responsáveis', 'pessoas')}${stat(db.turmas.length, 'Turmas', 'turmas')}${stat(db.comunicados.length, 'Comunicados', 'comunicados')}</div>
    <div class="acoes"><button class="tile" data-act="novoCom">${icon('megafone')}<span>Novo comunicado</span></button>
    <button class="tile dark" data-act="novoAluno">${icon('user')}<span>Cadastrar aluno</span></button>
    <button class="tile wide" data-act="tab" data-id="loja">${icon('loja')}<span>Loja de uniformes<small>${plural(db.produtos.length, 'item', 'itens')} com preço</small></span></button></div>
    <h2 class="h2">Pendências</h2>
    ${semResp.length || semTurma.length ? `<div class="card list">${semResp.map(a => alerta(a, 'Sem responsável cadastrado')).join('')}${semTurma.map(a => alerta(a, 'Sem turma')).join('')}</div>` : vazio('Tudo em dia.')}
    <h2 class="h2">Equipe da secretaria</h2>
    <div class="card list">${db.admins.map(a => `<button class="row" data-act="editarAdmin" data-id="${a.id}"><span class="avatar sm">${esc(iniciais(a.nome))}</span><span class="row-main"><b>${esc(a.nome)}</b><small>${esc(a.email)} · ${statusConta(a)}</small></span>${icon('chev', 'muted')}</button>`).join('')}
      <button class="row" data-act="novoAdmin">${icon('plus', 'muted')}<span class="row-main"><b>Adicionar administrador</b></span></button></div>
    ${seletorTema()}
    ${trocaDeAcesso()}
    <button class="btn ghost block" data-act="sair">${icon('logout')}Sair</button>`;
}

const statusConta = m => m.ativo ? 'conta ativa' : m.email ? 'convite pendente' : 'sem e-mail';
// Tema: 'sistema' segue o aparelho; 'claro' e 'escuro' ficam salvos.
const TEMAS = { sistema: 'Automático', claro: 'Claro', escuro: 'Escuro' };
function lerTema() { try { return localStorage.getItem('escola-app:tema') || 'sistema'; } catch { return 'sistema'; } }
function aplicarTema(t = lerTema()) {
  const raiz = document.documentElement;
  t === 'sistema' ? raiz.removeAttribute('data-tema') : raiz.setAttribute('data-tema', t);
  const escuro = t === 'escuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('.tema-btn').forEach(b => { b.innerHTML = iconeTema(); b.setAttribute('aria-label', escuro ? 'Usar tema claro' : 'Usar tema escuro'); });
  document.querySelectorAll('input[name="tema"]').forEach(i => { i.checked = i.value === t; });
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = escuro ? '#232325' : '#1d1d1f'; });
}
const temaEscuro = () => { const t = lerTema(); return t === 'escuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches); };
// Sol no escuro (toque para clarear), lua no claro.
const iconeTema = () => icon(temaEscuro() ? 'sol' : 'lua');
const seletorTema = () => `<fieldset class="field tema"><legend>Aparência</legend><div class="seg">${Object.entries(TEMAS).map(([k, l]) =>
  `<label><input type="radio" name="tema" value="${k}" ${lerTema() === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`;
const trocaDeAcesso = () => auth.vinculos.length > 1 ? `<button class="btn block" data-act="trocarAcesso">Trocar de escola ou perfil</button>` : '';

/* ---------- Admin: comunicados ---------- */
function descPublico(c) {
  const p = c.publico;
  const quem = p.perfis.map(x => x === 'aluno' ? 'Alunos' : 'pais').join(' e ').replace(/^p/, 'P');
  let onde = 'escola inteira';
  if (p.turmas.length || p.alunos.length) {
    onde = [...p.turmas.map(nomeTurma), ...p.alunos.map(id => byId(db.alunos, id)?.nome.split(' ')[0])].filter(Boolean).join(', ');
  }
  return `${quem}, ${onde}`;
}

function viewComunicadosAdmin() {
  const lista = [...db.comunicados].sort((a, b) => (b.fixado - a.fixado) || b.data.localeCompare(a.data));
  return `${hero('Comunicados', plural(lista.length, 'publicado', 'publicados'))}
    <div class="stack lift">${lista.map(c => cardComunicado(c, null, true)).join('') || vazio('Nenhum comunicado ainda. Toque em + para publicar.')}</div>
    <button class="fab" data-act="novoCom" aria-label="Novo comunicado">${icon('plus')}</button>`;
}

const checks = (name, items, sel, sm) => `<div class="chips wrap">${items.map(([v, l]) =>
  `<label class="chip ${sm ? 'sm' : ''}"><input type="checkbox" name="${name}" value="${v}" ${sel.includes(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;

function formComunicado(id) {
  const c = id ? byId(db.comunicados, id) : { tipo: 'aviso', titulo: '', texto: '', fixado: false, publico: { perfis: ['aluno', 'pai'], turmas: [], alunos: [] } };
  const p = c.publico;
  const modo = p.alunos.length ? 'alunos' : p.turmas.length ? 'turmas' : 'todos';
  const f = sheet(id ? 'Editar comunicado' : 'Novo comunicado', `
    <label class="field"><span>Título</span><input name="titulo" required maxlength="90" value="${esc(c.titulo)}"></label>
    <label class="field"><span>Mensagem</span><textarea name="texto" required rows="4">${esc(c.texto)}</textarea></label>
    <fieldset class="field"><legend>Tipo</legend><div class="seg">${Object.entries(TIPOS).map(([k, l]) => `<label><input type="radio" name="tipo" value="${k}" ${c.tipo === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <fieldset class="field"><legend>Quem vê</legend>${checks('perfis', [['aluno', 'Alunos'], ['pai', 'Pais e responsáveis']], p.perfis)}</fieldset>
    <fieldset class="field"><legend>Alcance</legend><div class="seg">
      ${[['todos', 'Escola toda'], ['turmas', 'Turmas'], ['alunos', 'Alunos']].map(([k, l]) => `<label><input type="radio" name="modo" value="${k}" ${modo === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div data-modo="turmas">${checks('turmas', db.turmas.map(t => [t.id, t.nome]), p.turmas)}</div>
      <div data-modo="alunos">${checks('alunos', db.alunos.map(a => [a.id, a.nome]), p.alunos, true)}</div>
    </fieldset>
    <label class="switch"><input type="checkbox" name="fixado" ${c.fixado ? 'checked' : ''}><span>Fixar no topo do mural</span></label>
    <p class="reach" id="reach"></p>
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarCom" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">${id ? 'Salvar' : 'Publicar'}</button></div>`,
  fd => {
    const perfis = fd.getAll('perfis');
    if (!perfis.length) { toast('Escolha quem vê o comunicado.'); return false; }
    const m = fd.get('modo');
    const pub = { perfis, turmas: m === 'turmas' ? fd.getAll('turmas') : [], alunos: m === 'alunos' ? fd.getAll('alunos') : [] };
    if (m !== 'todos' && !pub.turmas.length && !pub.alunos.length) { toast('Selecione ao menos uma turma ou aluno.'); return false; }
    return api.salvarComunicado(sessao.escolaId, { id, titulo: fd.get('titulo').trim(), texto: fd.get('texto').trim(), tipo: fd.get('tipo'), fixado: fd.has('fixado'), publico: pub })
      .then(() => toast(id ? 'Comunicado atualizado.' : 'Comunicado publicado.'));
  });
  const sync = () => {
    const fd = new FormData(f), m = fd.get('modo');
    f.querySelectorAll('[data-modo]').forEach(el => el.hidden = el.dataset.modo !== m);
    const r = alcance(db, { publico: { perfis: fd.getAll('perfis'), turmas: m === 'turmas' ? fd.getAll('turmas') : [], alunos: m === 'alunos' ? fd.getAll('alunos') : [] } });
    const semAlvo = m !== 'todos' && !fd.getAll(m).length;
    f.querySelector('#reach').textContent = semAlvo ? 'Selecione quem recebe.' : `Alcança ${plural(r.alunos, 'aluno', 'alunos')} e ${plural(r.pais, 'responsável', 'responsáveis')}.`;
  };
  f.addEventListener('change', sync); sync();
}

/* ---------- Admin: pessoas ---------- */
function viewPessoas() {
  const q = ui.busca.toLowerCase();
  const isA = ui.pessoas === 'alunos';
  const lista = (isA ? db.alunos : db.responsaveis).filter(x => x.nome.toLowerCase().includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
  const linha = x => isA
    ? `<button class="row" data-act="editarAluno" data-id="${x.id}"><span class="avatar sm">${esc(iniciais(x.nome))}</span><span class="row-main"><b>${esc(x.nome)}</b>
        <small>${esc(x.turmaIds.map(nomeTurma).join(' · ') || 'Sem turma')}</small>
        <small>${x.responsavelIds.length ? esc(x.responsavelIds.map(id => byId(db.responsaveis, id)?.nome).filter(Boolean).join(', ')) : '<span class="warn">Sem responsável</span>'}</small></span>${icon('chev', 'muted')}</button>`
    : `<button class="row" data-act="editarResp" data-id="${x.id}"><span class="avatar sm">${esc(iniciais(x.nome))}</span><span class="row-main"><b>${esc(x.nome)}</b>
        <small>${esc(filhosDe(x.id).map(a => a.nome).join(', ') || 'Nenhum aluno vinculado')}</small></span>${icon('chev', 'muted')}</button>`;
  return `${hero('Pessoas', `${plural(db.alunos.length, 'aluno', 'alunos')} e ${plural(db.responsaveis.length, 'responsável', 'responsáveis')}`)}
    <div class="seg full lift" role="tablist">
      <button role="tab" data-act="pessoas" data-id="alunos" aria-selected="${isA}">Alunos (${db.alunos.length})</button>
      <button role="tab" data-act="pessoas" data-id="resp" aria-selected="${!isA}">Responsáveis (${db.responsaveis.length})</button></div>
    <label class="search">${icon('search')}<input type="search" id="busca" placeholder="Buscar por nome…" value="${esc(ui.busca)}" aria-label="Buscar"></label>
    <div class="card list">${lista.map(linha).join('') || vazio('Ninguém encontrado.')}</div>
    <button class="fab" data-act="${isA ? 'novoAluno' : 'novoResp'}" aria-label="${isA ? 'Cadastrar aluno' : 'Cadastrar responsável'}">${icon('plus')}</button>`;
}

const campoEmail = (m, ajuda) => `<label class="field"><span>E-mail de acesso</span><input name="email" type="email" inputmode="email" autocomplete="off" spellcheck="false" value="${esc(m.email)}">
  <small class="help">${m.id ? `Situação: ${statusConta(m)}. ` : ''}${ajuda}</small></label>`;

function formAluno(id) {
  const a = id ? byId(db.alunos, id) : { nome: '', email: '', matricula: '', ra: '', foto: '', turmaIds: [], responsavelIds: [] };
  if (a.foto) api.fotoDataUrl(a.foto).then(u => { const p = $('#foto-prev'); if (u && p) p.innerHTML = `<img src="${u}" alt="">`; });
  sheet(id ? 'Editar aluno' : 'Novo aluno', `
    <label class="field"><span>Nome completo</span><input name="nome" required value="${esc(a.nome)}" autocomplete="off"></label>
    <div class="foto-campo"><span class="foto-prev" id="foto-prev">${esc(iniciais(a.nome || '?'))}</span>
      <span class="stack"><label class="btn sm"><input type="file" name="foto" accept="image/*" class="sr" data-foto>${icon('user')}${a.foto ? 'Trocar foto' : 'Adicionar foto'}</label>
      ${a.foto ? `<label class="check sm"><input type="checkbox" name="sem_foto"><span>Remover foto</span></label>` : ''}<small class="help">Foto de rosto, usada na carteirinha.</small></span></div>
    <div class="row2"><label class="field"><span>RA</span><input name="ra" value="${esc(a.ra)}" autocomplete="off" spellcheck="false" placeholder="000123456-7"></label>
    <label class="field"><span>Matrícula</span><input name="matricula" inputmode="numeric" value="${esc(a.matricula)}"></label></div>
    ${campoEmail(a, 'Opcional: com e-mail, o próprio aluno entra no app.')}
    <fieldset class="field"><legend>Turmas</legend>${checks('turmas', db.turmas.map(t => [t.id, t.nome]), a.turmaIds)}<small class="help">Um aluno pode estar em mais de uma turma (ex.: turma regular + contraturno).</small></fieldset>
    <fieldset class="field"><legend>Responsáveis</legend>${checks('resp', db.responsaveis.map(r => [r.id, r.nome]), a.responsavelIds)}
      <details class="inline-new"><summary>${icon('plus')}Cadastrar novo responsável</summary>
        <label class="field"><span>Nome</span><input name="nr_nome" autocomplete="off"></label>
        <label class="field"><span>Telefone</span><input name="nr_tel" type="tel" inputmode="tel"></label>
        <label class="field"><span>E-mail de acesso</span><input name="nr_email" type="email" inputmode="email" autocomplete="off" spellcheck="false"></label></details></fieldset>
    ${id ? `<button type="button" class="btn block" data-act="carteirinha" data-id="${id}">${icon('card')}Gerar carteirinha (PDF)</button>` : ''}
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarAluno" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    const resp = fd.getAll('resp');
    const nrNome = fd.get('nr_nome').trim();
    if (nrNome) resp.push(await api.salvarMembro(sessao.escolaId, { perfil: 'pai', nome: nrNome, telefone: fd.get('nr_tel').trim(), email: fd.get('nr_email').trim() }));
    const aid = await api.salvarMembro(sessao.escolaId, { id, perfil: 'aluno', nome: fd.get('nome').trim(), ra: fd.get('ra').trim(), matricula: fd.get('matricula').trim(), email: fd.get('email').trim(), turmas: fd.getAll('turmas'), ligados: resp });
    const arq = fd.get('foto');
    if (arq && arq.size) await api.salvarFoto(sessao.escolaId, aid, await reduzirFoto(arq));
    else if (fd.has('sem_foto') && a.foto) await api.removerFoto(aid, a.foto);
    toast(resp.length ? 'Aluno salvo.' : 'Aluno salvo, mas ainda sem responsável.');
  });
}

function formResp(id) {
  const r = id ? byId(db.responsaveis, id) : { nome: '', telefone: '', email: '' };
  const filhos = id ? filhosDe(id).map(a => a.id) : [];
  sheet(id ? 'Editar responsável' : 'Novo responsável', `
    <label class="field"><span>Nome completo</span><input name="nome" required value="${esc(r.nome)}" autocomplete="off"></label>
    <label class="field"><span>Telefone (WhatsApp)</span><input name="telefone" type="tel" inputmode="tel" value="${esc(r.telefone)}"></label>
    ${campoEmail(r, 'O responsável entra no app com este e-mail.')}
    <fieldset class="field"><legend>Alunos vinculados</legend>${checks('alunos', db.alunos.map(a => [a.id, a.nome]), filhos, true)}</fieldset>
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarResp" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    await api.salvarMembro(sessao.escolaId, { id, perfil: 'pai', nome: fd.get('nome').trim(), telefone: fd.get('telefone').trim(), email: fd.get('email').trim(), ligados: fd.getAll('alunos') });
    toast('Responsável salvo.');
  });
}

function formAdmin(id) {
  const a = id ? byId(db.admins, id) : { nome: '', email: '' };
  const eu = id === sessao.id;
  sheet(id ? 'Administrador' : 'Novo administrador', `
    <label class="field"><span>Nome</span><input name="nome" required value="${esc(a.nome)}"></label>
    ${campoEmail(a, 'Quem entrar com este e-mail terá acesso total à escola.')}
    <div class="sheet-actions">${id && !eu ? `<button type="button" class="btn danger" data-act="apagarAdmin" data-id="${id}">${icon('trash')}Remover</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    if (!fd.get('email').trim()) { toast('Informe o e-mail.'); return false; }
    await api.salvarMembro(sessao.escolaId, { id, perfil: 'admin', nome: fd.get('nome').trim(), email: fd.get('email').trim() });
    toast('Administrador salvo.');
  });
}


/* ---------- Admin: turmas e grade ---------- */
function viewTurmas() {
  if (ui.turma && byId(db.turmas, ui.turma)) return viewGrade(byId(db.turmas, ui.turma));
  return `${hero('Turmas', plural(db.turmas.length, 'turma', 'turmas'))}
    <div class="card list lift">${db.turmas.map(t => {
      const n = db.alunos.filter(a => a.turmaIds.includes(t.id)).length;
      const aulas = db.grade.filter(g => g.turmaId === t.id).length;
      return `<button class="row" data-act="abrirTurma" data-id="${t.id}"><span class="avatar sm sq" style="${corTurma(t.id)}">${esc(t.nome.slice(0, 2))}</span><span class="row-main"><b>${esc(t.nome)}</b><small>${esc(t.turno)} · ${plural(n, 'aluno', 'alunos')} · ${plural(aulas, 'aula', 'aulas')} por semana</small></span>${icon('chev', 'muted')}</button>`;
    }).join('') || vazio('Nenhuma turma.')}</div>
    <button class="fab" data-act="novaTurma" aria-label="Nova turma">${icon('plus')}</button>`;
}

function viewGrade(t) {
  const aulas = db.grade.filter(g => g.turmaId === t.id && g.dia === ui.dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const alunos = db.alunos.filter(a => a.turmaIds.includes(t.id));
  return `${hero(esc(t.nome), `${esc(t.turno)}, ${plural(alunos.length, 'aluno', 'alunos')}`, '',
      `<div class="hero-acts"><button class="back" data-act="voltarTurmas">${icon('back')}Turmas</button><button class="btn sm on-dark" data-act="editarTurma" data-id="${t.id}">Editar turma</button></div>`)}
    <div class="days lift" role="tablist" aria-label="Dia da semana">${[1, 2, 3, 4, 5].map(d => `<button role="tab" data-act="dia" data-id="${d}" aria-selected="${ui.dia === d}">${DIAS[d]}</button>`).join('')}</div>
    <h2 class="h2">Grade de ${DIAS_LONGOS[ui.dia].toLowerCase()}</h2>
    ${aulas.length ? `<ol class="timeline">${aulas.map(g => `<li class="slot"><button class="slot-btn" data-act="editarAula" data-id="${g.id}">
      <span class="slot-h"><b>${g.inicio}</b><small>${g.fim}</small></span>
      <span class="slot-c" style="${corTurma(g.turmaId)}"><b>${esc(g.disciplina)}</b><small>${esc([g.professor, g.sala].filter(Boolean).join(' · '))}</small></span>${icon('chev', 'muted')}</button></li>`).join('')}</ol>` : vazio('Sem aulas neste dia.')}
    <button class="btn primary block" data-act="novaAula">${icon('plus')}Adicionar aula</button>
    <h2 class="h2">Alunos da turma</h2>
    <div class="card list">${alunos.map(a => `<button class="row" data-act="editarAluno" data-id="${a.id}"><span class="avatar sm">${esc(iniciais(a.nome))}</span><span class="row-main"><b>${esc(a.nome)}</b></span>${icon('chev', 'muted')}</button>`).join('') || vazio('Nenhum aluno nesta turma.')}</div>`;
}

/* ---------- Carteirinha estudantil (PDF) ---------- */
// Reduz a foto no aparelho para 600x750 (3:4), recortando ao centro.
async function reduzirFoto(arq) {
  const img = await createImageBitmap(arq);
  const W = 600, H = 750, c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
  c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', .85));
}
// jsPDF só é baixado na primeira carteirinha.
let jsPdfPronto;
const carregarJsPdf = () => jsPdfPronto ||= new Promise((ok, erro) => {
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => { jsPdfPronto = null; erro(new Error('Não foi possível carregar o gerador de PDF. Verifique a internet.')); };
  document.head.appendChild(s);
});
// Série = primeira turma que não é de contraturno.
const serieDe = a => {
  const ts = a.turmaIds.map(id => byId(db.turmas, id)).filter(Boolean);
  return (ts.find(t => t.turno !== 'Contraturno') || ts[0])?.nome || '';
};
async function imagemDataUrl(url) {
  try { const r = await fetch(url); return r.ok ? blobParaDataUrl(await r.blob()) : null; } catch { return null; }
}

async function gerarCarteirinha(id, el) {
  const a = byId(db.alunos, id);
  if (!a) return;
  el?.setAttribute('aria-busy', 'true'); if (el) el.disabled = true;
  try {
    const [jsPDF, foto, logo] = await Promise.all([carregarJsPdf(), api.fotoDataUrl(a.foto), MARCA.logo ? imagemDataUrl(MARCA.logo) : null]);
    // Tamanho de cartão de crédito (ISO ID-1), em milímetros.
    const W = 85.6, H = 54, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] });
    const ano = String(new Date().getFullYear());
    doc.setProperties({ title: `Carteirinha estudantil - ${a.nome}` });
    // Faixa superior grafite com o logotipo numa placa branca.
    doc.setFillColor(29, 29, 31); doc.rect(0, 0, W, 14, 'F');
    doc.setFillColor(43, 80, 214); doc.rect(0, 14, W, 1.2, 'F');
    if (logo) { doc.setFillColor(255, 255, 255); doc.roundedRect(3.5, 2.5, 30, 9, 1.5, 1.5, 'F'); doc.addImage(logo, 'PNG', 5, 3.4, 27, 7.25); }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.text('CARTEIRA ESTUDANTIL', W - 4, 6.6, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.text(doc.splitTextToSize(sessao.escola, 42)[0], W - 4, 10.2, { align: 'right' });
    // Foto 3x4 (ou iniciais).
    const fx = 4, fy = 19, fw = 22, fh = 29.3;
    doc.setFillColor(242, 242, 242); doc.roundedRect(fx, fy, fw, fh, 1.5, 1.5, 'F');
    if (foto) doc.addImage(foto, 'JPEG', fx, fy, fw, fh);
    else { doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(iniciais(a.nome), fx + fw / 2, fy + fh / 2 + 2, { align: 'center' }); }
    // Dados.
    const x = 30;
    const campo = (rot, val, y, grande) => {
      doc.setTextColor(106, 106, 106); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.text(rot.toUpperCase(), x, y);
      doc.setTextColor(34, 34, 34); doc.setFont('helvetica', 'bold'); doc.setFontSize(grande ? 9 : 7.5);
      const linhas = doc.splitTextToSize(val || '—', W - x - 4).slice(0, grande ? 2 : 1);
      doc.text(linhas, x, y + (grande ? 3.6 : 3.2));
      return linhas.length;
    };
    const ln = campo('Nome', a.nome, 21, true);
    const y2 = 21 + 6.5 + (ln - 1) * 3.6;
    campo('Série', serieDe(a), y2);
    doc.setTextColor(106, 106, 106); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.text('ANO LETIVO', x + 30, y2);
    doc.setTextColor(34, 34, 34); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(ano, x + 30, y2 + 3.2);
    campo('RA', a.ra, y2 + 7.5);
    doc.setTextColor(106, 106, 106); doc.setFont('helvetica', 'normal'); doc.setFontSize(5);
    doc.text(`Válida até 31/12/${ano}`, x, H - 4);
    doc.save(`carteirinha-${a.nome.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.pdf`);
    if (!a.ra) toast('Carteirinha gerada sem RA. Peça para a secretaria cadastrar.');
  } catch (err) { toast(err.message); }
  finally { el?.removeAttribute('aria-busy'); if (el) el.disabled = false; }
}

/* ---------- Loja (uniformes e materiais) ---------- */
const preco = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CATEGORIAS = ['Uniforme', 'Educação Física', 'Agasalho', 'Acessórios', 'Material'];

function viewLoja(u) {
  const admin = u.perfil === 'admin';
  const cats = [...new Set(db.produtos.map(p => p.categoria))];
  if (ui.cat && !cats.includes(ui.cat)) ui.cat = null;
  const lista = db.produtos.filter(p => !ui.cat || p.categoria === ui.cat);
  const voltar = admin ? `<div class="hero-acts"><button class="back" data-act="tab" data-id="painel">${icon('back')}Painel</button></div>` : '';
  const card = p => {
    const tam = p.tamanhos.split(',').map(t => t.trim()).filter(Boolean);
    const dentro = `<span class="prod-top"><span class="kind">${esc(p.categoria)}</span>${p.disponivel ? '' : '<span class="badge urgente">Esgotado</span>'}</span>
      <b class="prod-nome">${esc(p.nome)}</b>${p.descricao ? `<span class="prod-desc">${esc(p.descricao)}</span>` : ''}
      ${tam.length ? `<span class="prod-tam" aria-label="Tamanhos">${tam.map(t => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
      <span class="prod-preco">${preco(p.preco)}</span>`;
    return admin ? `<button class="card prod${p.disponivel ? '' : ' off'}" data-act="editarProduto" data-id="${p.id}">${dentro}</button>`
      : `<article class="card prod${p.disponivel ? '' : ' off'}">${dentro}</article>`;
  };
  return `${hero('Loja', admin ? 'Preços que pais e alunos veem' : 'Uniformes e materiais da escola', '', voltar)}
    <div class="card next lift"><span class="next-ic">${icon('loja')}</span><span class="next-main"><small>Como comprar</small>
      <b>${admin ? plural(db.produtos.length, 'item no catálogo', 'itens no catálogo') : 'Pedidos na secretaria'}</b>
      <span>${admin ? 'Toque num item para mudar preço, tamanhos ou disponibilidade.' : 'Os preços são de referência. Para comprar ou tirar dúvidas, fale com a secretaria.'}</span></span></div>
    ${cats.length > 1 ? `<div class="chips scroll" role="group" aria-label="Categoria">${[null, ...cats].map(c => `<button class="chip sm" data-act="categoria" data-id="${esc(c || '')}" aria-pressed="${(ui.cat || null) === c}">${esc(c || 'Tudo')}</button>`).join('')}</div>` : ''}
    <div class="prods">${lista.map(card).join('') || vazio(admin ? 'Nenhum item ainda. Toque em + para cadastrar.' : 'A escola ainda não publicou os preços.')}</div>
    ${admin ? `<button class="fab" data-act="novoProduto" aria-label="Novo item">${icon('plus')}</button>` : ''}`;
}

function formProduto(id) {
  const p = id ? byId(db.produtos, id) : { nome: '', categoria: 'Uniforme', descricao: '', preco: '', tamanhos: '', disponivel: true };
  sheet(id ? 'Editar item' : 'Novo item', `
    <label class="field"><span>Nome</span><input name="nome" required value="${esc(p.nome)}" placeholder="Camiseta manga curta…"></label>
    <label class="field"><span>Categoria</span><input name="categoria" required list="cats" value="${esc(p.categoria)}"><datalist id="cats">${CATEGORIAS.map(c => `<option value="${c}">`).join('')}</datalist></label>
    <label class="field"><span>Preço (R$)</span><input name="preco" required inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${p.preco === '' ? '' : String(p.preco.toFixed(2)).replace('.', ',')}" placeholder="59,90"></label>
    <label class="field"><span>Tamanhos</span><input name="tamanhos" value="${esc(p.tamanhos)}" placeholder="4, 6, 8, 10, P, M, G"></label>
    <label class="field"><span>Descrição</span><textarea name="descricao" rows="2">${esc(p.descricao)}</textarea></label>
    <label class="check"><input type="checkbox" name="disponivel" ${p.disponivel ? 'checked' : ''}><span>Disponível</span></label>
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarProduto" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    await api.salvarProduto(sessao.escolaId, { id, nome: fd.get('nome').trim(), categoria: fd.get('categoria').trim(), descricao: fd.get('descricao').trim(),
      preco: +fd.get('preco').replace(',', '.'), tamanhos: fd.get('tamanhos').trim(), disponivel: fd.has('disponivel') });
    toast('Item salvo.');
  });
}

function formTurma(id) {
  const t = id ? byId(db.turmas, id) : { nome: '', turno: 'Manhã' };
  sheet(id ? 'Editar turma' : 'Nova turma', `
    <label class="field"><span>Nome</span><input name="nome" required value="${esc(t.nome)}" placeholder="8º ano C…"></label>
    <fieldset class="field"><legend>Turno</legend><div class="seg">${['Manhã', 'Tarde', 'Noite', 'Contraturno'].map(x => `<label><input type="radio" name="turno" value="${x}" ${t.turno === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></fieldset>
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarTurma" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    const tid = await api.salvarTurma(sessao.escolaId, { id, nome: fd.get('nome').trim(), turno: fd.get('turno') });
    ui.turma = tid;
    toast('Turma salva.');
  });
}

function formAula(id) {
  const g = id ? byId(db.grade, id) : { turmaId: ui.turma, dia: ui.dia, inicio: '', fim: '', disciplina: '', professor: '', sala: '' };
  sheet(id ? 'Editar aula' : 'Nova aula', `
    <label class="field"><span>Disciplina</span><input name="disciplina" required value="${esc(g.disciplina)}"></label>
    <fieldset class="field"><legend>Dia</legend><div class="seg">${[1, 2, 3, 4, 5].map(d => `<label><input type="radio" name="dia" value="${d}" ${g.dia === d ? 'checked' : ''}><span>${DIAS[d]}</span></label>`).join('')}</div></fieldset>
    <div class="two"><label class="field"><span>Início</span><input name="inicio" type="time" required value="${g.inicio}"></label>
    <label class="field"><span>Fim</span><input name="fim" type="time" required value="${g.fim}"></label></div>
    <label class="field"><span>Professor(a)</span><input name="professor" value="${esc(g.professor)}"></label>
    <label class="field"><span>Sala</span><input name="sala" value="${esc(g.sala)}"></label>
    <div class="sheet-actions">${id ? `<button type="button" class="btn danger" data-act="apagarAula" data-id="${id}">${icon('trash')}Excluir</button>` : ''}<button class="btn primary">Salvar</button></div>`,
  async fd => {
    const novo = { ...g, disciplina: fd.get('disciplina').trim(), dia: +fd.get('dia'), inicio: fd.get('inicio'), fim: fd.get('fim'), professor: fd.get('professor').trim(), sala: fd.get('sala').trim() };
    if (novo.fim <= novo.inicio) { toast('O fim precisa ser depois do início.'); return false; }
    await api.salvarAula(sessao.escolaId, novo);
    ui.dia = novo.dia;
    toast('Aula salva.');
  });
}

/* ---------- Sheet (dialog nativo) ---------- */
function sheet(titulo, corpo, onSubmit) {
  const d = $('#sheet');
  // O toast pode ter ficado dentro do sheet anterior; tira antes de trocar o conteúdo.
  const t = $('#toast'); if (t && d.contains(t)) document.body.appendChild(t);
  d.innerHTML =`<form class="sheet-in" novalidate>
    <span class="grip" aria-hidden="true"></span>
    <header class="sheet-h"><h2 id="sheet-title">${esc(titulo)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></header>
    <div class="sheet-b">${corpo}</div></form>`;
  const f = d.querySelector('form');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) return d.close();
    if (!f.reportValidity()) return;
    const btn = f.querySelector('.btn.primary');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      if (await onSubmit(new FormData(f), f) === false) return;
      d.close();
      await recarregar();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  });
  d.showModal();
  return f;
}
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) $('#sheet').close(); });

function abrirComunicado(id) {
  const c = byId(db.comunicados, id);
  if (!db.lidos.has(id)) { db.lidos.add(id); api.marcarLido(id, sessao.id).catch(() => {}); }
  sheet(c.titulo, `<p class="post-top"><span class="badge ${c.tipo}">${TIPOS[c.tipo]}</span><time>${new Date(c.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</time></p>
    <p class="read">${esc(c.texto).replace(/\n/g, '<br>')}</p><div class="sheet-actions"><button class="btn primary">Entendi</button></div>`, null);
  $('#sheet').addEventListener('close', render, { once: true });
}

// Exclusão no banco; o cascade das chaves estrangeiras limpa vínculos e grade.
async function remover(tabela, id, msg, depois) {
  if (!confirm(msg)) return;
  try {
    await api.apagar(tabela, id);
    $('#sheet').close();
    depois?.();
    await recarregar();
  } catch (err) { toast(err.message); }
}

/* ---------- Ações ---------- */
const ACT = {
  trocarEmail: () => { auth.fase = 'login'; render(); },
  vinculo: v => entrar(auth.vinculos.find(x => x.id === v)).catch(e => toast(e.message)),
  trocarAcesso: () => { localStorageSet('escola-app:vinculo', null); canal?.unsubscribe(); sessao = null; auth.fase = 'escolha'; render(); },
  alternarTema: () => { const t = temaEscuro() ? 'claro' : 'escuro'; localStorageSet('escola-app:tema', t); aplicarTema(t); },
  sair: async () => { canal?.unsubscribe(); localStorageSet('escola-app:vinculo', null); await api.sair(); sessao = null; db = vazioDB(); auth.fase = 'login'; render(); },
  conta: () => { ui.tab = { aluno: 'perfil', pai: 'filhos', admin: 'painel' }[sessao.perfil]; render(); },
  tab: v => { ui.anim = true; ui.tab = v; ui.turma = null; render(); scrollTo(0, 0); },
  filho: v => { ui.filho = v; render(); },
  dia: v => { ui.dia = +v; render(); },
  verHorario: v => { ui.anim = true; ui.filho = v; ui.tab = 'horario'; render(); },
  abrirCom: abrirComunicado,
  novoCom: () => formComunicado(),
  editarCom: v => formComunicado(v),
  apagarCom: v => remover('comunicados', v, 'Excluir este comunicado?', () => toast('Comunicado excluído.')),
  pessoas: v => { ui.pessoas = v; render(); },
  novoAluno: () => formAluno(),
  editarAluno: v => formAluno(v),
  apagarAluno: v => remover('membros', v, 'Excluir este aluno?'),
  novoResp: () => formResp(),
  editarResp: v => formResp(v),
  apagarResp: v => remover('membros', v, 'Excluir este responsável? Os alunos ficarão sem esse vínculo.'),
  novoAdmin: () => formAdmin(),
  editarAdmin: v => formAdmin(v),
  apagarAdmin: v => remover('membros', v, 'Remover este administrador?'),
  abrirTurma: v => { ui.anim = true; ui.turma = v; render(); scrollTo(0, 0); },
  voltarTurmas: () => { ui.anim = true; ui.turma = null; render(); },
  novaTurma: () => formTurma(),
  carteirinha: (v, el) => gerarCarteirinha(v, el),
  categoria: v => { ui.cat = v || null; render(); },
  novoProduto: () => formProduto(),
  editarProduto: v => formProduto(v),
  apagarProduto: v => remover('produtos', v, 'Excluir este item da loja?', () => toast('Item excluído.')),
  editarTurma: v => formTurma(v),
  apagarTurma: v => remover('turmas', v, 'Excluir a turma e a grade dela?', () => { ui.turma = null; }),
  novaAula: () => formAula(),
  editarAula: v => formAula(v),
  apagarAula: v => remover('aulas', v, 'Excluir esta aula?'),
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  ACT[t.dataset.act]?.(t.dataset.id, t);
});
document.addEventListener('change', e => {
  if (e.target.name !== 'tema') return;
  localStorageSet('escola-app:tema', e.target.value === 'sistema' ? null : e.target.value);
  aplicarTema(e.target.value);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema());
// Prévia da foto escolhida no cadastro do aluno.
document.addEventListener('change', e => {
  if (!e.target.matches('[data-foto]') || !e.target.files[0]) return;
  const p = $('#foto-prev'); if (p) p.innerHTML = `<img src="${URL.createObjectURL(e.target.files[0])}" alt="">`;
});
document.addEventListener('input', e => {
  if (e.target.id !== 'busca') return;
  ui.busca = e.target.value; render();
  const b = $('#busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length);
});

iniciar();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
