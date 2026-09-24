# Barbearia do Ratão

App web de agendamento e gestão da Barbearia do Ratão.
**React + Vite + Tailwind + Firebase** (Authentication + Firestore).

O que já funciona:

- Login por e-mail e senha, criação de conta e "esqueci a senha"
- Três perfis: **cliente**, **barbeiro** e **dono (admin)**, com regras de segurança por perfil
- **Cliente:** tela inicial com fotos de fundo e os barbeiros para escolher, agendamento em 4 passos (ou direto pelo barbeiro), ver e cancelar horários, remarcar, repetir último serviço
- **Ícone da marca:** o ícone pequeno usado nos cabeçalhos, na tela de "Carregando..." e no centro do QR Code e do banner do agendamento é o emblema do rato (mesma imagem do login). Para trocar, basta substituir `public/img/ratao-emblema.webp` (e a cópia de reserva `src/lib/brandEmblema.js`, se quiser mantê-la sincronizada)
- **Marca em imagem:** a tela de login usa o emblema do rato (`public/img/ratao-emblema.webp`) e o topo da página do cliente usa o letreiro dourado "Barbearia do Ratão" (`public/img/ratao-letreiro.webp`). Para trocar por outra imagem, substitua esses dois arquivos mantendo o mesmo nome. As fotos que o dono publica em Configurações entram depois do letreiro, no mesmo espaço. Se o arquivo de `public/img` não estiver no site, o app usa uma cópia das duas imagens que vai dentro do código (`src/lib/brandEmblema.js` e `brandLetreiro.js`), então a marca aparece mesmo assim
- **Banner do agendamento:** imagem profissional (logo, data e hora em destaque, cliente, serviço, valor, barbeiro com foto, endereço e QR do app), gerada no próprio navegador. O dono (na Agenda) e o barbeiro (no Modo barbeiro) escolhem **Enviar banner**, em versão "Confirmação" ou "Lembrete". No celular, o menu de compartilhar leva imagem e texto para o WhatsApp; no computador, baixa-se ou copia-se a imagem e anexa-se na conversa. O cliente também pode salvar o comprovante em imagem depois de agendar. Endereço, WhatsApp e Instagram que aparecem no banner ficam em Configurações. Observação: o WhatsApp não permite que um link anexe imagem sozinho; o envio automático da imagem direto ao número do cliente só existe pela API oficial do WhatsApp (paga)
- **Mensalistas** (aba do dono): planos mensais (valor, atendimentos incluídos por mês, serviços cobertos), cadastro do mensalista, uso do mês, registro do pagamento da mensalidade (pago, pendente ou vencido) e cobrança pelo WhatsApp. Ao dar baixa, o barbeiro escolhe "Cobrir com o plano" e o uso do mês sobe sozinho. A mensalidade entra no faturamento do Financeiro; o atendimento coberto não vira receita de novo, e a comissão do barbeiro usa o valor de tabela
- **Avisos ao barbeiro:** no Modo barbeiro, banner (com som e notificação, se ligados) quando entra ou é cancelado um agendamento dele, enquanto a tela estiver aberta. O cliente também pode avisar o barbeiro pelo WhatsApp ao concluir o agendamento (basta cadastrar o WhatsApp do barbeiro em Barbeiros)
- **Modo barbeiro** (endereço `/barbeiro`, feito para o celular): o barbeiro entra com o próprio login e cai direto na agenda do dia dele. Vê os horários livres entre os atendimentos e toca em **Encaixar** para colocar um cliente sem hora marcada. Dá **baixa** no atendimento escolhendo a forma de pagamento, marca falta e acompanha o que faturou e a própria comissão do dia
- **Barbeiro e dono:** agenda por dia e por semana com cores por status, agendamento manual, bloqueio de horário, confirmar, iniciar, concluir com forma de pagamento, marcar falta, cancelar
- **Dono:**
  - **Financeiro:** faturamento, despesas, comissões e resultado por período; formas de pagamento; lançar e excluir despesas; fechamento de comissão por barbeiro
  - **Serviços:** criar, editar, desativar e excluir (preço, duração, quem faz, combos)
  - **Barbeiros:** criar, editar, desativar e excluir (foto, folgas, almoço, comissão, serviços que faz)
  - **Acessos:** dar acesso de barbeiro ou dono e carregar dados de exemplo
  - **Configurações:** fotos da tela inicial, horário de funcionamento de cada dia (domingo incluso) e regras de agendamento
- Nunca deixa dois agendamentos no mesmo horário do mesmo barbeiro
- Cancelamento fora do prazo e faltas ficam registrados; excluir, cancelar e alterar valor pedem confirmação e vão para o registro (coleção `logs`)

Fica para as próximas etapas: abertura e fechamento de caixa, venda de produtos e estoque, tela de clientes (inativos, aniversários), fidelidade e cupons, relatórios em PDF/Excel, lembretes automáticos.

**Atualizando de uma versão anterior:** extraia esta pasta, rode `npm install` (há dependências novas) e **publique de novo o arquivo `firestore.rules`** no console (há regras novas para fotos e financeiro).

---

## Passo a passo para colocar no ar

O seu projeto Firebase (`barbearia-ratao`) e o arquivo `.env` já estão configurados. Falta ligar os serviços no console e rodar.

### 1. Ligar o login por e-mail
Console do Firebase > **Authentication** > **Começar** > aba **Método de login** > **E-mail/senha** > ativar > Salvar.

### 2. Criar o banco de dados
Console > **Firestore Database** > **Criar banco de dados**.
- Localização: **southamerica-east1 (São Paulo)**
- Modo: **produção**

### 3. Publicar as regras de segurança (importante!)
Console > Firestore Database > aba **Regras**. Apague tudo, cole o conteúdo do arquivo `firestore.rules` deste projeto e clique em **Publicar**.
Sem esse passo o app não consegue ler nem gravar nada.

### 4. Rodar no seu computador
Instale o Node.js (versão LTS, em nodejs.org). No terminal, dentro da pasta do projeto:

```
npm install
npm run dev
```
Abra o endereço que aparecer (normalmente http://localhost:5173).

### 5. Virar dono do sistema
1. No app, clique em **Criar conta** e cadastre você.
2. No Console > Firestore Database > coleção **users** > abra o seu documento > mude o campo `role` de `client` para `admin`.
3. Saia e entre de novo no app. Você cai direto no painel.

### 6. Carregar os dados de exemplo
No painel, clique em **Equipe** > **Carregar dados de exemplo** (3 barbeiros e 9 serviços). Depois você troca pelos dados reais.

### 7. Dar acesso aos barbeiros
Cada barbeiro cria a conta pelo link do app. Na tela **Equipe**, você muda o perfil dele para **Barbeiro** e escolhe qual barbeiro ele é. Aí ele vê só a própria agenda.

### 8. Testar
Crie uma segunda conta (de cliente), agende um horário e veja aparecer na agenda do painel. Teste cancelar, marcar falta e bloquear horário.

### 9. Publicar na internet (link grátis)
```
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```
O link fica no formato `https://barbearia-ratao.web.app`. Depois é só gerar um QR code desse link para o espelho e para o balcão.
Se o deploy reclamar do Hosting, rode `firebase init hosting` e escolha: pasta `dist`, aplicação de página única = **sim**, sobrescrever index.html = **não**.

---

## Como os dados são organizados (Firestore)

| Coleção | O que guarda | Quem lê | Quem grava |
|---|---|---|---|
| `users/{uid}` | nome, e-mail, telefone, `role` (`client`, `barber`, `admin`), `barberId` | o próprio e o dono | o próprio (só nome/telefone) e o dono |
| `settings/shop` | horário de funcionamento, intervalo, antecedências | todos | dono |
| `barbers/{id}` | nome, especialidade, cor, almoço, folgas, comissão | todos | dono |
| `services/{id}` | nome, categoria, preço, duração, barbeiros que fazem, combo | todos | dono |
| `appointments/{id}` | data, início/fim, barbeiro, cliente, serviços, valor, status | cliente (os seus), barbeiro (os dele), dono (todos) | cliente cria/cancela os seus; equipe gerencia |
| `days/{barbeiro_data}` | só os intervalos ocupados do dia (sem dados pessoais) | usuários logados | usuários logados |
| `blocks/{id}` | bloqueios de horário | equipe | equipe |
| `photos/{id}` | fotos da tela inicial (já reduzidas, guardadas como texto) | todos | dono |
| `expenses/{id}` | despesas: descrição, valor, data, categoria, fixa/variável | dono | dono |
| `commissionClosures/{id}` | fechamentos de comissão (barbeiro, período, valor) | dono | dono |
| `plans/{id}` | planos mensais: nome, valor, atendimentos por mês, serviços | equipe | dono |
| `subscriptions/{id}` | mensalistas: cliente, plano, valor, vencimento, `paid` (pagamentos por mês) e `usage` (atendimentos usados por mês) | equipe | dono; o barbeiro só soma `usage` |
| `logs/{id}` | cancelamentos, faltas, exclusões, bloqueios, valores alterados | dono | qualquer usuário grava o seu |

Horários são guardados em **minutos desde a meia-noite** (540 = 09:00) e datas como texto `AAAA-MM-DD`.

### Sobre as fotos
O Firebase Storage exige hoje o plano pago (Blaze). Para você não precisar de cartão, as fotos são reduzidas no navegador (cerca de 1100 px, JPEG) e guardadas no próprio Firestore. Cabem até 8 fotos na tela inicial. Se um dia migrar para o plano pago, dá para trocar para o Storage sem mudar o resto.

### Sobre o "nunca dois no mesmo horário"
O agendamento acontece dentro de uma **transação**: o app lê o mapa do dia em `days`, confere o conflito e grava o agendamento e o mapa juntos. Se duas pessoas tentarem o mesmo horário ao mesmo tempo, só uma passa.
Limite honesto desta etapa: as regras do Firestore validam o formato do mapa `days`, mas não conseguem conferir se o conteúdo é coerente. Um usuário mal-intencionado com conhecimento técnico poderia mexer nesse mapa. Para uma barbearia isso é um risco baixo, e o endurecimento (mover a reserva para uma Cloud Function) entra numa etapa futura.

## Estrutura de pastas

```
src/
  firebase.js            conexão com o Firebase (lê o .env)
  App.jsx                rotas e proteção por perfil
  context/               login, catálogo (serviços/barbeiros/config) e avisos
  hooks/                 useDays (horários ocupados), useMyAppointments
  lib/                   availability (regras de horário), bookings (transações), finance (cálculos), image, defaults, time
  components/ui.jsx      logo, poste de progresso, bilhete, janela, etc.
  pages/Login.jsx
  pages/client/          Home, Book (4 passos), Mine, Profile
  pages/staff/           Agenda, Financeiro, Serviços, Barbeiros, Acessos (Team), Configurações
firestore.rules          regras de segurança por perfil
firebase.json            hospedagem + regras
```

## Se algo der errado

- **"Missing or insufficient permissions"**: as regras do passo 3 não foram publicadas, ou o seu `role` ainda é `client`.
- **Tela pedindo "Falta conectar o Firebase"**: o arquivo `.env` não existe ou está incompleto.
- **O console pede um índice**: clique no link que aparece na mensagem de erro e confirme; ele cria o índice sozinho.
- **Barbeiro vê "login ainda não ligado a um barbeiro"**: faltou o passo 7.
