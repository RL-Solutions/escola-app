/* Camada de dados: Supabase (auth por código no e-mail + Postgres com RLS).
   carregar() monta um cache no mesmo formato que as telas usam; cada
   gravação chama o banco e recarrega o cache. */

// Sem URL/chave em js/config.js o app mostra a tela de configuração.
const sb = ESCOLA_CONFIG.supabaseUrl && ESCOLA_CONFIG.supabaseAnonKey
  ? supabase.createClient(ESCOLA_CONFIG.supabaseUrl, ESCOLA_CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : null;

function falhou(error) {
  if (!error) return;
  const msg = /violates row-level security|permission denied/i.test(error.message) ? 'Sem permissão para esta ação.'
    : /duplicate key.*email/i.test(error.message) ? 'Já existe um cadastro com este e-mail.'
    : /duplicate key.*membros_ra_unico/i.test(error.message) ? 'Já existe outro aluno com este RA.'
    : error.message;
  throw new Error(msg);
}

const blobParaDataUrl = b => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(b); });

const api = {
  async enviarCodigo(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    falhou(error);
  },
  async entrarComSenha(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    falhou(error);
  },
  async confirmarCodigo(email, token) {
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    falhou(error);
  },
  async usuarioAtual() {
    const { data } = await sb.auth.getSession();
    return data.session?.user ?? null;
  },
  async sair() { await sb.auth.signOut(); },

  // Liga cadastros feitos pelo admin com este e-mail e devolve os vínculos.
  async meusVinculos(userId) {
    const { error: e1 } = await sb.rpc('vincular_conta'); falhou(e1);
    const { data, error } = await sb.from('membros').select('id, perfil, nome, escola_id, escolas(nome)').eq('user_id', userId);
    falhou(error);
    return data.map(m => ({ ...m, escola: m.escolas?.nome ?? '' }));
  },
  async criarEscola(nomeEscola, nomeAdmin) {
    const { error } = await sb.rpc('criar_escola', { nome_escola: nomeEscola, nome_admin: nomeAdmin });
    falhou(error);
  },

  async carregar(escolaId, membroId) {
    const q = t => sb.from(t).select('*').eq('escola_id', escolaId);
    const [mem, tur, at, ar, aul, com, ct, ca, lid, pro] = await Promise.all([
      q('membros'), q('turmas').order('nome'), q('aluno_turma'), q('aluno_responsavel'), q('aulas'),
      q('comunicados').order('criado_em', { ascending: false }), q('comunicado_turma'), q('comunicado_aluno'),
      sb.from('leituras').select('comunicado_id, membro_id'), q('produtos').order('categoria').order('nome'),
    ]);
    for (const r of [mem, tur, at, ar, aul, com, ct, ca, lid, pro]) falhou(r.error);
    const grupo = (rows, k, v) => rows.reduce((m, r) => ((m[r[k]] ||= []).push(r[v]), m), {});
    const turmasDe = grupo(at.data, 'aluno_id', 'turma_id');
    const respDe = grupo(ar.data, 'aluno_id', 'responsavel_id');
    const ctDe = grupo(ct.data, 'comunicado_id', 'turma_id');
    const caDe = grupo(ca.data, 'comunicado_id', 'aluno_id');
    const leitDe = grupo(lid.data, 'comunicado_id', 'membro_id');
    const pessoa = m => ({ id: m.id, nome: m.nome, email: m.email || '', telefone: m.telefone || '', matricula: m.matricula || '', ra: m.ra || '', foto: m.foto || '', ativo: !!m.user_id });
    return {
      turmas: tur.data.map(t => ({ id: t.id, nome: t.nome, turno: t.turno })),
      alunos: mem.data.filter(m => m.perfil === 'aluno').map(m => ({ ...pessoa(m), turmaIds: turmasDe[m.id] || [], responsavelIds: respDe[m.id] || [] })),
      responsaveis: mem.data.filter(m => m.perfil === 'pai').map(pessoa),
      admins: mem.data.filter(m => m.perfil === 'admin').map(pessoa),
      grade: aul.data.map(g => ({ id: g.id, turmaId: g.turma_id, dia: g.dia, inicio: g.inicio.slice(0, 5), fim: g.fim.slice(0, 5), disciplina: g.disciplina, professor: g.professor || '', sala: g.sala || '' })),
      comunicados: com.data.map(c => ({
        id: c.id, tipo: c.tipo, titulo: c.titulo, texto: c.texto, fixado: c.fixado, data: c.criado_em,
        publico: { perfis: [c.para_alunos && 'aluno', c.para_pais && 'pai'].filter(Boolean), turmas: ctDe[c.id] || [], alunos: caDe[c.id] || [] },
        leituras: (leitDe[c.id] || []).length,
      })),
      produtos: pro.data.map(p => ({ id: p.id, nome: p.nome, categoria: p.categoria, descricao: p.descricao || '', preco: +p.preco, tamanhos: p.tamanhos || '', disponivel: p.disponivel })),
      lidos: new Set(lid.data.filter(l => l.membro_id === membroId).map(l => l.comunicado_id)),
    };
  },

  async salvarComunicado(escolaId, c) {
    const { error } = await sb.rpc('salvar_comunicado', { c: {
      id: c.id || '', escola_id: escolaId, tipo: c.tipo, titulo: c.titulo, texto: c.texto, fixado: c.fixado,
      para_alunos: c.publico.perfis.includes('aluno'), para_pais: c.publico.perfis.includes('pai'),
      turmas: c.publico.turmas, alunos: c.publico.alunos,
    } });
    falhou(error);
  },
  async salvarMembro(escolaId, m) {
    const { data, error } = await sb.rpc('salvar_membro', { m: { ...m, id: m.id || '', escola_id: escolaId } });
    falhou(error);
    return data;
  },
  async salvarTurma(escolaId, t) {
    const row = { escola_id: escolaId, nome: t.nome, turno: t.turno };
    const { data, error } = t.id
      ? await sb.from('turmas').update(row).eq('id', t.id).select('id').single()
      : await sb.from('turmas').insert(row).select('id').single();
    falhou(error);
    return data.id;
  },
  async salvarAula(escolaId, g) {
    const row = { escola_id: escolaId, turma_id: g.turmaId, dia: g.dia, inicio: g.inicio, fim: g.fim, disciplina: g.disciplina, professor: g.professor, sala: g.sala };
    const { error } = g.id ? await sb.from('aulas').update(row).eq('id', g.id) : await sb.from('aulas').insert(row);
    falhou(error);
  },
  async salvarProduto(escolaId, p) {
    const row = { escola_id: escolaId, nome: p.nome, categoria: p.categoria, descricao: p.descricao || null, preco: p.preco, tamanhos: p.tamanhos || null, disponivel: p.disponivel };
    const { error } = p.id ? await sb.from('produtos').update(row).eq('id', p.id) : await sb.from('produtos').insert(row);
    falhou(error);
  },
  // Foto do aluno: JPEG já reduzido no aparelho, em fotos/<escola>/<aluno>.jpg.
  async salvarFoto(escolaId, alunoId, blob) {
    const caminho = `${escolaId}/${alunoId}.jpg`;
    const { error } = await sb.storage.from('fotos').upload(caminho, blob, { upsert: true, contentType: 'image/jpeg' });
    falhou(error);
    const { error: e2 } = await sb.from('membros').update({ foto: caminho }).eq('id', alunoId);
    falhou(e2);
  },
  async removerFoto(alunoId, caminho) {
    await sb.storage.from('fotos').remove([caminho]);
    const { error } = await sb.from('membros').update({ foto: null }).eq('id', alunoId);
    falhou(error);
  },
  // Devolve a foto como data URL (serve para <img> e para o PDF).
  async fotoDataUrl(caminho) {
    if (!caminho) return null;
    const { data, error } = await sb.storage.from('fotos').download(caminho);
    if (error) return null;
    return blobParaDataUrl(data);
  },
  async apagar(tabela, id) {
    const { error } = await sb.from(tabela).delete().eq('id', id);
    falhou(error);
  },
  async marcarLido(comunicadoId, membroId) {
    const { error } = await sb.from('leituras').upsert({ comunicado_id: comunicadoId, membro_id: membroId }, { onConflict: 'comunicado_id,membro_id', ignoreDuplicates: true });
    falhou(error);
  },
  // Novo comunicado aparece sem recarregar a página.
  ouvirComunicados(escolaId, fn) {
    return sb.channel('comunicados-' + escolaId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados', filter: `escola_id=eq.${escolaId}` }, fn)
      .subscribe();
  },
};
