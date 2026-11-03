// Testa schema e RLS num Postgres embutido (PGlite), com um auth.* mínimo
// que imita o Supabase. Uso: npm test
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create publication supabase_realtime;
`);
const dir = new URL('../migrations/', import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));

let n = 0;
const users = {};
async function user(nome) {
  const id = `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`;
  await db.query('insert into auth.users values ($1, $2)', [id, `${nome}@x.com`]);
  return (users[nome] = { id, email: `${nome}@x.com` });
}
// Roda como o usuário logado, com o papel authenticated (como o PostgREST).
async function como(nome, sql, params = []) {
  const u = users[nome];
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [u.id, JSON.stringify({ sub: u.id, email: u.email })]);
  await db.exec('set role authenticated');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
}
const falha = async (p, msg) => { await assert.rejects(p, undefined, msg); };
const ids = rows => rows.map(r => r.id ?? r.titulo).sort();
let ok = 0; const t = async (nome, fn) => { await fn(); ok++; console.log('ok -', nome); };

for (const u of ['adm', 'adm2', 'pai', 'ana', 'carla', 'intruso']) await user(u);

// ---- montagem pela secretaria
const [{ e1 }] = await como('adm', `select criar_escola('Escola Um', 'Secretaria') e1`);
const [{ e2 }] = await como('adm2', `select criar_escola('Escola Dois', 'Outra') e2`);
const turma = async (nome) => (await como('adm', `insert into turmas (escola_id, nome) values ($1, $2) returning id`, [e1, nome]))[0].id;
const t6 = await turma('6A'), t9 = await turma('9A');
const membro = async (m) => (await como('adm', `select salvar_membro($1) id`, [{ escola_id: e1, ...m }]))[0].id;
const ana = await membro({ perfil: 'aluno', nome: 'Ana', email: 'ana@x.com', turmas: [t6] });
const bruno = await membro({ perfil: 'aluno', nome: 'Bruno', turmas: [t9] });
const carla = await membro({ perfil: 'aluno', nome: 'Carla', email: 'CARLA@x.com', turmas: [t9] });
const pai = await membro({ perfil: 'pai', nome: 'Pai', email: 'pai@x.com', ligados: [ana, bruno] });
await como('adm', `insert into aulas (escola_id, turma_id, dia, inicio, fim, disciplina) values ($1, $2, 1, '07:30', '08:20', 'Matemática')`, [e1, t6]);

const com = async (titulo, extra) => como('adm', `select salvar_comunicado($1)`, [{ escola_id: e1, titulo, texto: '.', tipo: 'aviso', fixado: false, para_alunos: true, para_pais: true, turmas: [], alunos: [], ...extra }]);
await com('todos');
await com('so-6A', { turmas: [t6] });
await com('pais-9A', { para_alunos: false, turmas: [t9] });
await com('so-carla', { alunos: [carla] });
await com('alunos-todos', { para_pais: false });

// ---- primeiro acesso: o e-mail liga a conta ao cadastro
await t('vincular_conta liga pelo e-mail (sem diferenciar maiúsculas)', async () => {
  assert.equal((await como('pai', 'select vincular_conta() n'))[0].n, 1);
  assert.equal((await como('ana', 'select vincular_conta() n'))[0].n, 1);
  assert.equal((await como('carla', 'select vincular_conta() n'))[0].n, 1);
  assert.equal((await como('intruso', 'select vincular_conta() n'))[0].n, 0);
});

const mural = nome => como(nome, 'select titulo from comunicados order by titulo').then(r => r.map(x => x.titulo));
await t('responsável vê o que atinge algum filho, no papel de pai', async () => {
  assert.deepEqual(await mural('pai'), ['pais-9A', 'so-6A', 'todos']);
});
await t('aluno vê só o que é para alunos e o atinge', async () => {
  assert.deepEqual(await mural('ana'), ['alunos-todos', 'so-6A', 'todos']);
  assert.deepEqual(await mural('carla'), ['alunos-todos', 'so-carla', 'todos']);
});
await t('quem não tem vínculo e o admin de outra escola não veem nada', async () => {
  assert.deepEqual(await mural('intruso'), []);
  assert.deepEqual(await mural('adm2'), []);
  assert.deepEqual(await como('adm2', 'select id from membros where escola_id = $1', [e1]), []);
  assert.deepEqual(await como('intruso', 'select id from turmas'), []);
});
await t('admin vê tudo da própria escola', async () => {
  assert.equal((await mural('adm')).length, 5);
  assert.equal((await como('adm', 'select id from membros')).length, 5);
});
await t('responsável vê a si, os filhos e só eles', async () => {
  const nomes = (await como('pai', 'select nome from membros order by nome')).map(r => r.nome);
  assert.deepEqual(nomes, ['Ana', 'Bruno', 'Pai']);
});
await t('aluno vê os próprios responsáveis, não colegas', async () => {
  const nomes = (await como('ana', 'select nome from membros order by nome')).map(r => r.nome);
  assert.deepEqual(nomes, ['Ana', 'Pai']);
});
await t('destinatários individuais não vazam para outras famílias', async () => {
  assert.deepEqual(await como('pai', 'select * from comunicado_aluno'), []);
  assert.equal((await como('carla', 'select * from comunicado_aluno')).length, 1);
});
await t('pai e aluno não escrevem', async () => {
  await falha(com.call(null, 'x').then(() => como('pai', `insert into comunicados (escola_id, titulo, texto) values ($1, 'hack', '.')`, [e1])));
  assert.deepEqual(await como('pai', `update comunicados set titulo = 'hack' returning id`), []);
  assert.deepEqual(await como('ana', `delete from turmas returning id`), []);
  await falha(como('pai', `insert into aluno_responsavel (escola_id, aluno_id, responsavel_id) values ($1, $2, $3)`, [e1, carla, pai]));
});
await t('ninguém aponta um cadastro para outra conta (user_id)', async () => {
  await falha(como('adm', `update membros set user_id = $1 where id = $2`, [users.intruso.id, bruno]));
  await falha(como('adm', `insert into membros (escola_id, perfil, nome, user_id) values ($1, 'admin', 'x', $2)`, [e1, users.intruso.id]));
});
await t('não dá para ligar aluno de uma escola a turma de outra', async () => {
  const [{ id: t2 }] = await como('adm2', `insert into turmas (escola_id, nome) values ($1, 'X') returning id`, [e2]);
  await falha(como('adm2', `insert into aluno_turma (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, [e2, ana, t2]));
  await falha(como('adm', `insert into aluno_turma (escola_id, aluno_id, turma_id) values ($1, $2, $3)`, [e1, ana, t2]));
});
await t('leitura só de comunicado visível e só em nome próprio', async () => {
  const cid = async tit => (await como('adm', 'select id from comunicados where titulo = $1', [tit]))[0].id;
  await como('pai', 'insert into leituras (comunicado_id, membro_id) values ($1, $2)', [await cid('so-6A'), pai]);
  await falha(como('pai', 'insert into leituras (comunicado_id, membro_id) values ($1, $2)', [await cid('so-carla'), pai]));
  await falha(como('pai', 'insert into leituras (comunicado_id, membro_id) values ($1, $2)', [await cid('todos'), ana]));
  assert.equal((await como('adm', 'select * from leituras')).length, 1);
});
await t('editar comunicado troca o público de forma atômica', async () => {
  const [{ id }] = await como('adm', `select id from comunicados where titulo = 'so-6A'`);
  await como('adm', 'select salvar_comunicado($1)', [{ id, escola_id: e1, titulo: 'so-6A', texto: '.', tipo: 'aviso', fixado: false, para_alunos: true, para_pais: true, turmas: [t9], alunos: [] }]);
  assert.ok(!(await mural('ana')).includes('so-6A'));
  assert.ok((await mural('carla')).includes('so-6A'));
});
await t('todos veem a grade da escola; ninguém de fora vê', async () => {
  assert.equal((await como('ana', 'select * from aulas')).length, 1);
  assert.equal((await como('adm2', 'select * from aulas')).length, 0);
});
await t('loja: membros veem os preços, só o admin edita, outra escola não vê', async () => {
  await como('adm', `insert into produtos (escola_id, nome, preco) values ($1, 'Camiseta', 59.9)`, [e1]);
  assert.equal((await como('pai', 'select * from produtos')).length, 1);
  assert.equal((await como('ana', 'select * from produtos')).length, 1);
  assert.equal((await como('adm2', 'select * from produtos')).length, 0);
  await falha(como('pai', `insert into produtos (escola_id, nome, preco) values ($1, 'X', 1)`, [e1]));
  assert.deepEqual(await como('pai', `update produtos set preco = 1 returning id`), []);
  assert.deepEqual(await como('adm2', `delete from produtos returning id`), []);
});
await t('RA salvo pelo admin; foto visível só para a família e o admin', async () => {
  await como('adm', `select salvar_membro($1)`, [{ id: ana, escola_id: e1, perfil: 'aluno', nome: 'Ana', email: 'ana@x.com', ra: ' 000123456-7 ' }]);
  assert.equal((await como('adm', 'select ra from membros where id = $1', [ana]))[0].ra, '000123456-7');
  const foto = a => `${e1}/${a}.jpg`;
  const ve = async (nome, a) => (await como(nome, 'select pode_ver_foto($1) v', [foto(a)]))[0].v;
  assert.equal(await ve('pai', ana), true);
  assert.equal(await ve('ana', ana), true);
  assert.equal(await ve('pai', carla), false);
  assert.equal(await ve('ana', bruno), false);
  assert.equal(await ve('adm', carla), true);
  assert.equal(await ve('adm2', ana), false);
  assert.equal((await como('pai', 'select pode_enviar_foto($1) v', [foto(ana)]))[0].v, false);
  assert.equal((await como('adm', 'select pode_enviar_foto($1) v', [foto(ana)]))[0].v, true);
  assert.equal((await como('adm', 'select pode_ver_foto($1) v', ['../x.jpg']))[0].v, false);
});
await t('RA não se repete na mesma escola; pode repetir em outra', async () => {
  await falha(como('adm', `select salvar_membro($1)`, [{ id: bruno, escola_id: e1, perfil: 'aluno', nome: 'Bruno', ra: '000123456-7 ' }]), 'RA repetido');
  await como('adm', `select salvar_membro($1)`, [{ id: bruno, escola_id: e1, perfil: 'aluno', nome: 'Bruno', ra: '' }]);
  await como('adm', `select salvar_membro($1)`, [{ id: carla, escola_id: e1, perfil: 'aluno', nome: 'Carla', ra: '' }]);
  await como('adm2', `select salvar_membro($1)`, [{ escola_id: e2, perfil: 'aluno', nome: 'Outra Ana', ra: '000123456-7' }]);
});
await t('admin não remove a si mesmo', async () => {
  assert.deepEqual(await como('adm', `delete from membros where perfil = 'admin' returning id`), []);
});

// ---- seed de demonstração carrega e respeita as regras
await db.exec(readFileSync(new URL('../seed.sql', import.meta.url), 'utf8'));
await user('marcia');
await db.query('update auth.users set email = $1 where id = $2', ['marcia@demo.escola', users.marcia.id]);
users.marcia.email = 'marcia@demo.escola';
await t('seed: responsável da demo vê o mural certo', async () => {
  await como('marcia', 'select vincular_conta()');
  assert.deepEqual(await mural('marcia'), ['Aulas suspensas na sexta-feira', 'Feira de Ciências', 'Reunião de pais e mestres']);
  assert.equal((await como('marcia', `select * from aulas where escola_id = 'e0000000-0000-0000-0000-000000000001'`)).length, 4 * 5 * 3 + 2);
});

console.log(`\n${ok} testes passaram`);
