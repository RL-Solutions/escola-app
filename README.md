# Escola App

SaaS escolar mobile-first (PWA instalável) sobre Supabase, com várias escolas
no mesmo banco e três perfis:

| Perfil | O que faz |
| --- | --- |
| **Admin** (secretaria) | Painel com pendências, comunicados com público filtrado e contagem de leitura, cadastro de alunos (com RA e foto) e responsáveis com vínculo, turmas e grade horária, equipe de admins, catálogo da loja (preço, tamanhos, disponibilidade) |
| **Responsável** | Mural filtrado pelos filhos (todos ou um por vez), horário de cada filho, loja com os preços dos uniformes, carteirinha estudantil dos filhos em PDF |
| **Aluno** | Mural da própria turma, horário do dia com a aula atual destacada, carteirinha estudantil em PDF |

## Identidade visual (white label)

O produto é white label: cada escola usa o app com a própria marca. Esta
instalação está com uma **marca genérica** ("Sua Escola"), criada para a
demonstração, sem relação com nenhuma escola real.

- **Logotipo e ícones** em `assets/marca/`, gerados para a demonstração:
  `logo.png` (horizontal, 410x110, fundo transparente), `selo.png` (só o
  símbolo, para o cabeçalho), `icon-192.png` e `icon-512.png` (ícone do app
  instalado) e `faixa.png` (grafismo do topo das telas).
- **Nome** em `marca.nome` no [js/config.js](js/config.js); o cabeçalho mostra
  o nome da escola cadastrado no banco.
- **Cores:** azul `#2b50d6` como destaque (contraste AA com texto branco) e
  grafite `#1d1d1f` nas faixas. Amarelo, ciano, roxo e rosa marcam turmas e
  tipos de comunicado; vermelho fica reservado para "Urgente".
- **Para uma escola nova:** troque os arquivos de `assets/marca/` (mesmos nomes
  e tamanhos), `marca.nome`, os tokens `--brand*` no topo do
  [css/app.css](css/app.css) (tema claro e escuro), a cor da linha da
  carteirinha em `gerarCarteirinha()` e o `name` do
  [manifest.json](manifest.json). Antes de usar a marca de uma escola, confirme
  com ela o direito de uso.

## Como funciona o acesso

- **Login sem senha:** a pessoa digita o e-mail e recebe um código (ou link).
- **Convite = cadastro:** o admin cadastra aluno ou responsável com o e-mail.
  No primeiro acesso, `vincular_conta()` liga a conta ao cadastro pelo e-mail
  confirmado no JWT. Sem cadastro, a pessoa pode criar uma escola nova e vira
  admin dela.
- Uma conta pode ter vários acessos (ex.: mãe numa escola e admin em outra):
  o app pergunta qual abrir.

## Segurança (RLS)

Tudo está em [supabase/migrations](supabase/migrations). Resumo:

- Toda linha tem `escola_id`; as tabelas de ligação usam chave estrangeira
  composta `(id, escola_id)`, então não dá para ligar dados de escolas diferentes.
- **Comunicados** (`pode_ver_comunicado`): o usuário vê o comunicado se ele é
  para o seu papel (aluno ou pais) **e** atinge algum aluno do seu contexto (ele
  mesmo, ou um filho), seja pela escola toda, pela turma ou direto ao aluno.
- Responsável vê só ele, os filhos e os outros responsáveis dos filhos; aluno
  vê só ele e os seus responsáveis. Destinatários individuais de um comunicado
  não aparecem para outras famílias.
- Só admin escreve. Ninguém, nem o admin, consegue apontar um cadastro para a
  conta de outra pessoa (`user_id` não tem permissão de escrita via API).
- Leitura (lido/não lido) só em nome próprio e de comunicado visível.
- O Realtime respeita o RLS: o mural atualiza sozinho com o que cada um pode ver.

Os testes em [supabase/tests/rls.test.mjs](supabase/tests/rls.test.mjs) rodam
o schema num Postgres embutido (PGlite) com um `auth` simulado e cobrem cada
regra acima:

```bash
npm install
npm test
```

## Rodar local (precisa do Docker)

```bash
npx supabase start
```

1. Copie a `anon key` exibida para `js/config.js` (a URL padrão já é `http://127.0.0.1:54321`).
2. `npx supabase db reset` aplica o schema e o [seed](supabase/seed.sql) (Escola Demonstração).
3. Na raiz da pasta de sites: `node serve.mjs 4321` e abra `http://localhost:4321/escola-app/`.
4. Entre com `secretaria@demo.escola`, `marcia@demo.escola`, `paulo@demo.escola`
   ou `ana@demo.escola`; o código chega no Inbucket em `http://127.0.0.1:54324`.

## Publicar

1. Crie o projeto no Supabase e rode `npx supabase link` e `npx supabase db push`
   (não suba o `seed.sql` para produção).
2. Em Authentication → URL Configuration, ponha a URL pública do app em
   *Site URL* e em *Redirect URLs*.
3. Em Authentication → Email Templates → Magic Link, inclua `{{ .Token }}` para
   o código de 6 dígitos aparecer no e-mail. Configure um SMTP próprio: o
   padrão do Supabase tem limite baixo de envios por hora, só entrega para
   e-mails da equipe da organização e, no plano grátis, não deixa editar o
   template (aí o e-mail traz só o link, que também faz o login).
4. Preencha `js/config.js` com a URL e a anon key do projeto (a anon key é
   pública; nunca use a `service_role` no front).
5. Publique a pasta como site estático (GitHub Pages, Netlify, Vercel).

## Limitações conhecidas

- Aluno sem e-mail não entra sozinho (o responsável vê tudo por ele).
- A grade horária é visível para qualquer membro da escola.
- Notificação push ainda não existe (o mural atualiza em tempo real com o app aberto).
- Cobrança/planos por escola ainda não existem.
- **Demonstração aberta:** com `demo` no [js/config.js](js/config.js), a tela de entrada mostra botões que entram sem e-mail nas contas de exemplo (senha pública). Qualquer visitante pode alterar os dados da escola de demonstração como secretaria; remova o bloco `demo` numa instalação real.
- A loja é só vitrine de preços: o pedido e o pagamento são feitos na secretaria.
- A carteirinha (PDF no tamanho de cartão, 85,6 x 54 mm) é gerada no aparelho. As fotos ficam no bucket privado `fotos` do Storage; só o admin envia, e só o admin, o aluno e os responsáveis dele veem. Ela não tem QR code nem validação on-line.
