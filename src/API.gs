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
  return {
    usuario: usuario,
    permissoes: { gerenciar: podeGerenciar_(usuario) },
    solicitacoes: dados.solicitacoes,
    juizes: dados.juizes,
    statusPermitidos: JL_CONFIG.STATUS,
    metricas: {
      total: dados.solicitacoes.length,
      pendentes: dados.solicitacoes.filter(item => item.status === "Pendente").length,
      emAtendimento: dados.solicitacoes.filter(item => item.status === "Em atendimento").length,
      disponiveis: dados.juizes.length
    }
  };
}

function apiDesignarJuiz(token, numeroLinha, nomeJuiz) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.MANAGER, JL_CONFIG.ROLES.ADMIN]);
  return designarJuiz_(usuario, numeroLinha, nomeJuiz);
}

function apiAtualizarSolicitacao(token, numeroLinha, status, observacoes) {
  const usuario = exigirSessao_(token, [JL_CONFIG.ROLES.MANAGER, JL_CONFIG.ROLES.ADMIN]);
  return atualizarSolicitacao_(usuario, numeroLinha, status, observacoes);
}

function verificarConfiguracao_() {
  const dominio = dominioInstitucional_();
  const emailsInvalidos = emailsPermitidos_().filter(email => !email.endsWith("@" + dominio));
  if (emailsInvalidos.length) throw new Error("ALLOWED_EMAILS contém endereço fora do domínio institucional.");
  const aba = obterFonte_();
  mapaCabecalhos_(aba);
  return "Configuração válida. Aba encontrada: " + aba.getName() + ".";
}

function instalarEstruturasAuxiliares_() {
  const planilha = abrirPlanilha_();
  let usuarios = planilha.getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!usuarios) usuarios = planilha.insertSheet(JL_CONFIG.USERS_SHEET);
  if (usuarios.getLastRow() === 0) {
    usuarios.appendRow(["EMAIL", "NOME", "PERFIL", "ATIVO"]);
    usuarios.setFrozenRows(1);
  }
  let auditoria = planilha.getSheetByName(JL_CONFIG.AUDIT_SHEET);
  if (!auditoria) auditoria = planilha.insertSheet(JL_CONFIG.AUDIT_SHEET);
  if (auditoria.getLastRow() === 0) {
    auditoria.appendRow(["DATA_HORA", "EMAIL", "PERFIL", "ACAO", "LINHA_ORIGEM", "ANTES", "DEPOIS"]);
    auditoria.setFrozenRows(1);
  }
  return "Abas auxiliares instaladas.";
}
