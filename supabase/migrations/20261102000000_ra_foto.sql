-- RA (registro do aluno) e foto de perfil, usados na carteirinha estudantil.
-- A foto fica no Storage, bucket privado "fotos", no caminho
-- <escola_id>/<membro_id>.jpg. membros.foto guarda esse caminho.

alter table membros add column ra text, add column foto text;
grant insert (ra, foto) on membros to authenticated;
grant update (ra, foto) on membros to authenticated;

create or replace function salvar_membro(m jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare mid uuid := nullif(m ->> 'id', '')::uuid;
        eid uuid := (m ->> 'escola_id')::uuid;
        p text := m ->> 'perfil';
begin
  if mid is null then
    insert into membros (escola_id, perfil, nome, email, telefone, matricula, ra)
    values (eid, p, m ->> 'nome', nullif(trim(m ->> 'email'), ''), m ->> 'telefone', m ->> 'matricula', nullif(trim(m ->> 'ra'), ''))
    returning id into mid;
  else
    update membros set nome = m ->> 'nome', email = nullif(trim(m ->> 'email'), ''),
           telefone = m ->> 'telefone', matricula = m ->> 'matricula',
           ra = case when m ? 'ra' then nullif(trim(m ->> 'ra'), '') else ra end
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
revoke execute on function salvar_membro(jsonb) from anon, public;
grant execute on function salvar_membro(jsonb) to authenticated;

-- Quem pode ver a foto: o admin da escola e quem tem o aluno no contexto
-- (o próprio aluno e os responsáveis dele). Só o admin envia ou apaga.
create function pode_ver_foto(caminho text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' then
    e_admin(split_part(caminho, '/', 1)::uuid)
    or split_part(split_part(caminho, '/', 2), '.', 1)::uuid in (select aluno_id from contexto_alunos())
  else false end
$$;
create function pode_enviar_foto(caminho text) returns boolean
language sql stable security definer set search_path = public as $$
  select caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and e_admin(split_part(caminho, '/', 1)::uuid)
$$;
revoke execute on function pode_ver_foto(text), pode_enviar_foto(text) from anon, public;
grant execute on function pode_ver_foto(text), pode_enviar_foto(text) to authenticated;

-- O Storage só existe no Supabase; nos testes (PGlite) este bloco é pulado.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('fotos', 'fotos', false, 1048576, array['image/jpeg']) on conflict (id) do nothing;
    execute $p$create policy fotos_ler on storage.objects for select to authenticated
      using (bucket_id = 'fotos' and pode_ver_foto(name))$p$;
    execute $p$create policy fotos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'fotos' and pode_enviar_foto(name))$p$;
    execute $p$create policy fotos_trocar on storage.objects for update to authenticated
      using (bucket_id = 'fotos' and pode_enviar_foto(name)) with check (bucket_id = 'fotos' and pode_enviar_foto(name))$p$;
    execute $p$create policy fotos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'fotos' and pode_enviar_foto(name))$p$;
  end if;
end $$;
