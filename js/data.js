/* Regras de público dos comunicados, espelho do que o banco aplica em
   pode_ver_comunicado() (supabase/migrations). O servidor já só devolve o
   que o usuário pode ver; aqui o filtro serve para separar por filho e para
   o admin prever o alcance antes de publicar.
   publico.perfis: quem vê ('aluno', 'pai').
   publico.turmas / publico.alunos vazios = escola inteira. */
function atingeAluno(c, aluno) {
  const p = c.publico;
  if (!p.turmas.length && !p.alunos.length) return true;
  return p.alunos.includes(aluno.id) || aluno.turmaIds.some(t => p.turmas.includes(t));
}

function visivelPara(c, perfil, alunosContexto) {
  if (!c.publico.perfis.includes(perfil)) return false;
  return alunosContexto.some(a => atingeAluno(c, a));
}

function alcance(db, c) {
  const alvo = db.alunos.filter(a => atingeAluno(c, a));
  const alunos = c.publico.perfis.includes('aluno') ? alvo.length : 0;
  const pais = c.publico.perfis.includes('pai') ? new Set(alvo.flatMap(a => a.responsavelIds)).size : 0;
  return { alunos, pais };
}
