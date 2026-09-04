function apiConfiguracaoPublica() {
  return { nome: JL_CONFIG.APP_NAME, dominio: dominioInstitucional_(), autenticacao: "WORKSPACE" };
}

function apiLogin() {
  return criarSessao_(identidadeWorkspace_());
}

function apiLogout(token) {
  if (token) CacheService.getScriptCache().remove("sessao:" + hashToken_(String(token)));
  return { ok: true };
}

function apiBootstrap(token) {
  const usuario = exigirSessao_(token);
  const dados = listarDados_(usuario);
  const ativas = dados.solicitacoes.filter(item => !statusFinal_(item.status));
  return {
    usuario: usuario,
    permissoes: { gerenciar: podeGerenciar_(usuario), administrar: podeAdministrar_(usuario) },
    solicitacoes: dados.solicitacoes,
    juizes: dados.juizes,
    statusPermitidos: JL_CONFIG.STATUS,
    prioridadesPermitidas: JL_CONFIG.PRIORITIES,
    notificacoesAtivas: notificacoesAtivas_(),
    atualizadoEm: new Date().toISOString(),
    metricas: {
      total: dados.solicitacoes.length,
      pendentes: dados.solicitacoes.filter(item => item.status === "Pendente").length,
      emAtendimento: dados.solicitacoes.filter(item => item.status === "Em atendimento").length,
      concluidas: dados.solicitacoes.filter(item => item.status === "Concluído").length,
      semJuiz: ativas.filter(item => !String(item.juiz || "").trim()).length,
      atrasadas: ativas.filter(item => item.atrasada).length,
      antigas: ativas.filter(item => item.diasEspera >= 7).length,
      disponiveis: dados.juizes.filter(item => !item.lotado).length
    }
  };
}

function apiDesignarJuiz(token, numeroLinha, nomeJuiz, justificativaExcesso, permitirExcesso, prioridade, prazo) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.MANAGER, JL_CONFIG.ROLES.ADMIN]);
  return designarJuiz_(usuario, numeroLinha, nomeJuiz, justificativaExcesso, Boolean(permitirExcesso), prioridade, prazo);
}

function apiAtualizarSolicitacao(token, numeroLinha, status, observacoes, prioridade, prazo) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.MANAGER, JL_CONFIG.ROLES.ADMIN]);
  return atualizarSolicitacao_(usuario, numeroLinha, status, observacoes, prioridade, prazo);
}

function apiHistoricoSolicitacao(token, numeroLinha) {
  const usuario = exigirSessao_(token);
  const solicitacao = listarDados_(usuario).solicitacoes.find(item => item.id === Number(numeroLinha));
  if (!solicitacao) throw new Error("Solicitação não encontrada ou não autorizada.");
  return listarHistorico_(numeroLinha);
}

function apiListarUsuarios(token) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.ADMIN]);
  return listarUsuarios_(usuario);
}

function apiSalvarUsuario(token, dados) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.ADMIN]);
  return salvarUsuario_(usuario, dados || {});
}

function verificarConfiguracao_() {
  const dominio = dominioInstitucional_();
  const emailsFixos = emailsPermitidos_().concat(emailsAdministradores_());
  if (!emailsFixos.length) throw new Error("Configure ALLOWED_EMAILS ou ADMIN_EMAILS antes da implantação.");
  if (emailsFixos.some(email => !email.endsWith("@" + dominio))) {
    throw new Error("As listas de acesso contêm endereço fora do domínio institucional.");
  }
  const aba = obterFonte_();
  mapaCabecalhos_(aba);
  const planilha = abrirPlanilha_();
  [JL_CONFIG.USERS_SHEET, JL_CONFIG.AUDIT_SHEET, JL_CONFIG.MANAGEMENT_SHEET].forEach(nome => {
    if (!planilha.getSheetByName(nome)) throw new Error("Aba auxiliar ausente: " + nome + ". Execute instalarEstruturasAuxiliares_().");
  });
  return "Configuração válida. Aba encontrada: " + aba.getName() + ".";
}

function garantirCabecalhos_(aba, cabecalhos) {
  if (aba.getMaxColumns() < cabecalhos.length) aba.insertColumnsAfter(aba.getMaxColumns(), cabecalhos.length - aba.getMaxColumns());
  aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, cabecalhos.length).setFontWeight("bold").setBackground("#132a46").setFontColor("#ffffff");
}

function instalarEstruturasAuxiliares_() {
  const planilha = abrirPlanilha_();
  let usuarios = planilha.getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!usuarios) usuarios = planilha.insertSheet(JL_CONFIG.USERS_SHEET);
  garantirCabecalhos_(usuarios, JL_CONFIG.USER_HEADERS);

  let auditoria = planilha.getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!auditoria) auditoria = planilha.insertSheet(JL_CONFIG.AUDIT_SHEET);
  garantirCabecalhos_(auditoria, ["DATA_HORA", "EMAIL", "PERFIL", "ACAO", "LINHA_ORIGEM", "ANTES", "DEPOIS"]);

  let gestao = planilha.getSheetByName(JL_CONFIG.MANAGEMENT_SHEET);
  if (!gestao) gestao = planilha.insertSheet(JL_CONFIG.MANAGEMENT_SHEET);
  garantirCabecalhos_(gestao, JL_CONFIG.MANAGEMENT_HEADERS);

  usuarios.autoResizeColumns(1, JL_CONFIG.USER_HEADERS.length);
  auditoria.autoResizeColumns(1, 7);
  gestao.autoResizeColumns(1, JL_CONFIG.MANAGEMENT_HEADERS.length);
  return "Estruturas instaladas: USUARIOS, AUDITORIA e GESTAO_SOLICITACOES.";
}
