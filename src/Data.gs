function abrirPlanilha_() {
  return SpreadsheetApp.openById(propriedadeObrigatoria_(JL_CONFIG.PROPERTIES.SPREADSHEET_ID));
}

function obterFonte_() {
  const aba = abrirPlanilha_().getSheetByName(JL_CONFIG.SOURCE_SHEET);
  if (!aba) throw new Error("Aba de origem não encontrada: " + JL_CONFIG.SOURCE_SHEET + ".");
  return aba;
}

function mapaCabecalhos_(aba) {
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const mapa = {};
  cabecalhos.forEach((valor, indice) => { mapa[String(valor).trim()] = indice; });
  Object.keys(JL_CONFIG.HEADERS).forEach(chave => {
    const titulo = JL_CONFIG.HEADERS[chave];
    if (mapa[titulo] === undefined) throw new Error("Cabeçalho obrigatório ausente: " + titulo);
  });
  return mapa;
}

function valor_(linha, mapa, chave) {
  return linha[mapa[JL_CONFIG.HEADERS[chave]]];
}

function ehSolicitacao_(linha, mapa) {
  const cargo = String(valor_(linha, mapa, "FUNCTION") || "").toLowerCase();
  return cargo.includes("magistrad") || cargo.includes("assessor");
}

function ehJuizLeigo_(linha, mapa) {
  const cargo = String(valor_(linha, mapa, "FUNCTION") || "").toLowerCase();
  return cargo.includes("juiz leig") || cargo.includes("juíza leig");
}

function statusNormalizado_(valor) {
  return String(valor || "Pendente").trim() || "Pendente";
}

function listarDados_(usuario) {
  const aba = obterFonte_();
  const mapa = mapaCabecalhos_(aba);
  const linhas = aba.getLastRow() > 1
    ? aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).getDisplayValues()
    : [];
  const gerente = podeGerenciar_(usuario);
  const solicitacoes = [];
  const juizes = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2;
    if (ehSolicitacao_(linha, mapa)) {
      const dono = normalizarEmail_(valor_(linha, mapa, "EMAIL"));
      if (!gerente && dono !== normalizarEmail_(usuario.email)) return;
      solicitacoes.push({
        id: numeroLinha,
        data: valor_(linha, mapa, "TIMESTAMP"),
        solicitante: valor_(linha, mapa, "NAME"),
        unidade: valor_(linha, mapa, "UNIT"),
        quantidade: valor_(linha, mapa, "CAPACITY"),
        competencias: valor_(linha, mapa, "SKILLS") || valor_(linha, mapa, "SUBJECTS"),
        preferencia: valor_(linha, mapa, "PREFERRED_JUDGE"),
        status: statusNormalizado_(valor_(linha, mapa, "STATUS")),
        juiz: valor_(linha, mapa, "ASSIGNED_JUDGE"),
        dataDesignacao: valor_(linha, mapa, "ASSIGNED_AT"),
        observacoes: valor_(linha, mapa, "NOTES"),
        detalhes: gerente ? {
          email: dono,
          telefone: valor_(linha, mapa, "PHONE"),
          processos: valor_(linha, mapa, "CASES"),
          orientacoes: valor_(linha, mapa, "GUIDANCE"),
          produtividade: valor_(linha, mapa, "PRODUCTIVITY")
        } : null
      });
    }
    if (ehJuizLeigo_(linha, mapa) && statusNormalizado_(valor_(linha, mapa, "STATUS")).toLowerCase() !== "concluído") {
      juizes.push({
        id: numeroLinha,
        nome: valor_(linha, mapa, "NAME"),
        capacidade: valor_(linha, mapa, "CAPACITY"),
        materias: valor_(linha, mapa, "SUBJECTS"),
        observacoes: valor_(linha, mapa, "PRODUCTIVITY"),
        contato: gerente ? { email: valor_(linha, mapa, "EMAIL"), telefone: valor_(linha, mapa, "PHONE") } : null
      });
    }
  });
  solicitacoes.sort((a, b) => b.id - a.id);
  juizes.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return { solicitacoes: solicitacoes, juizes: juizes };
}

function escreverCampo_(aba, mapa, numeroLinha, chave, valor) {
  aba.getRange(numeroLinha, mapa[JL_CONFIG.HEADERS[chave]] + 1).setValue(valor);
}

function textoCelulaSeguro_(valor) {
  const texto = String(valor || "");
  return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
}

function validarLinha_(aba, numeroLinha) {
  const linha = Number(numeroLinha);
  if (!Number.isInteger(linha) || linha < 2 || linha > aba.getLastRow()) throw new Error("Solicitação inválida.");
  return linha;
}

function registrarAuditoria_(usuario, acao, linha, antes, depois) {
  const planilha = abrirPlanilha_();
  let aba = planilha.getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!aba) aba = planilha.insertSheet(JL_CONFIG.AUDIT_SHEET);
  if (aba.getLastRow() === 0) aba.appendRow(["DATA_HORA", "EMAIL", "PERFIL", "ACAO", "LINHA_ORIGEM", "ANTES", "DEPOIS"]);
  aba.appendRow([new Date(), usuario.email, usuario.perfil, acao, linha, JSON.stringify(antes || {}), JSON.stringify(depois || {})]);
}

function designarJuiz_(usuario, numeroLinha, nomeJuiz) {
  const nome = String(nomeJuiz || "").trim();
  if (!nome || nome.length > 150) throw new Error("Selecione uma juíza ou um juiz leigo válido.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = obterFonte_();
    const linha = validarLinha_(aba, numeroLinha);
    const mapa = mapaCabecalhos_(aba);
    const atual = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    if (!ehSolicitacao_(atual, mapa)) throw new Error("A linha selecionada não é uma solicitação.");
    const antes = { juiz: valor_(atual, mapa, "ASSIGNED_JUDGE"), status: valor_(atual, mapa, "STATUS") };
    escreverCampo_(aba, mapa, linha, "ASSIGNED_JUDGE", textoCelulaSeguro_(nome));
    escreverCampo_(aba, mapa, linha, "ASSIGNED_AT", new Date());
    escreverCampo_(aba, mapa, linha, "STATUS", "Em atendimento");
    registrarAuditoria_(usuario, "DESIGNAR_JUIZ", linha, antes, { juiz: nome, status: "Em atendimento" });
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function atualizarSolicitacao_(usuario, numeroLinha, status, observacoes) {
  const novoStatus = String(status || "").trim();
  if (!JL_CONFIG.STATUS.includes(novoStatus)) throw new Error("Status inválido.");
  const notas = String(observacoes || "").trim();
  if (notas.length > 4000) throw new Error("As observações devem ter no máximo 4.000 caracteres.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = obterFonte_();
    const linha = validarLinha_(aba, numeroLinha);
    const mapa = mapaCabecalhos_(aba);
    const atual = aba.getRange(linha, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    if (!ehSolicitacao_(atual, mapa)) throw new Error("A linha selecionada não é uma solicitação.");
    const antes = { status: valor_(atual, mapa, "STATUS"), observacoes: valor_(atual, mapa, "NOTES") };
    escreverCampo_(aba, mapa, linha, "STATUS", novoStatus);
    escreverCampo_(aba, mapa, linha, "NOTES", textoCelulaSeguro_(notas));
    registrarAuditoria_(usuario, "ATUALIZAR_SOLICITACAO", linha, antes, { status: novoStatus, observacoes: notas });
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
