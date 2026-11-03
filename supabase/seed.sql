-- Escola de demonstração para desenvolvimento local (supabase db reset).
-- Os cadastros não têm conta: entre no app com um destes e-mails e o código
-- chega no Inbucket (http://127.0.0.1:54324). O primeiro acesso liga a conta.
--   secretaria@demo.escola  admin
--   marcia@demo.escola      responsável de Ana e Bruno
--   paulo@demo.escola       responsável de Carla e Diego
--   ana@demo.escola         aluna (6º ano A + Robótica)

insert into escolas (id, nome) values ('e0000000-0000-0000-0000-000000000001', 'Escola Demonstração');

insert into membros (id, escola_id, perfil, nome, email, telefone, matricula) values
  ('a0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'admin', 'Secretaria', 'secretaria@demo.escola', null, null),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aluno', 'Ana Souza', 'ana@demo.escola', null, '2026001'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'aluno', 'Bruno Souza', null, null, '2026002'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'aluno', 'Carla Lima', null, null, '2026003'),
  ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'aluno', 'Diego Lima', null, null, '2026004'),
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'aluno', 'Elisa Martins', null, null, '2026005'),
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pai', 'Márcia Souza', 'marcia@demo.escola', '(51) 99999-0001', null),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pai', 'Paulo Lima', 'paulo@demo.escola', '(51) 99999-0002', null);

insert into turmas (id, escola_id, nome, turno) values
  ('c0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', '6º ano A', 'Manhã'),
  ('c0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', '7º ano B', 'Manhã'),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', '9º ano A', 'Tarde'),
  ('c0000000-0000-0000-0000-0000000000ab', 'e0000000-0000-0000-0000-000000000001', 'Robótica', 'Contraturno');

insert into aluno_turma (escola_id, aluno_id, turma_id)
select 'e0000000-0000-0000-0000-000000000001', a::uuid, t::uuid from (values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000ab'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000009'),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-0000000000ab'),
  ('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000009')) v(a, t);

insert into aluno_responsavel (escola_id, aluno_id, responsavel_id)
select 'e0000000-0000-0000-0000-000000000001', a::uuid, r::uuid from (values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002')) v(a, r);

-- Grade: 4 aulas de 50 min por dia nas turmas regulares; Robótica terça e quinta.
insert into aulas (escola_id, turma_id, dia, inicio, fim, disciplina, sala)
select t.escola_id, t.id, d, ini, ini + interval '50 minutes',
       (array['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês'])[1 + (d + n * 2) % 6],
       'Sala ' || n
  from turmas t
  cross join generate_series(1, 5) d
  cross join lateral (select n, (case when t.turno = 'Tarde' then '13:30' else '07:30' end)::time
                                + (n - 1) * interval '50 minutes' + case when n > 2 then interval '20 minutes' else interval '0' end as ini
                        from generate_series(1, 4) n) h
 where t.turno <> 'Contraturno';
insert into aulas (escola_id, turma_id, dia, inicio, fim, disciplina, professor, sala) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000ab', 2, '17:30', '19:00', 'Robótica', 'Prof. Leo', 'Laboratório Maker'),
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000ab', 4, '17:30', '19:00', 'Robótica', 'Prof. Leo', 'Laboratório Maker');

insert into comunicados (id, escola_id, tipo, titulo, texto, fixado, para_alunos, para_pais, autor_id) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'urgente', 'Aulas suspensas na sexta-feira', 'Por manutenção elétrica no prédio, não haverá aula na sexta-feira.', true, true, true, null),
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'evento', 'Reunião de pais e mestres', 'Reunião do bimestre no auditório, às 19h.', false, false, true, null),
  ('d0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'evento', 'Feira de Ciências', 'Entreguem o tema do projeto até o fim do mês.', false, true, true, null),
  ('d0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'aviso', 'Kit de Robótica', 'Tragam o kit de montagem na próxima aula.', false, true, false, null),
  ('d0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'aviso', 'Documentação pendente', 'Falta entregar o comprovante de residência na secretaria.', false, false, true, null);

insert into comunicado_turma (escola_id, comunicado_id, turma_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006'),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007'),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-0000000000ab');

insert into comunicado_aluno (escola_id, comunicado_id, aluno_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003');

-- Loja (preços fictícios)
insert into produtos (escola_id, categoria, nome, descricao, preco, tamanhos, disponivel) values
  ('e0000000-0000-0000-0000-000000000001', 'Uniforme', 'Camiseta manga curta', 'Malha PV com o brasão da escola.', 54.90, '4, 6, 8, 10, 12, 14, P, M, G', true),
  ('e0000000-0000-0000-0000-000000000001', 'Uniforme', 'Calça de moletom', 'Moletom flanelado.', 89.90, '4, 6, 8, 10, 12, 14, P, M, G', true),
  ('e0000000-0000-0000-0000-000000000001', 'Agasalho', 'Jaqueta com capuz', 'Forro de moletom e zíper frontal.', 159.90, 'P, M, G', false),
  ('e0000000-0000-0000-0000-000000000001', 'Acessórios', 'Garrafa de 500 ml', 'Inox, com o logotipo da escola.', 69.90, null, true);
