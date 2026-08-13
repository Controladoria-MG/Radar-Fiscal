# CLAUDE.md — Regras de Projeto

## Estrutura de Diretórios

```
Raiz/
├── index.html
├── .gitignore
├── CLAUDE.md
├── static/
│   ├── script.js
│   └── style.css
├── data/
│   └── radar_fiscal/
└── backend/
    └── radar_fiscal.py
```

---

## Regras — OBRIGATÓRIO SEGUIR

### HTML
- O único arquivo `.html` do projeto é `index.html`, localizado **sempre na raiz**.
- **NUNCA** crie outros arquivos `.html` em subpastas.
- **NUNCA** escreva CSS ou JS inline dentro do HTML. Use os arquivos em `static/`.

### CSS e JS
- Todo `.css` e `.js` fica **exclusivamente** em `static/`.
- **NUNCA** crie subpastas dentro de `static/`.
- **NUNCA** misture lógica de backend com arquivos de `static/`.

### Dados (`data/`)
- **NUNCA** salve arquivos diretamente na raiz de `data/`.
- Todo arquivo de dados fica dentro de `data/radar_fiscal/`.
- `radar_fiscal.xlsx`: exportação bruta do Radar Fiscal (30 colunas), sobrescrita a cada execução.
- `planilha_mercados.xlsx`: exportação bruta da Planilha de Mercados / Controle de Status (26 colunas, aba "Gerencial"), filtrada por SP+GOIAS.
- `resumo.xlsx`: as duas bases acima já limpas e unidas (37 colunas) — é o que o portal usa. Ver "Regra de negócio do Resumo" abaixo.
- `radar_fiscal_dados.json`: subconjunto de colunas do resumo para o portal ler via `fetch` (o portal não faz parsing de `.xlsx` no navegador).
- `status.json`: `{ultima_execucao, registros}`, usado no header e no rodapé da página.

### Backend (`backend/`)
- `radar_fiscal.py`: um único robô que automatiza o programa desktop **MGApps > Sistema de Analise** (app WPF/WinForms local, não uma página web) via **pywinauto**. Em uma execução: exporta o Radar Fiscal, depois navega até Importação Fiscal > Análise Fechamento Escrita Fiscal > Controle de Status e exporta a Planilha de Mercados (SP+GOIAS), depois junta as duas (`_processar_resumo`) e gera `resumo.xlsx` + os JSONs do portal. Expõe `executar(log=None)`.
- **Não existe backend web** — o portal é 100% estático (lê os JSONs via `fetch`). Sem botão "Atualizar base": a atualização é sempre rodar `python backend/radar_fiscal.py` manualmente (ou agendado) numa máquina com MGApps instalado. Decisão consciente: quem atualiza sempre está numa máquina com MGApps, então um botão web não agregaria — ver [[project_radar_fiscal]].
- **NUNCA** importe ou referencie arquivos de `static/` a partir do backend.

### `.gitignore`
- Inclui obrigatoriamente `.env` (usuário/senha do Sistema de Analise), `__pycache__/`, `*.log`, `.venv/` e os arquivos gerados em `data/radar_fiscal/`.
- **NUNCA** versione credenciais.

### Como rodar
```
cd Radar-Fiscal
python -m http.server 8791
```
Acessar `http://localhost:8791` (fetch de arquivo local via `file://` é bloqueado por CORS, por isso precisa de um servidor simples).

### Hospedagem (GitHub Pages)
- A página estática (`index.html` + `static/`) pode ser publicada no GitHub Pages normalmente — é só HTML/CSS/JS.
- **O robô NÃO roda em nenhum serviço de nuvem** (Render, etc.): usa `pywinauto`/`win32gui`/`win32api`, exclusivos do Windows, e precisa do MGApps instalado e logado na rede da empresa — nada disso existe num container Linux de nuvem.
- Para a versão hospedada mostrar dados atualizados, o fluxo seria: rodar o robô localmente numa máquina com MGApps → commit+push dos JSONs de `data/radar_fiscal/` para o repositório → GitHub Pages reflete automaticamente. Isso **não foi implementado** (decisão do usuário em 2026-08-11: sem botão, sem push automático por enquanto).

---

## Observações técnicas do robô

- O MGApps é um app desktop nativo (WPF), então **Selenium não se aplica** — a automação usa `pywinauto` + `win32gui`/`win32api` (UI Automation e mensagens de janela do Windows).
- **O robô roda quase 100% sem tomar o mouse/teclado do usuário.** Depois do clique inicial (ver abaixo), toda interação com o Sistema de Analise (WinForms) usa `.invoke()` (UI Automation `InvokePattern`) para botões/menus e `set_edit_text()` para campos — nenhum dos dois move o cursor ou rouba foco de verdade. Os itens de `ToolStripDropDownMenu` (ex.: "Relatório", "Arquivo") não aparecem na árvore de UI Automation da janela pai — são localizados como uma janela top-level separada (classe `WindowsForms10.Window.20808...`, via `win32gui.EnumWindows`) e clicados por `PostMessage` (não `SendMessage` — trava esperando um diálogo modal abrir) diretamente na janela do popup, sem mover o cursor.
- **Único clique real do fluxo**: abrir "Sistema de Analise" a partir do launcher MG Apps. Esse launcher é WPF, e seus "tiles" **não respondem** a UI Automation (`.invoke()`, `.select()`, `LegacyIAccessible.DoDefaultAction()` — todos testados e falharam) nem a mensagens de janela (`WM_LBUTTONDOWN`/`WM_LBUTTONDBLCLK` via `PostMessage` também testados, sem efeito). Exige `click_input()` de verdade, o que exige a janela em primeiro plano — só dá pra evitar isso rodando numa sessão Windows separada (RDP local), que tem a desvantagem de desconectar a sessão atual; não vale a pena para este caso.
- Antes desse clique real, `_clicar_com_seguranca()` força o MGApps para primeiro plano (`AttachThreadInput` + `SetForegroundWindow`) e **confere que o ponto de clique realmente pertence à janela do MGApps** (via `WindowFromPoint` + PID) antes de clicar — nunca clica cego, para não acertar outra janela do usuário por engano caso a troca de foco falhe.
- **Depois desse clique**, cada janela nova do Sistema de Analise (Login, Menu, Departamento Fiscal, Radar) é movida para fora da área visível da tela (`_ocultar_janela`, `SetWindowPos` para coordenada bem negativa tipo `-32000,-32000`) assim que aparece, antes de qualquer interação — como a automação não depende de visibilidade, o usuário não vê essas telas. **Exceção: o diálogo "Salvar como"** (diálogo nativo do Windows, não WinForms comum) — mover ele com `SetWindowPos` trava a conclusão do salvamento; fica visível mesmo, mas é rápido (poucos segundos).
- O MGApps guarda o estado da última tela usada (ex.: o painel "Contatos", aberto pelo ícone de telefone/contato). Se não estiver na tela "Sistemas" ao iniciar a busca, o robô digita no campo de busca errado (busca de colaborador, não de sistema) e a automação falha silenciosamente. `_garantir_tela_sistemas()` detecta isso e volta para "Sistemas" antes de buscar.
- Os filtros (Ano/Mês) da tela Radar já vêm preenchidos automaticamente pelo sistema — o robô só clica em "FILTRAR".
- No diálogo "Salvar como", preencher o nome do arquivo com `set_edit_text()` funciona normalmente — o crash observado num teste inicial foi causado por um caminho de arquivo absurdamente longo (>200 caracteres), não pelo método de preenchimento em si.
- A tela "Controle de Análise Fechamento Escrita Fiscal" tem duas listas de checkbox (Unidade, Segmento) que são `DataGridView` sem nome distintivo — achadas pelo texto do cabeçalho (`_tabela_por_cabecalho`). Os checkboxes de linha não respondem a `.toggle()` (InvokePattern/TogglePattern não funcionam nessa célula owner-drawn) — usa clique por mensagem (`PostMessage`) no ponto do checkbox, igual aos itens de menu. Localiza a linha certa (SP, GOIAS) **pelo texto** (`Edit.legacy_properties()['Value']`), nunca por índice fixo — a grade é reaproveitada ao rolar.
- O export dessa tela ("Relatório > Exportar Excel") abre um diálogo **"Procurar Pasta"** (`SHBrowseForFolder`, árvore de pastas — diferente do "Salvar como" do Radar Fiscal, que é um `IFileDialog` com campo de nome). Não dá pra digitar um caminho direto nessa árvore. O robô seleciona "Downloads" (pasta simples, sem o comportamento de "lembrar última subpasta" que a biblioteca "Documentos" tem) e depois localiza o arquivo recém-criado (`Fechamento Escrita Fiscal *.xlsx`) comparando o conteúdo da pasta antes/depois, e move para `data/radar_fiscal/planilha_mercados.xlsx`.

### Regra de negócio do "Resumo" (`_processar_resumo`)
Replica exatamente a consulta Power Query do arquivo de referência do usuário (`Resumo Radar Fiscal.xlsx`, na raiz do projeto — **não apagar, é a especificação viva da lógica de negócio**; para reextrair o M code: `wb.Queries.Item(i).Formula` via `win32com.client` no Excel). Se a lógica de negócio mudar, atualizar lá primeiro e replicar aqui:
- `Status`: `fechado→Fechado`, `bloqueado→Bloqueado`, `simulando→Simulando`, `OK→Com o GC`, vazio/nulo→`Não importado`.
- `RegimeApuracao`: remove o prefixo "Federal -"; `L Real -Trimestral`/`Lucro Real - Anual`/`L.Real - Mensal` todos viram `Lucro Real`; `SN→Simples Nacional`; `Imune`/`MEI`/`Lucro Presumido` mantêm o nome sem o prefixo.
- `LEFT JOIN` do Radar Fiscal (base, todas as linhas) com a Planilha de Mercados por `IdCorporativo = COD`, trazendo só 6 colunas: `ÍA, DESC. REMESSAS, Data Comentário Operação, EFV ATUAL Data, AÇÃO GERENTE, Data Comentário Gerência` (prefixadas `Planilha de Mercados.`).
- Coluna calculada `Documentação`: `ÍA` = "A", vazio ou nulo → `Documentação Pendente`; qualquer outro valor → `Documentação Recebida`.

### Dashboard (cards + gráfico "Por Tributação" / "Por Departamento")
O `index.html` tem duas seções (`static/script.js`, `renderizarQuebras()`) espelhando as tabelas dinâmicas da aba "Resumo" do arquivo de referência: cards (um por `RegimeApuracao`, um por `DeptoFiscal`, com % recebida, total e barra) **e** um gráfico de barras horizontais logo abaixo de cada seção (`renderizarGraficoBarras`) — a barra tem largura proporcional ao total (comparação de magnitude entre categorias), diferente dos cards que mostram só a proporção interna (Recebida/Pendente) de cada categoria. Ambos são clicáveis — funcionam como um filtro a mais (equivalente ao select escondido `f-regime`/`f-depto`), com efeito cascata: clicar num item de Tributação também refiltra os de Departamento (e vice-versa), já que ambos são recalculados a partir do mesmo `filtrados`. Efeito colateral aceito: ao selecionar um valor, a seção da própria dimensão colapsa pra 1 item só (100%) — trade-off consciente pra manter o código simples, ver [[project_radar_fiscal]].

### Cores — regra fixa
**Nunca verde/âmbar para status.** Só rampa de vermelho MG (`--vermelho-claro`/`--vermelho-medio`/`--vermelho-profundo`/`--vermelho-suave` em `static/style.css`, claro→profundo = leve→crítico), igual ao Tarefas-baixadas e ao Relatório de Atividades — ver [[feedback_mg_dashboards_red_only_palette]].
