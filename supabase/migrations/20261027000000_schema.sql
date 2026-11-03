-- Escola App — schema multi-escola com RLS.
-- Toda linha pertence a uma escola (escola_id). As tabelas de ligação usam
-- chaves estrangeiras compostas (id, escola_id), então é impossível ligar um
-- aluno de uma escola a uma turma ou responsável de outra.


-- ---------------------------------------------------------------- tabelas

create table escolas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);

-- Pessoas da escola. user_id fica nulo até a pessoa entrar pela primeira vez
-- com o e-mail cadastrado (ver vincular_conta).
create table membros (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas on delete cascade,
  user_id uuid references auth.users on delete set null,
  perfil text not null check (perfil in ('admin', 'pai', 'aluno')),
  nome text not null check (length(trim(nome)) > 0),
  email text,
  telefone text,
  matricula text,
  criado_em timestamptz not null default now(),
  unique (id, escola_id),
  unique (escola_id, perfil, user_id)
);
create unique index membros_email_unico on membros (escola_id, perfil, lower(email)) where email is not null and email <> '';
create index on membros (user_id);

create table turmas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  turno text not null default 'Manhã',
  unique (id, escola_id)
);

create table aluno_turma (
  escola_id uuid not null,
  aluno_id uuid not null,
  turma_id uuid not null,
  primary key (aluno_id, turma_id),
  foreign key (aluno_id, escola_id) references membros (id, escola_id) on delete cascade,
  foreign key (turma_id, escola_id) references turmas (id, escola_id) on delete cascade
);
create index on aluno_turma (turma_id);

create table aluno_responsavel (
  escola_id uuid not null,
  aluno_id uuid not null,
  responsavel_id uuid not null,
  primary key (aluno_id, responsavel_id),
  foreign key (aluno_id, escola_id) references membros (id, escola_id) on delete cascade,
  foreign key (responsavel_id, escola_id) references membros (id, escola_id) on delete cascade
);
create index on aluno_responsavel (responsavel_id);

create table aulas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null,
  turma_id uuid not null,
  dia smallint not null check (dia between 1 and 6),
  inicio time not null,
  fim time not null check (fim > inicio),
  disciplina text not null,
  professor text,
  sala text,
  foreign key (turma_id, escola_id) references turmas (id, escola_id) on delete cascade
);
create index on aulas (turma_id);

create table comunicados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas on delete cascade,
  tipo text not null default 'aviso' check (tipo in ('aviso', 'evento', 'urgente')),
  titulo text not null check (length(trim(titulo)) > 0),
  texto text not null,
  fixado boolean not null default false,
  para_alunos boolean not null default true,
  para_pais boolean not null default true,
  autor_id uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  check (para_alunos or para_pais),
  unique (id, escola_id)
);
create index on comunicados (escola_id, criado_em desc);

-- Sem linhas em comunicado_turma nem em comunicado_aluno = escola inteira.
create table comunicado_turma (
  escola_id uuid not null,
  comunicado_id uuid not null,
  turma_id uuid not null,
  primary key (comunicado_id, turma_id),
  foreign key (comunicado_id, escola_id) references comunicados (id, escola_id) on delete cascade,
  foreign key (turma_id, escola_id) references turmas (id, escola_id) on delete cascade
);

create table comunicado_aluno (
  escola_id uuid not null,
  comunicado_id uuid not null,
  aluno_id uuid not null,
  primary key (comunicado_id, aluno_id),
  foreign key (comunicado_id, escola_id) references comunicados (id, escola_id) on delete cascade,
  foreign key (aluno_id, escola_id) references membros (id, escola_id) on delete cascade
);

create table leituras (
  comunicado_id uuid not null references comunicados on delete cascade,
  membro_id uuid not null references membros on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (comunicado_id, membro_id)
);

-- ------------------------------------------------- funções de autorização
-- security definer: leem as tabelas sem passar pelo RLS, o que evita
-- recursão entre políticas. Todas filtram por auth.uid().

create function e_membro(escola uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where escola_id = escola and user_id = auth.uid());
$$;

create function e_admin(escola uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where escola_id = escola and user_id = auth.uid() and perfil = 'admin');
$$;

-- Alunos que o usuário enxerga e por qual papel: o próprio aluno ('aluno')
-- ou um filho ('pai').
create function contexto_alunos() returns table (aluno_id uuid, escola_id uuid, via text)
language sql stable security definer set search_path = public as $$
  select m.id, m.escola_id, 'aluno' from membros m
   where m.user_id = auth.uid() and m.perfil = 'aluno'
  union
  select ar.aluno_id, ar.escola_id, 'pai' from aluno_responsavel ar
    join membros m on m.id = ar.responsavel_id
   where m.user_id = auth.uid() and m.perfil = 'pai';
$$;

-- Membros visíveis para quem não é admin: a si mesmo, os alunos do seu
-- contexto e os responsáveis desses alunos.
create function membros_visiveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from membros where user_id = auth.uid()
  union select aluno_id from contexto_alunos()
  union select ar.responsavel_id from aluno_responsavel ar
          where ar.aluno_id in (select aluno_id from contexto_alunos());
$$;

-- A regra do mural: o comunicado é para o papel do usuário (aluno ou pai)
-- e atinge algum aluno do contexto (escola toda, turma dele ou ele direto).
create function pode_ver_comunicado(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comunicados c
      join contexto_alunos() ctx on ctx.escola_id = c.escola_id
     where c.id = cid
       and ((ctx.via = 'aluno' and c.para_alunos) or (ctx.via = 'pai' and c.para_pais))
       and (
         (not exists (select 1 from comunicado_turma where comunicado_id = c.id)
          and not exists (select 1 from comunicado_aluno where comunicado_id = c.id))
         or exists (select 1 from comunicado_aluno ca where ca.comunicado_id = c.id and ca.aluno_id = ctx.aluno_id)
         or exists (select 1 from comunicado_turma ct
                      join aluno_turma at on at.turma_id = ct.turma_id
                     where ct.comunicado_id = c.id and at.aluno_id = ctx.aluno_id)
       )
  );
$$;

-- --------------------------------------------------------------------- RLS

alter table escolas enable row level security;
alter table membros enable row level security;
alter table turmas enable row level security;
alter table aluno_turma enable row level security;
alter table aluno_responsavel enable row level security;
alter table aulas enable row level security;
alter table comunicados enable row level security;
alter table comunicado_turma enable row level security;
alter table comunicado_aluno enable row level security;
alter table leituras enable row level security;

create policy ler on escolas for select using (e_membro(id));
create policy editar on escolas for update using (e_admin(id));

create policy ler on membros for select using (e_admin(escola_id) or id in (select membros_visiveis()));
create policy admin_insere on membros for insert with check (e_admin(escola_id));
create policy admin_edita on membros for update using (e_admin(escola_id)) with check (e_admin(escola_id));
-- O admin não apaga o próprio registro de admin (a escola ficaria sem dono).
create policy admin_apaga on membros for delete using (e_admin(escola_id) and user_id is distinct from auth.uid());

create policy ler on turmas for select using (e_membro(escola_id));
create policy admin on turmas for all using (e_admin(escola_id)) with check (e_admin(escola_id));

create policy ler on aluno_turma for select using (e_admin(escola_id) or aluno_id in (select aluno_id from contexto_alunos()));
create policy admin on aluno_turma for all using (e_admin(escola_id)) with check (e_admin(escola_id));

create policy ler on aluno_responsavel for select using (e_admin(escola_id) or aluno_id in (select aluno_id from contexto_alunos()));
create policy admin on aluno_responsavel for all using (e_admin(escola_id)) with check (e_admin(escola_id));

create policy ler on aulas for select using (e_membro(escola_id));
create policy admin on aulas for all using (e_admin(escola_id)) with check (e_admin(escola_id));

create policy ler on comunicados for select using (e_admin(escola_id) or pode_ver_comunicado(id));
create policy admin on comunicados for all using (e_admin(escola_id)) with check (e_admin(escola_id));

create policy ler on comunicado_turma for select using (e_admin(escola_id) or pode_ver_comunicado(comunicado_id));
create policy admin on comunicado_turma for all using (e_admin(escola_id)) with check (e_admin(escola_id));

-- Fora do admin, só a linha do próprio aluno: não revela quem mais recebeu.
create policy ler on comunicado_aluno for select using (
  e_admin(escola_id) or (aluno_id in (select aluno_id from contexto_alunos()) and pode_ver_comunicado(comunicado_id)));
create policy admin on comunicado_aluno for all using (e_admin(escola_id)) with check (e_admin(escola_id));

-- Cada um marca a própria leitura; o admin vê as leituras da escola.
create policy ler on leituras for select using (
  membro_id in (select id from membros where user_id = auth.uid())
  or exists (select 1 from membros m where m.id = membro_id and e_admin(m.escola_id)));
create policy marcar on leituras for insert with check (
  membro_id in (select id from membros where user_id = auth.uid()) and pode_ver_comunicado(comunicado_id));

-- user_id só muda por vincular_conta() e criar_escola(): nem o admin
-- consegue apontar um cadastro para a conta de outra pessoa.
revoke insert, update on membros from anon, authenticated;
grant insert (escola_id, perfil, nome, email, telefone, matricula) on membros to authenticated;
grant update (perfil, nome, email, telefone, matricula) on membros to authenticated;
revoke all on all tables in schema public from anon;

-- ------------------------------------------------------------------- RPCs

-- Liga a conta recém-logada aos cadastros feitos com o mesmo e-mail.
-- O e-mail vem do JWT, que o Supabase só emite depois de confirmar o e-mail.
create function vincular_conta() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  update membros set user_id = auth.uid()
   where user_id is null and email <> ''
     and lower(email) = lower(auth.jwt() ->> 'email');
  get diagnostics n = row_count;
  return n;
end $$;

create function criar_escola(nome_escola text, nome_admin text) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into escolas (nome) values (nome_escola) returning id into eid;
  insert into membros (escola_id, user_id, perfil, nome, email)
  values (eid, auth.uid(), 'admin', nome_admin, auth.jwt() ->> 'email');
  return eid;
end $$;

-- As RPCs abaixo rodam como o usuário (security invoker), então o RLS vale
-- normalmente; elas só garantem que a gravação e os vínculos sejam atômicos.

create function salvar_comunicado(c jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare cid uuid := nullif(c ->> 'id', '')::uuid;
        eid uuid := (c ->> 'escola_id')::uuid;
begin
  if cid is null then
    insert into comunicados (escola_id, tipo, titulo, texto, fixado, para_alunos, para_pais)
    values (eid, c ->> 'tipo', c ->> 'titulo', c ->> 'texto', (c ->> 'fixado')::boolean,
            (c ->> 'para_alunos')::boolean, (c ->> 'para_pais')::boolean)
    returning id into cid;
  else
    update comunicados set tipo = c ->> 'tipo', titulo = c ->> 'titulo', texto = c ->> 'texto',
           fixado = (c ->> 'fixado')::boolean, para_alunos = (c ->> 'para_alunos')::boolean,
           para_pais = (c ->> 'para_pais')::boolean
     where id = cid and escola_id = eid;
    if not found then raise exception 'comunicado não encontrado'; end if;
    delete from comunicado_turma where comunicado_id = cid;
    delete from comunicado_aluno where comunicado_id = cid;
  end if;
  insert into comunicado_turma (escola_id, comunicado_id, turma_id)
    select eid, cid, t::uuid from jsonb_array_elements_text(coalesce(c -> 'turmas', '[]')) t;
  insert into comunicado_aluno (escola_id, comunicado_id, aluno_id)
    select eid, cid, a::uuid from jsonb_array_elements_text(coalesce(c -> 'alunos', '[]')) a;
  return cid;
end $$;

-- Salva aluno ou responsável. Para aluno, `ligados` são responsáveis e
-- `turmas` as turmas; para responsável, `ligados` são os filhos.
create function salvar_membro(m jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare mid uuid := nullif(m ->> 'id', '')::uuid;
        eid uuid := (m ->> 'escola_id')::uuid;
        p text := m ->> 'perfil';
begin
  if mid is null then
    insert into membros (escola_id, perfil, nome, email, telefone, matricula)
    values (eid, p, m ->> 'nome', nullif(trim(m ->> 'email'), ''), m ->> 'telefone', m ->> 'matricula')
    returning id into mid;
  else
    update membros set nome = m ->> 'nome', email = nullif(trim(m ->> 'email'), ''),
           telefone = m ->> 'telefone', matricula = m ->> 'matricula'
     where id = mid and escola_id = eid;
    if not found then raise exception 'cadastro não encontrado'; end if;
  end if;

  if p = 'aluno' then
    if m ? 'turmas' then
      delete from aluno_turma where aluno_id = mid;
      insert into aluno_turma (escola_id, aluno_id, turma_id)
        select eid, mid, t::uuid from jsonb_array_elements_text(m -> 'turmas') t;
    end if;
    if m ? 'ligados' then
      delete from aluno_responsavel where aluno_id = mid;
      insert into aluno_responsavel (escola_id, aluno_id, responsavel_id)
        select eid, mid, r::uuid from jsonb_array_elements_text(m -> 'ligados') r;
    end if;
  elsif p = 'pai' and m ? 'ligados' then
    delete from aluno_responsavel where responsavel_id = mid;
    insert into aluno_responsavel (escola_id, aluno_id, responsavel_id)
      select eid, a::uuid, mid from jsonb_array_elements_text(m -> 'ligados') a;
  end if;
  return mid;
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- Mural ao vivo: o Realtime respeita o RLS, cada um só recebe o que pode ver.
alter publication supabase_realtime add table comunicados;
