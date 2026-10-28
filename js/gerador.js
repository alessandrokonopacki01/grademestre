
const botaoGerar = document.getElementById("gerar-grade");
const statusGerador = document.getElementById("status-gerador");

const URL_API = "https://grademestre.onrender.com";

const painelDiagnostico = document.getElementById(
  "painel-diagnostico"
);

const listaDiagnosticos = document.getElementById(
  "lista-diagnosticos"
);

// ==========================================
// DIAGNÓSTICO INTELIGENTE
// ==========================================

function limparDiagnostico() {
  if (painelDiagnostico) {
    painelDiagnostico.hidden = true;
  }

  if (listaDiagnosticos) {
    listaDiagnosticos.replaceChildren();
  }
}

function mostrarDiagnostico(problemas) {
  limparDiagnostico();

  if (
    !Array.isArray(problemas) ||
    !problemas.length ||
    !painelDiagnostico ||
    !listaDiagnosticos
  ) {
    return;
  }

  painelDiagnostico.hidden = false;

  problemas.forEach(problema => {
    const card = document.createElement("article");
    card.className = "diagnostico-item";

    const titulo = document.createElement("h4");
    titulo.textContent = problema.titulo || "Conflito";

    const detalhe = document.createElement("p");
    detalhe.textContent = problema.detalhe || "";

    const etiqueta = document.createElement("strong");

    etiqueta.textContent =
      problema.tipo === "comprovado"
        ? "Impossibilidade comprovada"
        : "Restrições para revisar";

    const lista = document.createElement("ul");

    (problema.sugestoes || []).forEach(sugestao => {
      const item = document.createElement("li");
      item.textContent = sugestao;
      lista.appendChild(item);
    });

    card.append(
      titulo,
      etiqueta,
      detalhe,
      lista
    );

    listaDiagnosticos.appendChild(card);
  });

  painelDiagnostico.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

// ==========================================
// VALIDAR CONFIGURAÇÃO DAS TURMAS
// ==========================================

function validarTurmasParaGeracao() {
  if (!turmas.length) {
    return "Cadastre pelo menos uma turma.";
  }

  if (!professores.length) {
    return "Cadastre pelo menos um professor.";
  }

  const modelo = aulasRegularesPorDia();

  const diasValidos = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta"
  ];

  for (const turma of turmas) {
    const carga = cargaSemanalTurma(turma);

    if (modelo === 6 && carga !== 30) {
      return (
        `A turma ${turma.nome} está incompatível ` +
        "com o modelo de seis aulas por dia."
      );
    }

    if (modelo === 5 && ![25, 30].includes(carga)) {
      return (
        `A turma ${turma.nome} possui uma carga ` +
        "semanal inválida."
      );
    }

    if (
      turmaTemContraturno(turma) &&
      !diasValidos.includes(contraturnoTurma(turma))
    ) {
      return (
        `Confira o dia do contraturno ` +
        `da turma ${turma.nome}.`
      );
    }

    const situacao = calcularSituacaoTurma(turma);

    if (!situacao.completa) {
      return (
        `A turma ${turma.nome} possui ` +
        `${situacao.total}/${situacao.meta} ` +
        "aulas cadastradas."
      );
    }

    // Verifica grupos compartilhados antes
    // de enviar a requisição ao backend.

    const opcoes = opcoesTurma(turma);

    for (const op of opcoes) {
      const problema = validarOpcaoCompartilhada(op);

      if (problema) {
        return (
          `Docência compartilhada — ${turma.nome}: ` +
          problema
        );
      }
    }
  }

  return null;
}

// ==========================================
// CALCULAR TOTAL DE AULAS DA ESCOLA
// ==========================================

function totalAulasEsperadas() {
  return turmas.reduce(
    (soma, turma) =>
      soma + cargaSemanalTurma(turma),
    0
  );
}

// ==========================================
// GERADOR AUTOMÁTICO
// ==========================================

botaoGerar.addEventListener("click", async () => {
  const erroCadastro = validarTurmasParaGeracao();

  if (erroCadastro) {
    statusGerador.textContent = erroCadastro;
    return;
  }

  const campoPreservar = document.getElementById(
    "preservar-aulas"
  );

  const preservar = Boolean(campoPreservar?.checked);

  // Não permite preservar aulas quando os
  // cadastros foram modificados.

  if (preservar && gradeDesatualizada()) {
    statusGerador.textContent =
      "Os cadastros foram alterados. " +
      "Desmarque 'Preservar aulas já preenchidas' " +
      "para gerar novamente.";

    return;
  }

  // Validação das aulas já posicionadas.

  if (preservar) {
    const erroAtual = validarGrade(grade);

    if (erroAtual) {
      statusGerador.textContent =
        "A grade atual possui conflitos: " +
        erroAtual;

      return;
    }
  }

  // ========================================
  // PREPARAR DADOS PARA O PYTHON
  // ========================================

  const configuracao = configuracaoEscolarTurmas();

  const dados = {
    config: {
      modelo: String(configuracao.modelo),
      contraturno: configuracao.contraturno
    },

    turmas: turmas.map(turma => ({
      ...turma,
      aulasSemanais: cargaSemanalTurma(turma),
      diaContraturno: turmaTemContraturno(turma)
        ? contraturnoTurma(turma)
        : null
    })),

    professores,

    fixadas: preservar ? { ...grade } : {}
  };

  const totalEsperado = totalAulasEsperadas();

  limparDiagnostico();

  botaoGerar.disabled = true;
  botaoGerar.textContent = "Calculando...";

  statusGerador.textContent =
    `Procurando uma distribuição válida ` +
    `para ${totalEsperado} aulas...`;

  // ========================================
  // COMUNICAÇÃO COM A API
  // ========================================

  const controlador = new AbortController();

  const limite = setTimeout(
    () => controlador.abort(),
    90000
  );

  try {
    const resposta = await fetch(
      `${URL_API}/gerar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dados),
        signal: controlador.signal
      }
    );

    let resultado;

    try {
      resultado = await resposta.json();
    } catch {
      throw new Error(
        "A API não retornou JSON válido."
      );
    }

    // ======================================
    // ERROS DO SERVIDOR
    // ======================================

    if (!resposta.ok) {
      let mensagem = `Erro HTTP ${resposta.status}`;

      if (typeof resultado.detail === "string") {
        mensagem = resultado.detail;
      } else if (Array.isArray(resultado.detail)) {
        mensagem = resultado.detail
          .map(item => item.msg || "Erro de validação")
          .join("; ");
      }

      throw new Error(mensagem);
    }

    // ======================================
    // DIAGNÓSTICO DE INVIABILIDADE
    // ======================================

    if (!resultado.sucesso) {
      statusGerador.textContent =
        resultado.mensagem ||
        "Não foi possível gerar os horários.";

      if (resultado.situacao === "inviavel") {
        mostrarDiagnostico(
          resultado.diagnostico
        );
      } else if (
        resultado.situacao === "limite_ou_erro"
      ) {
        statusGerador.textContent +=
          " Tente novamente ou revise as restrições. " +
          "A impossibilidade não foi comprovada.";
      }

      return;
    }

    // ======================================
    // VALIDAR RESULTADO DA API
    // ======================================

    if (
      !resultado.grade ||
      typeof resultado.grade !== "object" ||
      Array.isArray(resultado.grade)
    ) {
      throw new Error(
        "A API retornou uma grade inválida."
      );
    }

    const totalRecebido = Object.keys(
      resultado.grade
    ).length;

    if (totalRecebido !== totalEsperado) {
      throw new Error(
        `O servidor retornou ${totalRecebido} ` +
        `aulas, mas eram esperadas ` +
        `${totalEsperado}.`
      );
    }

    // O horarios.js deverá validar
    // individualmente as posições de cada turma.

    const erroGrade = validarGrade(
      resultado.grade,
      true
    );

    if (erroGrade) {
      throw new Error(
        "O resultado recebido não passou " +
        "na validação: " + erroGrade
      );
    }

    // ======================================
    // SALVAR SOMENTE APÓS VALIDAR
    // ======================================

    salvarGrade(resultado.grade);

    selecaoGrade = null;

    renderizarGrade();

    statusGerador.textContent =
      `Horários gerados: ${totalRecebido} ` +
      `aulas distribuídas sem conflitos detectados.`;

  } catch (erro) {
    statusGerador.textContent =
      erro.name === "AbortError"
        ? "A requisição excedeu o tempo limite."
        : `Falha na geração: ${erro.message}`;

    console.error(erro);

  } finally {
    clearTimeout(limite);

    botaoGerar.disabled = false;

    botaoGerar.textContent =
      "Gerar horários automaticamente";
  }
});
