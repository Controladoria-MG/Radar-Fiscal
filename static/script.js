let dados = [];
let filtrados = [];
let filtradosTabela = [];

const el = {
  status: document.getElementById("status-execucao"),
  statusRodape: document.getElementById("status-execucao-rodape"),
  busca: document.getElementById("f-busca"),
  // Não é um <select> — é um estado simples imitando a mesma interface
  // (.value), pra reaproveitar filtrarConjunto/ativarFiltroClicavel sem
  // mudança. Os botões ficam soltos no topo da página (unidadeTopoLista).
  unidade: { value: "" },
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
  quebraAbas: document.querySelectorAll(".quebra-aba"),
  rankingGerentes: document.getElementById("ranking-gerentes"),
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
  const unidade = campos.unidade.value;
  const segmento = campos.segmento.value;
  const regime = campos.regime.value;
  const depto = campos.depto.value;
  const status = campos.status.value;
  const documentacao = campos.documentacao.value;
  const gerente = campos.gerente.value;

  return conjunto.filter((r) => {
    if (unidade && r.Unidade !== unidade) return false;
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
  atualizarUnidadeTopoAtiva();
}

function renderizarUnidadeTopo() {
  const unidades = [...new Set(dados.map((r) => r.Unidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  el.unidadeTopoLista.innerHTML = [`<button type="button" class="unidade-topo-chip" data-valor="">Todas</button>`]
    .concat(
      unidades.map((u) => `<button type="button" class="unidade-topo-chip" data-valor="${u.replace(/"/g, "&quot;")}">${u.toUpperCase()}</button>`)
    )
    .join("");
  ativarFiltroClicavel(el.unidadeTopoLista.querySelectorAll(".unidade-topo-chip"), el.unidade);
  atualizarUnidadeTopoAtiva();
}

function atualizarUnidadeTopoAtiva() {
  el.unidadeTopoLista.querySelectorAll(".unidade-topo-chip").forEach((botao) => {
    botao.classList.toggle("ativo", botao.dataset.valor === el.unidade.value);
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

function contarDetalhado(chave) {
  const grupos = new Map();
  filtrados.forEach((r) => {
    const valor = r[chave];
    if (!valor) return;
    if (!grupos.has(valor)) grupos.set(valor, { total: 0, docs: new Map() });
    const g = grupos.get(valor);
    g.total++;

    const doc = r["Documentação"] || "Sem documentação";
    if (!g.docs.has(doc)) g.docs.set(doc, { total: 0, status: new Map() });
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

// Marca só o elemento clicado como "selecionado" (destaque visual), sem
// mexer nos filtros nem recalcular o restante da tela.
function ativarSelecaoVisual(elementos) {
  elementos.forEach((el2) => {
    el2.addEventListener("click", () => {
      const jaSelecionado = el2.classList.contains("selecionado");
      elementos.forEach((e) => e.classList.remove("selecionado"));
      if (!jaSelecionado) el2.classList.add("selecionado");
    });
  });
}

function renderizarDocGrupo(docNome, d, totalCategoria) {
  const classe = docNome === "Documentação Recebida" ? "recebida" : "pendente";
  const pctDoc = totalCategoria ? (d.total / totalCategoria) * 100 : 0;
  const statusOrdenado = [...d.status.entries()].sort((a, b) => b[1] - a[1]);

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
        .map((docNome) => (g.docs.has(docNome) ? renderizarDocGrupo(docNome, g.docs.get(docNome), g.total) : ""))
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
    if (!g.sub.has(valor2)) g.sub.set(valor2, { total: 0, docs: new Map() });
    const s = g.sub.get(valor2);
    s.total++;

    const doc = r["Documentação"] || "Sem documentação";
    if (!s.docs.has(doc)) s.docs.set(doc, { total: 0, status: new Map() });
    const d = s.docs.get(doc);
    d.total++;

    const status = r.Status || "Não importado";
    d.status.set(status, (d.status.get(status) || 0) + 1);
  });
  return [...grupos.entries()].sort((a, b) => b[1].total - a[1].total);
}

function renderizarRegimeCard(nome, s) {
  const docsHtml = ORDEM_DOCUMENTACAO
    .map((docNome) => (s.docs.has(docNome) ? renderizarDocGrupo(docNome, s.docs.get(docNome), s.total) : ""))
    .join("");

  return `
    <div class="regime-card" data-valor="${nome.replace(/"/g, "&quot;")}" title="${nome}">
      <div class="regime-card-cabecalho">
        <div class="regime-card-nome">${nome}</div>
        <div class="regime-card-total">${s.total.toLocaleString("pt-BR")}</div>
      </div>
      <div class="quebra-docs">${docsHtml}</div>
    </div>
  `;
}

const faixasAbertas = new Set();

function renderizarFaixaDepto(container, chavePrincipal, chaveSecundaria, filtroPrincipal) {
  const grupos = contarDetalhadoComSubgrupo(chavePrincipal, chaveSecundaria);
  const selecionado = filtroPrincipal.value;
  container.innerHTML = grupos
    .map(([nome, g]) => {
      const ativo = nome === selecionado ? " selecionado" : "";
      const aberto = faixasAbertas.has(nome);
      const cardsHtml = [...g.sub.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([subNome, s]) => renderizarRegimeCard(subNome, s))
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

  // Clique no cabeçalho inteiro: só expande/recolhe (mesmo efeito da seta)
  container.querySelectorAll(".quebra-faixa-cabecalho").forEach((cabecalho) => {
    cabecalho.addEventListener("click", (e) => {
      if (e.target.closest(".quebra-faixa-fixar")) return;
      alternarAberto(cabecalho);
    });
  });

  // Botão "Fixar": aplica o filtro pelo departamento
  container.querySelectorAll(".quebra-faixa-fixar").forEach((botao) => {
    botao.addEventListener("click", (e) => {
      e.stopPropagation();
      const valor = botao.closest(".quebra-faixa-cabecalho").dataset.valor;
      filtroPrincipal.value = filtroPrincipal.value === valor ? "" : valor;
      aplicarFiltros();
    });
  });

  ativarSelecaoVisual(container.querySelectorAll(".regime-card"));
}

const QUEBRA_CONFIG = {
  regime: { chave: "RegimeApuracao", filtroEl: () => el.regime },
  depto: { chave: "DeptoFiscal", subChave: "RegimeApuracao", filtroEl: () => el.depto },
};
let abaQuebraAtiva = "regime";

function renderizarQuebras() {
  const cfg = QUEBRA_CONFIG[abaQuebraAtiva];
  el.quebraConteudo.classList.toggle("quebra-grid--faixas", abaQuebraAtiva === "depto");
  if (cfg.subChave) {
    renderizarFaixaDepto(el.quebraConteudo, cfg.chave, cfg.subChave, cfg.filtroEl());
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
      const texto = `Atualizado em ${data.toLocaleString("pt-BR")} — ${s.registros.toLocaleString("pt-BR")} registros`;
      el.status.textContent = texto;
      el.statusRodape.textContent = texto;
    })
    .catch(() => {
      el.status.textContent = "Nenhuma execução registrada ainda.";
      el.statusRodape.textContent = "Nenhuma execução registrada ainda.";
    });
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
  el.unidade.value = "";
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

carregarStatus();
carregarDados();