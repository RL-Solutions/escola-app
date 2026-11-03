/* Projeto Supabase. A chave anon é pública por design: quem protege os
   dados são as políticas de RLS do banco. Nunca coloque a service_role aqui.
   Local (supabase start): http://127.0.0.1:54321 e a anon key que o CLI mostra. */
window.ESCOLA_CONFIG = {
  supabaseUrl: 'https://xdqnvonrolrucgklzsnh.supabase.co',
  // Identidade desta instalação (white label). Sem `marca`, o app usa o nome
  // da escola e o ícone padrão.
  marca: {
    nome: 'Sua Escola',
    logo: 'assets/marca/logo.png',   // horizontal, fundo transparente
    selo: 'assets/marca/selo.png',   // só o monograma, para o cabeçalho
    faixa: 'assets/marca/faixa.png', // grafismo das pílulas, topo do login
  },
  // Contas de demonstração: botões na tela de entrada que entram sem e-mail.
  // A senha fica pública de propósito; essas contas só enxergam a escola de
  // demonstração. Apague este bloco numa instalação de escola real.
  demo: {
    senha: 'demo-escola-app-2026',
    contas: [
      { perfil: 'Secretaria', email: 'secretaria@escola-app.test', sobre: 'Painel, comunicados, cadastros e loja' },
      { perfil: 'Responsável', email: 'pai@escola-app.test', sobre: 'Marina, mãe da Ana e do Bruno' },
      { perfil: 'Aluno', email: 'ana@escola-app.test', sobre: 'Ana, do 6º ano A' },
    ],
  },
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcW52b25yb2xydWNna2x6c25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNTMwODgsImV4cCI6MjEwODcyOTA4OH0.yzipsoznZo6FwO5GnFSn_HmetqIy7QqqSxw1xKrMtI8',
};
