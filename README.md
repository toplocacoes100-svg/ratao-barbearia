# Barbearia do Ratão — Etapa 1

App web de agendamento e gestão da Barbearia do Ratão.
**React + Vite + Tailwind + Firebase** (Authentication + Firestore).

O que já funciona nesta etapa:

- Login por e-mail e senha, criação de conta e "esqueci a senha"
- Três perfis: **cliente**, **barbeiro** e **dono (admin)**, com regras de segurança por perfil
- **Cliente:** agendar em 4 passos (serviço, barbeiro, horário, confirmar), ver e cancelar horários, remarcar, repetir último serviço
- **Barbeiro e dono:** agenda por dia e por semana com cores por status, agendamento manual, bloqueio de horário, confirmar, iniciar, concluir, marcar falta, cancelar
- **Dono:** tela Equipe para dar acesso de barbeiro/dono e carregar dados de exemplo
- Nunca deixa dois agendamentos no mesmo horário do mesmo barbeiro
- Cancelamento fora do prazo e faltas ficam registrados; ações sensíveis pedem confirmação e vão para o registro (coleção `logs`)

Fica para as próximas etapas: telas para editar serviços/preços/barbeiros/configurações, caixa e comissões, clientes e relatórios, fidelidade e cupons.

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
| `logs/{id}` | cancelamentos, faltas, exclusões, bloqueios | dono | qualquer usuário grava o seu |

Horários são guardados em **minutos desde a meia-noite** (540 = 09:00) e datas como texto `AAAA-MM-DD`.

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
  lib/                   availability (regras de horário), bookings (transações), defaults, time
  components/ui.jsx      logo, poste de progresso, bilhete, janela, etc.
  pages/Login.jsx
  pages/client/          Home, Book (4 passos), Mine, Profile
  pages/staff/           Agenda, Team
firestore.rules          regras de segurança por perfil
firebase.json            hospedagem + regras
```

## Se algo der errado

- **"Missing or insufficient permissions"**: as regras do passo 3 não foram publicadas, ou o seu `role` ainda é `client`.
- **Tela pedindo "Falta conectar o Firebase"**: o arquivo `.env` não existe ou está incompleto.
- **O console pede um índice**: clique no link que aparece na mensagem de erro e confirme; ele cria o índice sozinho.
- **Barbeiro vê "login ainda não ligado a um barbeiro"**: faltou o passo 7.
