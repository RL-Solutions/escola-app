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
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcW52b25yb2xydWNna2x6c25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNTMwODgsImV4cCI6MjEwODcyOTA4OH0.yzipsoznZo6FwO5GnFSn_HmetqIy7QqqSxw1xKrMtI8',
};
