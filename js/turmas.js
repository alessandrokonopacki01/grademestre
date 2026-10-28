
const CHAVE_TURMAS = "grademestre_turmas";

let turmas = carregarTurmas();

const elTurma = id => document.getElementById(id);

function carregarTurmas() {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_TURMAS) || "[]"
    );

    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarTurmas() {
  localStorage.setItem(CHAVE_TURMAS, JSON.stringify(turmas));

  if (typeof avisarGradeDesatualizada === "function") {
    avisarGradeDesatualizada();
  }
}

function normalizarNome(nome) {
  return String(nome || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function elementoTurma(tag, texto, classe = "") {
  const elemento = document.createElement(tag);

  elemento.textContent = texto;

  if (classe) {
    elemento.className = classe;
  }

  return elemento;
}

// ==========================================
// CONFIGURAÇÃO INDIVIDUAL DAS TURMAS
// ==========================================

function cargaSemanalTurma(turma) {
  return Number(turma?.aulasSemanais) === 25 ? 25 : 30;
}

function contraturnoTurma(turma) {
  let config = {};

  try {
    config = JSON.parse(
      localStorage.getItem("grademestre_config") || "{}"
    ) || {};
  } catch {}

  return turma?.diaContraturno ||
    config.contraturno ||
    "segunda";
}

// ==========================================
// DOCÊNCIA COMPARTILHADA
// ==========================================

function obterDistribuicaoTurma(nomeTurma) {
  const resultado = [];
  const grupos = new Map();
  const chaveTurma = normalizarNome(nomeTurma);

  professores.forEach(professor => {
    (professor.vinculos || []).forEach(vinculo => {
      if (
        normalizarNome(vinculo.turma) !== chaveTurma
      ) {
        return;
      }

      const codigo = String(
        vinculo.grupoCompartilhado || ""
      ).trim().toLocaleLowerCase("pt-BR");

      const item = {
        professorId: professor.id,
        professor: professor.nome,
        disciplina: vinculo.disciplina,
        aulas: Number(vinculo.aulas),
        maxDia: Number(vinculo.maxDia),
        grupoCompartilhado: codigo
      };

      if (!codigo) {
        resultado.push(item);
        return;
      }

      const chaveGrupo = `${chaveTurma}|${codigo}`;
      const existente = grupos.get(chaveGrupo);

      if (!existente) {
        item.professoresIds = [professor.id];
        grupos.set(chaveGrupo, item);
        resultado.push(item);
        return;
      }

      existente.professor += ` + ${professor.nome}`;
      existente.professoresIds.push(professor.id);

      existente.maxDia = Math.min(
        existente.maxDia,
        item.maxDia
      );
    });
  });

  return resultado;
}

// ==========================================
// CÁLCULO DA CARGA HORÁRIA
// ==========================================

function calcularSituacaoTurma(turma) {
  const distribuicao = obterDistribuicaoTurma(turma.nome);

  const total = distribuicao.reduce(
    (soma, item) => soma + item.aulas,
    0
  );

  const meta = cargaSemanalTurma(turma);

  return {
    distribuicao,
    total,
    meta,
    faltantes: Math.max(0, meta - total),
    excedentes: Math.max(0, total - meta),
    completa: total === meta
  };
}

function criarIndicador(valor, descricao) {
  const caixa = document.createElement("div");
  caixa.className = "indicador";

  caixa.append(
    elementoTurma("strong", String(valor)),
    elementoTurma("span", descricao)
  );

  return caixa;
}

// ==========================================
// RESUMO DAS TURMAS
// ==========================================

function renderizarResumoTurmas() {
  const resumo = elTurma("resumo-turmas");
  resumo.replaceChildren();

  const completas = turmas.filter(
    turma => calcularSituacaoTurma(turma).completa
  ).length;

  resumo.append(
    criarIndicador(
      turmas.length,
      "Turmas cadastradas"
    ),
    criarIndicador(
      completas,
      "Turmas completas"
    ),
    criarIndicador(
      turmas.length - completas,
      "Turmas pendentes"
    )
  );

  elTurma("total-turmas").textContent = turmas.length;
}

// ==========================================
// TABELA DE DISTRIBUIÇÃO
// ==========================================

function criarTabelaDistribuicao(distribuicao) {
  const wrapper = document.createElement("div");
  wrapper.className = "turma-detalhes";

  const tabela = document.createElement("table");
  tabela.className = "tabela-turma";

  const cabecalho = document.createElement("thead");
  const trCabecalho = document.createElement("tr");

  [
    "Disciplina",
    "Professor",
    "Aulas/semana",
    "Máx./dia"
  ].forEach(titulo => {
    trCabecalho.appendChild(
      elementoTurma("th", titulo)
    );
  });

  cabecalho.appendChild(trCabecalho);
  tabela.appendChild(cabecalho);

  const corpo = document.createElement("tbody");

  distribuicao.forEach(item => {
    const linha = document.createElement("tr");

    [
      item.disciplina,
      item.professor,
      String(item.aulas),
      String(item.maxDia)
    ].forEach(valor => {
      linha.appendChild(
        elementoTurma("td", valor)
      );
    });

    corpo.appendChild(linha);
  });

  tabela.appendChild(corpo);
  wrapper.appendChild(tabela);

  return wrapper;
}

// ==========================================
// RENDERIZAR TURMAS
// ==========================================

function renderizarTurmas() {
  const lista = elTurma("lista-turmas");
  lista.replaceChildren();

  renderizarResumoTurmas();

  if (!turmas.length) {
    lista.appendChild(
      elementoTurma(
        "div",
        "Nenhuma turma cadastrada. Clique em Nova turma.",
        "estado-vazio"
      )
    );
    return;
  }

  turmas.forEach(turma => {
    const situacao = calcularSituacaoTurma(turma);

    const card = document.createElement("article");
    card.className = "turma-card";

    const topo = document.createElement("div");
    topo.className = "turma-topo";

    topo.appendChild(
      elementoTurma("h3", turma.nome)
    );

    topo.appendChild(
      elementoTurma(
        "strong",
        `${situacao.total} / ${situacao.meta} aulas`
      )
    );

    card.appendChild(topo);

    const barra = document.createElement("div");
    barra.className = "progresso-turma";

    const preenchimento = document.createElement("div");

    preenchimento.style.width =
      `${Math.min(
        100,
        situacao.total / situacao.meta * 100
      )}%`;

    if (situacao.excedentes > 0) {
      preenchimento.style.background = "#dc2626";
    } else if (situacao.completa) {
      preenchimento.style.background = "#16a34a";
    }

    barra.appendChild(preenchimento);
    card.appendChild(barra);

    let textoSituacao;
    let classeSituacao;

    if (situacao.completa) {
      textoSituacao =
        `Carga horária completa: ${situacao.meta} aulas`;
      classeSituacao = "completa";
    } else if (situacao.excedentes > 0) {
      textoSituacao =
        `Excesso de ${situacao.excedentes} aula(s)`;
      classeSituacao = "excedida";
    } else {
      textoSituacao =
        `Faltam ${situacao.faltantes} aula(s)`;
      classeSituacao = "incompleta";
    }

    card.appendChild(
      elementoTurma(
        "p",
        textoSituacao,
        `situacao-turma ${classeSituacao}`
      )
    );

    const descricao = cargaSemanalTurma(turma) === 25
      ? "Somente turno regular"
      : `Contraturno: ${contraturnoTurma(turma)}`;

    card.appendChild(
      elementoTurma("p", descricao)
    );

    if (situacao.distribuicao.length) {
      card.appendChild(
        criarTabelaDistribuicao(
          situacao.distribuicao
        )
      );
    } else {
      card.appendChild(
        elementoTurma(
          "p",
          "Nenhuma disciplina vinculada. " +
          "Acesse Professores para adicionar."
        )
      );
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes-form";

    const editar = document.createElement("button");
    editar.className = "btn-secundario";
    editar.textContent = "Editar";

    editar.addEventListener("click", () => {
      abrirEditorTurma(turma);
    });

    const excluir = document.createElement("button");
    excluir.className = "btn-remover";
    excluir.textContent = "Excluir";

    excluir.addEventListener("click", () => {
      excluirTurma(turma.id);
    });

    acoes.append(editar, excluir);
    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

// ==========================================
// CRIAR OS NOVOS CAMPOS DO FORMULÁRIO
// ==========================================

function prepararCamposTurma() {
  if (elTurma("turma-aulas-semanais")) {
    return;
  }

  const referencia = elTurma("turma-nome");

  const bloco = document.createElement("div");
  bloco.className = "configuracao-carga-turma";

  const rotuloCarga = document.createElement("label");
  rotuloCarga.htmlFor = "turma-aulas-semanais";
  rotuloCarga.textContent = "Aulas semanais";

  const campoCarga = document.createElement("select");
  campoCarga.id = "turma-aulas-semanais";

  [
    ["25", "25 aulas — somente manhã"],
    ["30", "30 aulas — manhã e contraturno"]
  ].forEach(([valor, texto]) => {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    campoCarga.appendChild(opcao);
  });

  const blocoDia = document.createElement("div");
  blocoDia.id = "bloco-dia-contraturno";

  const rotuloDia = document.createElement("label");
  rotuloDia.htmlFor = "turma-dia-contraturno";
  rotuloDia.textContent = "Dia do contraturno";

  const campoDia = document.createElement("select");
  campoDia.id = "turma-dia-contraturno";

  [
    ["segunda", "Segunda"],
    ["terca", "Terça"],
    ["quarta", "Quarta"],
    ["quinta", "Quinta"],
    ["sexta", "Sexta"]
  ].forEach(([valor, texto]) => {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    campoDia.appendChild(opcao);
  });

  blocoDia.append(rotuloDia, campoDia);
  bloco.append(rotuloCarga, campoCarga, blocoDia);

  referencia.insertAdjacentElement("afterend", bloco);

  campoCarga.addEventListener("change", () => {
    blocoDia.hidden = campoCarga.value !== "30";
  });
}

// ==========================================
// ABRIR E FECHAR EDITOR
// ==========================================

function abrirEditorTurma(turma = null) {
  prepararCamposTurma();

  elTurma("editor-turma").hidden = false;
  elTurma("form-turma").reset();

  elTurma("turma-id").value = turma?.id || "";
  elTurma("turma-nome").value = turma?.nome || "";

  elTurma("turma-aulas-semanais").value =
    String(cargaSemanalTurma(turma));

  elTurma("turma-dia-contraturno").value =
    contraturnoTurma(turma);

  elTurma("turma-aulas-semanais").dispatchEvent(
    new Event("change")
  );

  elTurma("titulo-editor-turma").textContent = turma
    ? "Editar turma"
    : "Cadastrar turma";

  elTurma("editor-turma").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function fecharEditorTurma() {
  elTurma("editor-turma").hidden = true;
}

// ==========================================
// EXCLUIR TURMA
// ==========================================

function excluirTurma(id) {
  const turma = turmas.find(item => item.id === id);

  if (!turma) return;

  const vinculos = obterDistribuicaoTurma(turma.nome);

  if (vinculos.length) {
    alert(
      "Esta turma possui professores vinculados. " +
      "Remova os vínculos no cadastro dos professores " +
      "antes de excluí-la."
    );
    return;
  }

  if (!confirm(`Excluir a turma ${turma.nome}?`)) {
    return;
  }

  turmas = turmas.filter(item => item.id !== id);

  try {
    salvarTurmas();
    fecharEditorTurma();
    renderizarTurmas();
  } catch (erro) {
    alert("Erro ao excluir a turma.");
    console.error(erro);
  }
}

// ==========================================
// BOTÕES DO CADASTRO
// ==========================================

elTurma("nova-turma").addEventListener("click", () => {
  abrirEditorTurma();
});

elTurma("cancelar-turma").addEventListener(
  "click",
  fecharEditorTurma
);

// ==========================================
// SALVAR CADASTRO DA TURMA
// ==========================================

elTurma("form-turma").addEventListener(
  "submit",
  evento => {
    evento.preventDefault();

    const id = elTurma("turma-id").value;

    const nome = elTurma("turma-nome").value
      .trim()
      .replace(/\s+/g, " ");

    if (!nome) {
      alert("Informe o nome da turma.");
      return;
    }

    const repetida = turmas.some(t =>
      t.id !== id &&
      normalizarNome(t.nome) === normalizarNome(nome)
    );

    if (repetida) {
      alert("Já existe uma turma com esse nome.");
      return;
    }

    const aulasSemanais = Number(
      elTurma("turma-aulas-semanais").value
    );

    const diaContraturno =
      elTurma("turma-dia-contraturno").value;

    if (![25, 30].includes(aulasSemanais)) {
      alert("Escolha uma carga semanal válida.");
      return;
    }

    if (
      aulasSemanais === 30 &&
      ![
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta"
      ].includes(diaContraturno)
    ) {
      alert("Selecione um dia válido para o contraturno.");
      return;
    }

    const turmaAnterior = turmas.find(t => t.id === id);

    // Copia os professores para não alterar o
    // cadastro original antes de salvar.

    const professoresAtualizados = professores.map(p => ({
      ...p,
      vinculos: (p.vinculos || []).map(v => ({
        ...v
      }))
    }));

    // Se a turma for renomeada, atualiza os vínculos.
    if (
      turmaAnterior &&
      normalizarNome(turmaAnterior.nome) !==
        normalizarNome(nome)
    ) {
      const vinculosNoDestino =
        professoresAtualizados.some(p =>
          p.vinculos.some(v =>
            normalizarNome(v.turma) ===
            normalizarNome(nome)
          )
        );

      if (vinculosNoDestino) {
        alert(
          "Já existem vínculos de professores " +
          "com o novo nome. Escolha outro nome."
        );
        return;
      }

      professoresAtualizados.forEach(p => {
        p.vinculos.forEach(v => {
          if (
            normalizarNome(v.turma) ===
            normalizarNome(turmaAnterior.nome)
          ) {
            v.turma = nome;
          }
        });
      });
    }

    const configuracaoTurma = {
      nome,
      aulasSemanais,
      diaContraturno:
        aulasSemanais === 30 ? diaContraturno : null
    };

    const novasTurmas = id
      ? turmas.map(t =>
          t.id === id
            ? { ...t, ...configuracaoTurma }
            : t
        )
      : [
          ...turmas,
          {
            id: crypto.randomUUID(),
            ...configuracaoTurma
          }
        ];

    // Salva os cadastros com tentativa de
    // restauração se houver erro.

    const backupTurmas =
      localStorage.getItem(CHAVE_TURMAS);

    const backupProfessores =
      localStorage.getItem(CHAVE_PROFESSORES);

    try {
      localStorage.setItem(
        CHAVE_TURMAS,
        JSON.stringify(novasTurmas)
      );

      localStorage.setItem(
        CHAVE_PROFESSORES,
        JSON.stringify(professoresAtualizados)
      );

      turmas = novasTurmas;
      professores = professoresAtualizados;

      renderizarProfessores();
      renderizarTurmas();
      fecharEditorTurma();

      if (
        typeof avisarGradeDesatualizada === "function"
      ) {
        avisarGradeDesatualizada();
      }
    } catch (erro) {
      try {
        if (backupTurmas === null) {
          localStorage.removeItem(CHAVE_TURMAS);
        } else {
          localStorage.setItem(
            CHAVE_TURMAS,
            backupTurmas
          );
        }

        if (backupProfessores === null) {
          localStorage.removeItem(CHAVE_PROFESSORES);
        } else {
          localStorage.setItem(
            CHAVE_PROFESSORES,
            backupProfessores
          );
        }
      } catch (erroRestauracao) {
        console.error(
          "Falha ao restaurar os cadastros:",
          erroRestauracao
        );
      }

      alert("Erro ao salvar a turma.");
      console.error(erro);
    }
  }
);

renderizarTurmas();
