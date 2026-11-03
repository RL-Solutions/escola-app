-- Loja: catálogo de uniformes e materiais com preço. Só consulta: a compra é
-- combinada com a secretaria. Qualquer membro da escola vê; só admin edita.

create table produtos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null default 'Uniforme',
  descricao text,
  preco numeric(10, 2) not null check (preco >= 0),
  tamanhos text,
  disponivel boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on produtos (escola_id);

alter table produtos enable row level security;
create policy ler on produtos for select using (e_membro(escola_id));
create policy admin on produtos for all using (e_admin(escola_id)) with check (e_admin(escola_id));
