-- Dois alunos da mesma escola não podem ter o mesmo RA. A comparação ignora
-- maiúsculas e espaços nas pontas; RA vazio não conta.
create unique index membros_ra_unico on membros (escola_id, upper(trim(ra))) where ra is not null and trim(ra) <> '';
