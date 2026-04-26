# Sistema AT Frontend

Documentacao tecnica do frontend Next.js responsavel pelo fluxo operacional de paciente, rotina, prescricao e calendario posologico.

## Stack tecnica

- Next.js App Router
- TypeScript
- Tailwind CSS
- Componentes de UI reutilizaveis
- TanStack Query
- React Hook Form
- Zod
- date-fns
- lucide-react

## Pre-requisitos

- Node.js 20+
- npm 10+
- Backend rodando e acessivel (padrao: http://localhost:3000/api)

## Setup rapido

1. Instalar dependencias

```bash
npm install
```

2. Criar arquivo .env.local

```env
BACKEND_API_URL=http://localhost:3000/api
```

3. Rodar em modo desenvolvimento

```bash
npm run dev
```

Aplicacao local:

```text
http://localhost:3001
```

## Scripts

```bash
# Desenvolvimento
npm run dev

# Build de producao
npm run build

# Servir build
npm run start

# Lint
npm run lint
```

## Como o frontend conversa com o backend

- O frontend nao chama o backend diretamente do browser.
- As chamadas passam por rota interna Next.js em /api/backend/*.
- Essa rota faz proxy para BACKEND_API_URL.
- O cliente de API centraliza parse de resposta e padroniza erros.

Fluxo de request:

```text
Tela React -> /api/backend/* (Next Route Handler) -> BACKEND_API_URL -> Backend NestJS
```

## Fluxo funcional da interface

Ordem recomendada no workspace:

1. Criar ou selecionar paciente
2. Cadastrar rotina ativa
3. Carregar catalogo clinico (seed no backend, se necessario)
4. Montar prescricao (medicamentos, protocolo, fases e recorrencia)
5. Gerar/visualizar calendario posologico
6. Revisar doses com status ACTIVE, INACTIVE e MANUAL_ADJUSTMENT_REQUIRED

## Estrutura relevante

- src/app
	- App Router, layout e rota proxy /api/backend
- src/features/workspace
	- Fluxo principal da aplicacao (steps de paciente, rotina, prescricao e calendario)
- src/lib/api
	- Cliente HTTP, servicos e chaves de cache
- src/lib/schemas
	- Validacoes de formulario com Zod
- src/types
	- Contratos de dados compartilhados com o backend

## Padrao de erros e feedback

- Erros HTTP sao encapsulados em ApiError no cliente.
- Quando o backend retorna message como array, o frontend concatena mensagens para exibir feedback unico.
- Status de dose no calendario sao mapeados para variacoes visuais:
	- ACTIVE
	- INACTIVE
	- MANUAL_ADJUSTMENT_REQUIRED

## Troubleshooting essencial

1. Erro de conexao com backend
	 - Sintoma: falhas em carregamento de pacientes, catalogo ou prescricao.
	 - Causa provavel: BACKEND_API_URL incorreta ou backend parado.
	 - Como resolver: validar .env.local, subir backend e reiniciar npm run dev.

2. Requisicoes respondem 404 no proxy
	 - Sintoma: rota /api/backend/* nao encontra recurso.
	 - Causa provavel: endpoint inexistente no backend ou prefixo incorreto na URL base.
	 - Como resolver: confirmar BACKEND_API_URL com sufixo /api e rotas oficiais do backend.

3. Erro 422 ao salvar formularios
	 - Sintoma: backend rejeita payload de rotina/prescricao.
	 - Causa provavel: dados fora das regras (frequencia, recorrencia, manualTimes, etc.).
	 - Como resolver: revisar valores do formulario e mensagens exibidas na tela.

4. Catalogo vazio na etapa de prescricao
	 - Sintoma: lista de medicamentos sem opcoes.
	 - Causa provavel: seed ainda nao executado no backend.
	 - Como resolver: executar seed no backend e recarregar a tela.

5. Porta esperada diferente
	 - Sintoma: aplicacao nao abre em localhost:3000.
	 - Causa provavel: frontend configurado para rodar na porta 3001.
	 - Como resolver: acessar http://localhost:3001.

6. Mudou .env.local e nada aconteceu
	 - Sintoma: frontend continua usando URL antiga do backend.
	 - Causa provavel: variaveis de ambiente do Next.js carregam no boot do processo.
	 - Como resolver: reiniciar npm run dev apos alterar .env.local.

## Boas praticas de desenvolvimento

- Mantenha contratos em src/types alinhados com DTOs do backend.
- Ao alterar regras de formulario, atualize schemas Zod e feedback visual.
- Antes de subir PR, execute lint e valide o fluxo completo no workspace.
