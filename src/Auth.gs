function normalizarEmail_(valor) {
  return String(valor || "").trim().toLowerCase();
}

function emailsPermitidos_() {
  return propriedadeObrigatoria_(JL_CONFIG.PROPERTIES.ALLOWED_EMAILS)
    .split(/[;,\n]+/).map(normalizarEmail_).filter(Boolean);
}

// Em um Web App do Apps Script, a identidade institucional deve vir da
// sessão do Google Workspace. Isso evita o GIS dentro do iframe sandbox do
// HtmlService, cuja origem compartilhada não pode ser cadastrada como origem
// OAuth JavaScript.
function identidadeWorkspace_() {
  let email = "";
  try {
    email = normalizarEmail_(Session.getActiveUser().getEmail());
  } catch (erro) {
    email = "";
  }
  const dominio = dominioInstitucional_();
  if (!email) {
    throw new Error(
      "Não foi possível identificar sua conta Google. Implante o Web App como uma conta @" +
      dominio + " e escolha acesso somente para usuários do domínio."
    );
  }
  if (!email.endsWith("@" + dominio)) {
    throw new Error("Use exclusivamente sua conta institucional @" + dominio + ".");
  }
  if (!emailsPermitidos_().includes(email)) {
    throw new Error("Sua conta institucional não está autorizada a acessar este sistema.");
  }
  return { email: email, nome: email.split("@")[0] };
}

function hashToken_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function emailsAdministradores_() {
  return String(PropertiesService.getScriptProperties().getProperty(JL_CONFIG.PROPERTIES.ADMIN_EMAILS) || "")
    .split(/[;,\n]+/).map(normalizarEmail_).filter(Boolean);
}

function perfilUsuario_(identidade) {
  const email = normalizarEmail_(identidade.email);
  if (emailsAdministradores_().includes(email)) return JL_CONFIG.ROLES.ADMIN;
  const planilha = abrirPlanilha_();
  const aba = planilha.getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!aba || aba.getLastRow() < 2) return JL_CONFIG.ROLES.VIEWER;
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 4).getDisplayValues();
  const registro = linhas.find(linha => {
    const ativo = String(linha[3] || "").trim().toUpperCase();
    return normalizarEmail_(linha[0]) === email && ["TRUE", "VERDADEIRO", "SIM", "1"].includes(ativo);
  });
  if (!registro) return JL_CONFIG.ROLES.VIEWER;
  const perfil = String(registro[2] || "").trim().toUpperCase();
  return perfil === JL_CONFIG.ROLES.ADMIN ? JL_CONFIG.ROLES.ADMIN
    : perfil === JL_CONFIG.ROLES.MANAGER ? JL_CONFIG.ROLES.MANAGER
    : JL_CONFIG.ROLES.VIEWER;
}

function criarSessao_(identidade) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const sessao = {
    email: normalizarEmail_(identidade.email),
    nome: identidade.nome,
    perfil: perfilUsuario_(identidade),
    emitidaEm: new Date().toISOString()
  };
  CacheService.getScriptCache().put("sessao:" + hashToken_(token), JSON.stringify(sessao), JL_CONFIG.SESSION_SECONDS);
  return { token: token, usuario: sessao, expiresIn: JL_CONFIG.SESSION_SECONDS };
}

function exigirSessao_(token, perfisPermitidos) {
  const chave = "sessao:" + hashToken_(String(token || ""));
  const bruto = token ? CacheService.getScriptCache().get(chave) : null;
  if (!bruto) throw new Error("Sessão ausente ou expirada. Entre novamente.");
  const sessao = JSON.parse(bruto);
  const email = normalizarEmail_(sessao.email);
  if (!email.endsWith("@" + dominioInstitucional_()) || !emailsPermitidos_().includes(email)) {
    CacheService.getScriptCache().remove(chave);
    throw new Error("Sessão inválida ou acesso revogado.");
  }
  if (perfisPermitidos && !perfisPermitidos.includes(sessao.perfil)) throw new Error("Seu perfil não autoriza esta operação.");
  return sessao;
}

function podeGerenciar_(usuario) {
  return usuario.perfil === JL_CONFIG.ROLES.MANAGER || usuario.perfil === JL_CONFIG.ROLES.ADMIN;
}
