# Medication Scheduler System (Sistema AT)

Sistema completo para aprazamento de medicamentos orientado pela rotina do paciente, com regras clinicas/farmacologicas, validacao de intervalos seguros e geracao de calendario posologico.

Este README geral consolida a visao do projeto usando:

- implementacao atual do repositorio
- diretrizes funcionais dos documentos:
	- Sistema de aprazamento de medicamentos para aplicativo.docx
	- Exemplos.docx

## Objetivo geral

Organizar os horarios de administracao de medicamentos com base em dois pilares:

- rotina real do paciente (acordar, cafe, almoco, lanche, jantar, dormir)
- condicoes de uso de cada farmaco (jejum, refeicao, horarios especificos, conflitos)

## Beneficios esperados

- facilitar adesao ao tratamento
- reduzir risco de doses muito proximas
- apoiar uso correto conforme orientacao farmaceutica
- organizar calendario posologico com linguagem operacional para paciente/equipe

## Escopo funcional consolidado

### 1) Cadastro de paciente e rotina

- coleta de dados pessoais
- definicao de rotina diaria base
- rotina usada como ancora para calculo de horarios

Intervalos minimos de referencia (descritos nos documentos):

- acordar -> cafe: minimo 1h
- cafe -> almoco: minimo 4h
- almoco -> lanche: minimo 3h
- lanche -> jantar: minimo 3h
- jantar -> dormir: minimo 2h

### 2) Cadastro clinico de medicamentos

Campos de negocio destacados nos documentos:

- nome comercial e principio ativo
- concentracao/apresentacao
- forma farmaceutica
- via de administracao
- dose/unidade posologica
- orientacoes de uso
- grupo clinico e frequencia
- marcadores especiais (PRN, insulina condicionada, otologico, oftalmico, etc.)

### 3) Prescricao e motor executor

- montagem de prescricao por paciente
- fases terapeuticas por medicamento
- suporte a recorrencias (diario, semanal, mensal, alternado, PRN)
- suporte a ajuste manual quando regra automatica nao resolve conflito

### 4) Calendario posologico e orientacoes

- geracao de agenda consolidada por horario
- status de dose (ativa, inativa, ajuste manual)
- contexto clinico de conflito no retorno da API
- estrutura pronta para consumo por frontend e emissao de documento final

## Arquitetura do repositorio

```text
medication-scheduler-system/
|- at-backend/      # API NestJS + TypeORM + PostgreSQL
|- at-frontend/     # App Next.js (workspace operacional)
|- ux-simulation/   # simulacao de experiencia/interacao
|- README.md        # visao geral do projeto
```

## Stack macro

- Backend: NestJS, TypeScript, TypeORM, PostgreSQL, class-validator
- Frontend: Next.js App Router, TypeScript, Tailwind, React Query, React Hook Form, Zod

## Fluxo ponta a ponta

1. cadastrar paciente
2. cadastrar rotina ativa
3. preparar catalogo clinico (seed e/ou cadastro)
4. criar prescricao com fases e recorrencias
5. gerar agenda por prescricao
6. analisar conflitos, inativacoes e itens com ajuste manual

## Como rodar o projeto completo

Use dois terminais.

Terminal 1 (backend):

```bash
cd at-backend
npm install
npm run migration:run
npm run seed
npm run start:dev
```

Terminal 2 (frontend):

```bash
cd at-frontend
npm install
npm run dev
```

URLs locais:

- backend API: http://localhost:3000/api
- frontend: http://localhost:3001

## Configuracao de ambiente (resumo)

Backend (.env em at-backend):

- conexao PostgreSQL
- parametros de cabecalho do calendario

Frontend (.env.local em at-frontend):

- BACKEND_API_URL=http://localhost:3000/api

Detalhes completos de setup e troubleshooting estao nos READMEs especificos:

- at-backend/README.md
- at-frontend/README.md

## Regras de negocio em destaque

Com base nos documentos e na implementacao atual:

- horarios sao derivados de ancoras da rotina + offsets clinicos
- grupos clinicos diferentes aplicam formulas e janelas diferentes
- conflitos podem causar:
	- deslocamento automatico
	- inativacao obrigatoria
	- sinalizacao para ajuste manual

Casos especiais cobertos no projeto:

- calcio
- sais/antiacidos
- sucralfato
- insulinas
- administracao oftalmica/otologica

## Fontes documentais usadas nesta consolidacao

- Sistema de aprazamento de medicamentos para aplicativo.docx
- Exemplos.docx

## Status da documentacao

- README geral: visao consolidada do produto e fluxo
- README backend: operacao tecnica da API, regras e troubleshooting
- README frontend: operacao tecnica da interface, proxy e troubleshooting

## Autores

Desenvolvido por Marcos Vitor e Marcos Vinicius.
