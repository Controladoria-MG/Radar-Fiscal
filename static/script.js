let dados = [];
let filtrados = [];
let filtradosTabela = [];

const el = {
  status: document.getElementById("status-execucao"),
  statusRodape: document.getElementById("status-execucao-rodape"),
  busca: document.getElementById("f-busca"),
  // Não é um <select> — é um estado simples com um Set de valores (permite
  // marcar mais de uma unidade ao mesmo tempo). filtrarConjunto trata esse
  // campo de forma diferente do resto (ver `.valores` lá). Os botões ficam
  // soltos no topo da página (unidadeTopoLista).
  unidade: { valores: new Set() },
  unidadeTopoLista: document.getElementById("unidade-topo-lista"),
  segmento: document.getElementById("f-segmento"),
  regime: document.getElementById("f-regime"),
  depto: document.getElementById("f-depto"),
  status_: document.getElementById("f-status"),
  documentacao: document.getElementById("f-documentacao"),
  gerente: document.getElementById("f-gerente"),
  limpar: document.getElementById("f-limpar"),
  corpo: document.getElementById("tabela-corpo"),
  contagem: document.getElementById("contagem"),
  quebraConteudo: document.getElementById("quebra-conteudo"),
  quebraAbas: document.querySelectorAll("#quebra-abas-dimensao .quebra-aba"),
  rankingGerentes: document.getElementById("ranking-gerentes"),
  evolucaoGrafico: document.getElementById("evolucao-grafico"),
  // Filtro independente, só da tabela — não afeta KPIs/cards/ranking
  tBusca: document.getElementById("t-busca"),
  tUnidade: document.getElementById("t-unidade"),
  tSegmento: document.getElementById("t-segmento"),
  tRegime: document.getElementById("t-regime"),
  tDepto: document.getElementById("t-depto"),
  tStatus: document.getElementById("t-status"),
  tDocumentacao: document.getElementById("t-documentacao"),
  tGerente: document.getElementById("t-gerente"),
  tLimpar: document.getElementById("t-limpar"),
};

function popularSelect(select, valores, formatar = (v) => v) {
  const atuais = new Set(Array.from(select.options).map((o) => o.value));
  [...valores].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((valor) => {
    if (!atuais.has(valor)) {
      const opt = document.createElement("option");
      opt.value = valor;
      opt.textContent = formatar(valor);
      select.appendChild(opt);
    }
  });
}

function filtrarConjunto(conjunto, campos) {
  const busca = campos.busca.value.trim().toLowerCase();
  // Unidade aceita dois formatos: um <select> normal (.value, string única
  // — usado no filtro da tabela) ou o estado multi-seleção dos chips do
  // topo (.valores, Set — vazio = "Todas").
  const unidadeValores = campos.unidade.valores;
  const unidadeUnica = campos.unidade.value;
  const segmento = campos.segmento.value;
  const regime = campos.regime.value;
  const depto = campos.depto.value;
  const status = campos.status.value;
  const documentacao = campos.documentacao.value;
  const gerente = campos.gerente.value;

  return conjunto.filter((r) => {
    if (unidadeValores) {
      if (unidadeValores.size > 0 && !unidadeValores.has(r.Unidade)) return false;
    } else if (unidadeUnica && r.Unidade !== unidadeUnica) {
      return false;
    }
    if (segmento && r.Segmento !== segmento) return false;
    if (regime && r.RegimeApuracao !== regime) return false;
    if (depto && r.DeptoFiscal !== depto) return false;
    if (gerente && r.GerenteContas !== gerente) return false;
    if (status && r.Status !== status) return false;
    if (documentacao && r["Documentação"] !== documentacao) return false;
    if (busca) {
      const alvo = `${r.Nome || ""} ${r.Grupo || ""}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

function aplicarFiltros() {
  filtrados = filtrarConjunto(dados, {
    busca: el.busca, unidade: el.unidade, segmento: el.segmento, regime: el.regime,
    depto: el.depto, status: el.status_, documentacao: el.documentacao, gerente: el.gerente,
  });

  renderizarQuebras();
  renderizarRankingGerentes();
  renderizarEvolucao();
  atualizarUnidadeTopoAtiva();
}

function renderizarUnidadeTopo() {
  const unidades = [...new Set(dados.map((r) => r.Unidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  el.unidadeTopoLista.innerHTML = [`<button type="button" class="unidade-topo-chip" data-valor="">Todas</button>`]
    .concat(
      unidades.map((u) => `<button type="button" class="unidade-topo-chip" data-valor="${u.replace(/"/g, "&quot;")}">${u.toUpperCase()}</button>`)
    )
    .join("");
  ativarFiltroUnidadeMultiplo();
  atualizarUnidadeTopoAtiva();
}

// Diferente de ativarFiltroClicavel (usado por Tributação/Departamento/
// Gerente, que são single-select): aqui cada clique liga/desliga aquela
// unidade sem desmarcar as outras, permitindo comparar várias de uma vez.
// "Todas" é um caso especial que limpa a seleção inteira.
function ativarFiltroUnidadeMultiplo() {
  el.unidadeTopoLista.querySelectorAll(".unidade-topo-chip").forEach((botao) => {
    botao.addEventListener("click", () => {
      const valor = botao.dataset.valor;
      if (valor === "") {
        el.unidade.valores.clear();
      } else if (el.unidade.valores.has(valor)) {
        el.unidade.valores.delete(valor);
      } else {
        el.unidade.valores.add(valor);
      }
      aplicarFiltros();
    });
  });
}

function atualizarUnidadeTopoAtiva() {
  el.unidadeTopoLista.querySelectorAll(".unidade-topo-chip").forEach((botao) => {
    const valor = botao.dataset.valor;
    const ativo = valor === "" ? el.unidade.valores.size === 0 : el.unidade.valores.has(valor);
    botao.classList.toggle("ativo", ativo);
  });
}

function aplicarFiltroTabela() {
  filtradosTabela = filtrarConjunto(dados, {
    busca: el.tBusca, unidade: el.tUnidade, segmento: el.tSegmento, regime: el.tRegime,
    depto: el.tDepto, status: el.tStatus, documentacao: el.tDocumentacao, gerente: el.tGerente,
  });
  renderizarTabela();
}

const ORDEM_DOCUMENTACAO = ["Documentação Recebida", "Documentação Pendente"];
// Ordem fixa dos status em todo card — junto com ORDEM_DOCUMENTACAO acima,
// garante que todo card renderize o mesmo número de linhas (mesmo tamanho),
// com contagem 0 pros status/documentação que não ocorrem naquele grupo.
const STATUS_ORDEM = ["Fechado", "Bloqueado", "Simulando", "Com o GC", "Não importado"];

function criarContadorStatus() {
  const status = new Map();
  STATUS_ORDEM.forEach((s) => status.set(s, 0));
  return { total: 0, status };
}

function criarContadorDocs() {
  const docs = new Map();
  ORDEM_DOCUMENTACAO.forEach((doc) => docs.set(doc, criarContadorStatus()));
  return docs;
}

function contarDetalhado(chave) {
  const grupos = new Map();
  filtrados.forEach((r) => {
    const valor = r[chave];
    if (!valor) return;
    if (!grupos.has(valor)) grupos.set(valor, { total: 0, docs: criarContadorDocs() });
    const g = grupos.get(valor);
    g.total++;

    const doc = r["Documentação"] || "Sem documentação";
    if (!g.docs.has(doc)) g.docs.set(doc, criarContadorStatus());
    const d = g.docs.get(doc);
    d.total++;

    const status = r.Status || "Não importado";
    d.status.set(status, (d.status.get(status) || 0) + 1);
  });
  return [...grupos.entries()].sort((a, b) => b[1].total - a[1].total);
}

function formatarPct(n) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function ativarFiltroClicavel(elementos, filtroEl) {
  elementos.forEach((el2) => {
    el2.addEventListener("click", () => {
      const valor = el2.dataset.valor;
      filtroEl.value = filtroEl.value === valor ? "" : valor;
      aplicarFiltros();
    });
  });
}

function renderizarDocGrupo(docNome, d, totalCategoria) {
  const classe = docNome === "Documentação Recebida" ? "recebida" : "pendente";
  const pctDoc = totalCategoria ? (d.total / totalCategoria) * 100 : 0;
  // Ordem fixa (não por contagem) pra todo card mostrar as mesmas linhas na
  // mesma posição — mesmo as zeradas.
  const statusOrdenado = STATUS_ORDEM.map((s) => [s, d.status.get(s) || 0]);

  const linhasStatus = statusOrdenado
    .map(([status, count]) => {
      const pctStatus = totalCategoria ? (count / totalCategoria) * 100 : 0;
      return `
        <div class="status-linha">
          <span class="status-nome" title="${status}">${status}</span>
          <span class="status-valores"><b>${count.toLocaleString("pt-BR")}</b><span class="status-pct">${formatarPct(pctStatus)}</span></span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="doc-grupo ${classe}">
      <div class="doc-cabecalho">
        <span class="doc-rotulo"><i class="ponto ${classe}"></i>${docNome}</span>
        <span class="doc-valores"><b>${d.total.toLocaleString("pt-BR")}</b><span class="doc-pct">${formatarPct(pctDoc)}</span></span>
      </div>
      <div class="status-lista">${linhasStatus}</div>
    </div>
  `;
}

function renderizarQuebraGrupo(container, chave, filtroEl) {
  const grupos = contarDetalhado(chave);
  const selecionado = filtroEl.value;
  container.innerHTML = grupos
    .map(([nome, g]) => {
      const ativo = nome === selecionado ? " selecionado" : "";
      const docsHtml = ORDEM_DOCUMENTACAO
        .map((docNome) => renderizarDocGrupo(docNome, g.docs.get(docNome), g.total))
        .join("");

      return `
        <div class="quebra-card${ativo}" data-valor="${nome.replace(/"/g, "&quot;")}" title="${nome}">
          <div class="quebra-cabecalho">
            <div class="quebra-nome">${nome}</div>
            <div class="quebra-total-num">${g.total.toLocaleString("pt-BR")}</div>
          </div>
          <div class="quebra-docs">${docsHtml}</div>
        </div>
      `;
    })
    .join("");

  ativarFiltroClicavel(container.querySelectorAll(".quebra-card"), filtroEl);
}

function contarDetalhadoComSubgrupo(chavePrincipal, chaveSecundaria) {
  const grupos = new Map();
  filtrados.forEach((r) => {
    const valor1 = r[chavePrincipal];
    if (!valor1) return;
    if (!grupos.has(valor1)) grupos.set(valor1, { total: 0, sub: new Map() });
    const g = grupos.get(valor1);
    g.total++;

    const valor2 = r[chaveSecundaria] || "Sem tributação";
    if (!g.sub.has(valor2)) g.sub.set(valor2, { total: 0, docs: criarContadorDocs() });
    const s = g.sub.get(valor2);
    s.total++;

    const doc = r["Documentação"] || "Sem documentação";
    if (!s.docs.has(doc)) s.docs.set(doc, criarContadorStatus());
    const d = s.docs.get(doc);
    d.total++;

    const status = r.Status || "Não importado";
    d.status.set(status, (d.status.get(status) || 0) + 1);
  });
  return [...grupos.entries()].sort((a, b) => b[1].total - a[1].total);
}

function renderizarRegimeCard(nome, s, selecionado) {
  const ativo = nome === selecionado ? " selecionado" : "";
  const docsHtml = ORDEM_DOCUMENTACAO
    .map((docNome) => renderizarDocGrupo(docNome, s.docs.get(docNome), s.total))
    .join("");

  return `
    <div class="regime-card${ativo}" data-valor="${nome.replace(/"/g, "&quot;")}" title="${nome}">
      <div class="regime-card-cabecalho">
        <div class="regime-card-nome">${nome}</div>
        <div class="regime-card-total">${s.total.toLocaleString("pt-BR")}</div>
      </div>
      <div class="quebra-docs">${docsHtml}</div>
    </div>
  `;
}

const faixasAbertas = new Set();

// Clicar no cabeçalho do departamento só expande/recolhe (não filtra) — pra
// filtrar por departamento, usa o botão "Fixar". Card de regime dentro (o
// mesmo estilo de "Por Tributação") continua filtrando (el.regime) num
// clique direto, igual antes.
function renderizarFaixaDepto(container, chavePrincipal, chaveSecundaria, filtroPrincipal, filtroSecundario) {
  const grupos = contarDetalhadoComSubgrupo(chavePrincipal, chaveSecundaria);
  const selecionado = filtroPrincipal.value;
  const selecionadoSub = filtroSecundario.value;
  container.innerHTML = grupos
    .map(([nome, g]) => {
      const ativo = nome === selecionado ? " selecionado" : "";
      const aberto = faixasAbertas.has(nome);
      const cardsHtml = [...g.sub.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([subNome, s]) => renderizarRegimeCard(subNome, s, selecionadoSub))
        .join("");

      return `
        <div class="quebra-faixa${aberto ? "" : " colapsado"}${ativo}" title="${nome}">
          <div class="quebra-faixa-cabecalho" data-valor="${nome.replace(/"/g, "&quot;")}">
            <button type="button" class="quebra-faixa-toggle" aria-label="Mostrar departamento" aria-expanded="${aberto}"><i class="seta"></i></button>
            <div class="quebra-nome">${nome}</div>
            <div class="quebra-total-num">${g.total.toLocaleString("pt-BR")}</div>
            <button type="button" class="quebra-faixa-fixar${ativo ? " fixado" : ""}" aria-label="${ativo ? "Remover filtro deste departamento" : "Filtrar por este departamento"}" title="${ativo ? "Remover filtro" : "Fixar filtro"}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M14.5 2.5a1 1 0 0 1 1.42 0l5.58 5.58a1 1 0 0 1 0 1.42l-1.3 1.3a1 1 0 0 1-1.3.1l-.5-.36-3.02 3.02.6 2.98a1 1 0 0 1-.27.92l-1.1 1.1a1 1 0 0 1-1.42 0l-3.4-3.4-5.02 5.02a1 1 0 0 1-1.42-1.42l5.02-5.02-3.4-3.4a1 1 0 0 1 0-1.42l1.1-1.1a1 1 0 0 1 .92-.27l2.98.6 3.02-3.02-.36-.5a1 1 0 0 1 .1-1.3z"/></svg>
            </button>
          </div>
          <div class="regime-cards">${cardsHtml}</div>
        </div>
      `;
    })
    .join("");

  // Mantém o funcionamento original da setinha
  function alternarAberto(cabecalho) {
    const faixa = cabecalho.closest(".quebra-faixa");
    const botaoToggle = cabecalho.querySelector(".quebra-faixa-toggle");
    const colapsado = faixa.classList.toggle("colapsado");
    const nome = cabecalho.dataset.valor;
    if (colapsado) faixasAbertas.delete(nome); else faixasAbertas.add(nome);
    botaoToggle.setAttribute("aria-expanded", String(!colapsado));
    botaoToggle.setAttribute("aria-label", colapsado ? "Mostrar departamento" : "Ocultar departamento");
  }

  container.querySelectorAll(".quebra-faixa-toggle").forEach((botao) => {
    botao.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarAberto(botao.closest(".quebra-faixa-cabecalho"));
    });
  });

  // Clique no cabeçalho inteiro: só expande/recolhe (mesmo efeito da seta) —
  // diferente do card de Tributação, o clique aqui não filtra, pra não
  // atrapalhar quem só quer abrir o departamento e ver os regimes dentro.
  container.querySelectorAll(".quebra-faixa-cabecalho").forEach((cabecalho) => {
    cabecalho.addEventListener("click", (e) => {
      if (e.target.closest(".quebra-faixa-fixar")) return;
      alternarAberto(cabecalho);
    });
  });

  // Botão "Fixar": único jeito de filtrar por este departamento.
  container.querySelectorAll(".quebra-faixa-fixar").forEach((botao) => {
    botao.addEventListener("click", (e) => {
      e.stopPropagation();
      const valor = botao.closest(".quebra-faixa-cabecalho").dataset.valor;
      filtroPrincipal.value = filtroPrincipal.value === valor ? "" : valor;
      aplicarFiltros();
    });
  });

  ativarFiltroClicavel(container.querySelectorAll(".regime-card"), filtroSecundario);
}

const QUEBRA_CONFIG = {
  regime: { chave: "RegimeApuracao", filtroEl: () => el.regime },
  depto: { chave: "DeptoFiscal", subChave: "RegimeApuracao", filtroEl: () => el.depto, subFiltroEl: () => el.regime },
};
let abaQuebraAtiva = "regime";

function renderizarQuebras() {
  const cfg = QUEBRA_CONFIG[abaQuebraAtiva];
  el.quebraConteudo.classList.toggle("quebra-grid--faixas", abaQuebraAtiva === "depto");
  if (cfg.subChave) {
    renderizarFaixaDepto(el.quebraConteudo, cfg.chave, cfg.subChave, cfg.filtroEl(), cfg.subFiltroEl());
  } else {
    renderizarQuebraGrupo(el.quebraConteudo, cfg.chave, cfg.filtroEl());
  }
}

el.quebraAbas.forEach((botao) => {
  botao.addEventListener("click", () => {
    abaQuebraAtiva = botao.dataset.aba;
    el.quebraAbas.forEach((b) => {
      const ativa = b === botao;
      b.classList.toggle("ativa", ativa);
      b.setAttribute("aria-selected", ativa ? "true" : "false");
    });
    renderizarQuebras();
  });
});

function renderizarRankingGerentes() {
  const contagens = new Map();
  filtrados.forEach((r) => {
    const gerente = r.GerenteContas;
    if (!gerente) return;
    if (!contagens.has(gerente)) contagens.set(gerente, { total: 0, pendente: 0 });
    const c = contagens.get(gerente);
    c.total++;
    if (r["Documentação"] !== "Documentação Recebida") c.pendente++;
  });

  const lista = [...contagens.entries()]
    .filter(([, c]) => c.pendente > 0)
    .sort((a, b) => b[1].pendente - a[1].pendente)
    .slice(0, 10);

  if (!lista.length) {
    el.rankingGerentes.innerHTML = `<p style="color:var(--cinza-muted); font-size:0.85rem; margin:8px 0 0;">Nenhuma pendência no filtro atual.</p>`;
    return;
  }

  const maior = Math.max(...lista.map(([, c]) => c.pendente));
  const selecionado = el.gerente.value;

  el.rankingGerentes.innerHTML = lista
    .map(([nome, c]) => {
      const largura = (c.pendente / maior) * 100;
      const ativo = nome === selecionado ? " selecionado" : "";
      return `
        <div class="ranking-linha${ativo}" data-valor="${nome.replace(/"/g, "&quot;")}" title="${nome}: ${c.pendente} de ${c.total} pendente(s)">
          <div class="ranking-rotulo">${nome}</div>
          <div class="ranking-trilha"><div class="ranking-barra" style="width:${largura}%"></div></div>
          <div class="ranking-valor">${c.pendente}</div>
        </div>
      `;
    })
    .join("");

  ativarFiltroClicavel(el.rankingGerentes.querySelectorAll(".ranking-linha"), el.gerente);
}

function celula(texto) {
  return texto === null || texto === undefined || texto === "" ? "—" : texto;
}

function nomeComId(id, nome) {
  const rotuloNome = celula(nome);
  return id === null || id === undefined || id === "" ? rotuloNome : `${id} - ${rotuloNome}`;
}

function regimeCurto(texto) {
  if (!texto) return "—";
  return texto.replace(/^Federal\s*-\s*/, "");
}

function renderizarTabela() {
  el.corpo.innerHTML = filtradosTabela
    .map((r) => {
      const doc = r["Documentação"];
      const rotuloDoc = doc ? doc.replace("Documentação ", "") : "—";
      return `
        <tr>
          <td>${nomeComId(r.IdCorporativo, r.Nome)}</td>
          <td>${celula(r.Grupo)}</td>
          <td>${celula(r.Unidade ? r.Unidade.toUpperCase() : r.Unidade)}</td>
          <td>${celula(r.Segmento)}</td>
          <td>${celula(r.GerenteContas)}</td>
          <td>${celula(r.DeptoFiscal)}</td>
          <td>${regimeCurto(r.RegimeApuracao)}</td>
          <td>${celula(r.Status)}</td>
          <td>${rotuloDoc}</td>
        </tr>
      `;
    })
    .join("");

  el.contagem.textContent = `${filtradosTabela.length.toLocaleString("pt-BR")} empresa(s)`;
}

function carregarStatus() {
  fetch("data/radar_fiscal/status.json?" + Date.now())
    .then((r) => r.json())
    .then((s) => {
      const data = new Date(s.ultima_execucao);
      const texto = `Atualizado em ${data.toLocaleString("pt-BR")}`;
      el.status.textContent = texto;
      el.statusRodape.textContent = texto;
    })
    .catch(() => {
      el.status.textContent = "Nenhuma execução registrada ainda.";
      el.statusRodape.textContent = "Nenhuma execução registrada ainda.";
    });
}

function formatarDataCurta(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Quantas empresas foram fechadas (DataConfirmacao) em cada dia — vem direto
// da planilha (cada linha já tem sua própria data), não de um histórico
// acumulado por execução do robô. Respeita os filtros ativos (mesmo
// conjunto `filtrados` dos cards/ranking).
function contarConfirmacoesPorDia() {
  const dias = new Map();
  filtrados.forEach((r) => {
    if (!r.DataConfirmacao) return;
    const dia = r.DataConfirmacao.slice(0, 10);
    dias.set(dia, (dias.get(dia) || 0) + 1);
  });
  return [...dias.entries()]
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Uma barra por dia (SVG desenhado à mão, sem lib externa — mesmo padrão do
// resto do portal) com o total de empresas fechadas naquele dia. Barra (não
// linha) porque é uma contagem discreta por dia, não um total acumulado — a
// linha insinuava uma continuidade entre os pontos que não existe de
// verdade. Todo dia do histórico mostra sua data no eixo (sem decimar
// rótulo), a pedido do usuário.
function renderizarEvolucao() {
  const container = el.evolucaoGrafico;
  if (!container) return;

  const historico = contarConfirmacoesPorDia();
  if (historico.length < 2) {
    container.innerHTML = `<p class="evolucao-vazio">Sem dias suficientes com Data de Confirmação no filtro atual para montar o gráfico.</p>`;
    return;
  }

  // O viewBox usa a largura real (em px) do container em vez de um valor
  // fixo (900) — assim 1 unidade do SVG = 1px real e o texto dos eixos
  // (font-size em unidades do viewBox) não fica minúsculo em telas
  // estreitas nem gigante em telas largas. Reajustado no resize (ver
  // listener no fim do arquivo).
  const largura = Math.max(360, Math.round(container.clientWidth || 900));
  const altura = 380;
  // margemTopo maior que o padrão pra sobrar espaço pro rótulo de total
  // acima da barra mais alta (senão o texto fica colado/cortado no topo).
  const margemEsq = 46, margemDir = 16, margemTopo = 26, margemBaixo = 34;
  const areaLargura = largura - margemEsq - margemDir;
  const areaAltura = altura - margemTopo - margemBaixo;

  const maiorTotal = Math.max(1, ...historico.map((h) => h.total));
  const passoX = areaLargura / historico.length;
  const larguraBarra = passoX * 0.6;

  const coordXCentro = (i) => margemEsq + i * passoX + passoX / 2;
  const alturaBarra = (valor) => (valor / maiorTotal) * areaAltura;
  const coordY = (valor) => margemTopo + areaAltura - (valor / maiorTotal) * areaAltura;

  const barras = historico
    .map((h, i) => {
      const x = coordXCentro(i) - larguraBarra / 2;
      const yBase = margemTopo + areaAltura;
      const alt = alturaBarra(h.total);
      const y = yBase - alt;
      // Rótulo com o total do dia, pra não depender de hover no tooltip
      // pra ter uma leitura rápida da barra.
      const rotuloTotal = `<text x="${coordXCentro(i)}" y="${y - 6}" text-anchor="middle" class="evolucao-rotulo-total">${h.total.toLocaleString("pt-BR")}</text>`;
      return `
        <rect x="${x}" y="${y}" width="${larguraBarra}" height="${alt}" class="evolucao-barra">
          <title>${formatarDataCurta(h.data)} — ${h.total.toLocaleString("pt-BR")} fechado(s)</title>
        </rect>
        ${rotuloTotal}
      `;
    })
    .join("");

  const NUM_GRADES = 4;
  const grades = Array.from({ length: NUM_GRADES + 1 }, (_, i) => {
    const valor = Math.round((maiorTotal / NUM_GRADES) * i);
    const y = coordY(valor);
    return `
      <line x1="${margemEsq}" y1="${y}" x2="${largura - margemDir}" y2="${y}" class="evolucao-grade" />
      <text x="${margemEsq - 8}" y="${y + 4}" text-anchor="end" class="evolucao-eixo-texto">${valor.toLocaleString("pt-BR")}</text>
    `;
  }).join("");

  const rotulosX = historico
    .map((h, i) => `<text x="${coordXCentro(i)}" y="${altura - margemBaixo + 18}" text-anchor="middle" class="evolucao-eixo-texto">${formatarDataCurta(h.data)}</text>`)
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${largura} ${altura}" class="evolucao-svg" role="img" aria-label="Fechamentos por dia">
      ${grades}
      ${barras}
      ${rotulosX}
    </svg>
  `;
}

const UNIDADES_EXCLUIDAS = ["MG EXPRESS"];

function carregarDados() {
  fetch("data/radar_fiscal/radar_fiscal_dados.json?" + Date.now())
    .then((r) => r.json())
    .then((json) => {
      dados = json.filter((r) => !UNIDADES_EXCLUIDAS.includes(r.Unidade));
      renderizarUnidadeTopo();
      popularSelect(el.segmento, new Set(dados.map((r) => r.Segmento).filter(Boolean)));
      popularSelect(el.regime, new Set(dados.map((r) => r.RegimeApuracao).filter(Boolean)));
      popularSelect(el.depto, new Set(dados.map((r) => r.DeptoFiscal).filter(Boolean)));
      popularSelect(el.gerente, new Set(dados.map((r) => r.GerenteContas).filter(Boolean)));
      popularSelect(el.status_, new Set(dados.map((r) => r.Status).filter(Boolean)));
      popularSelect(el.documentacao, new Set(dados.map((r) => r["Documentação"]).filter(Boolean)));
      popularSelect(el.tUnidade, new Set(dados.map((r) => r.Unidade).filter(Boolean)), (v) => v.toUpperCase());
      popularSelect(el.tSegmento, new Set(dados.map((r) => r.Segmento).filter(Boolean)));
      popularSelect(el.tRegime, new Set(dados.map((r) => r.RegimeApuracao).filter(Boolean)));
      popularSelect(el.tDepto, new Set(dados.map((r) => r.DeptoFiscal).filter(Boolean)));
      popularSelect(el.tGerente, new Set(dados.map((r) => r.GerenteContas).filter(Boolean)));
      popularSelect(el.tStatus, new Set(dados.map((r) => r.Status).filter(Boolean)));
      popularSelect(el.tDocumentacao, new Set(dados.map((r) => r["Documentação"]).filter(Boolean)));
      aplicarFiltros();
      aplicarFiltroTabela();
    })
    .catch(() => {
      el.corpo.innerHTML = `<tr><td colspan="9">Nenhum dado exportado ainda — rode o robô (backend/radar_fiscal.py).</td></tr>`;
    });
}

[el.busca, el.segmento, el.regime, el.depto, el.status_, el.documentacao, el.gerente].forEach((campo) => {
  campo.addEventListener("input", aplicarFiltros);
  campo.addEventListener("change", aplicarFiltros);
});

el.limpar.addEventListener("click", () => {
  el.busca.value = "";
  el.unidade.valores.clear();
  el.segmento.value = "";
  el.regime.value = "";
  el.depto.value = "";
  el.status_.value = "";
  el.documentacao.value = "";
  el.gerente.value = "";
  aplicarFiltros();
});

[el.tBusca, el.tUnidade, el.tSegmento, el.tRegime, el.tDepto, el.tStatus, el.tDocumentacao, el.tGerente].forEach((campo) => {
  campo.addEventListener("input", aplicarFiltroTabela);
  campo.addEventListener("change", aplicarFiltroTabela);
});

el.tLimpar.addEventListener("click", () => {
  el.tBusca.value = "";
  el.tUnidade.value = "";
  el.tSegmento.value = "";
  el.tRegime.value = "";
  el.tDepto.value = "";
  el.tStatus.value = "";
  el.tDocumentacao.value = "";
  el.tGerente.value = "";
  aplicarFiltroTabela();
});

const elBtnTema = document.getElementById("btn-tema");
elBtnTema.addEventListener("click", () => {
  const escuro = document.body.classList.toggle("tema-escuro");
  elBtnTema.textContent = escuro ? "Alterar tema para Claro" : "Alterar tema para Escuro";
});

// Re-renderiza "Evolução por dia" quando a largura do container muda (ex.:
// redimensionar a janela) — o viewBox do gráfico é calculado a partir da
// largura real do container (ver renderizarEvolucao), então precisa
// recalcular pra manter 1 unidade do SVG = 1px real.
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(renderizarEvolucao, 200);
});

carregarStatus();
carregarDados();