
const CHAVE_TURMAS = "grademestre_turmas";

let turmas = carregarTurmas();

const elTurma = id => document.getElementById(id);

// ==========================================
// ARMAZENAMENTO
// ==========================================

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
  localStorage.setItem(
    CHAVE_TURMAS,
    JSON.stringify(turmas)
  );

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
// MODELO ESCOLAR
// ==========================================

function configuracaoEscolarTurmas() {
  let config = {};

  try {
    config = JSON.parse(
      localStorage.getItem("grademestre_config") || "{}"
    ) || {};
  } catch {}

  return {
    modelo: String(config.modelo || "6"),
    contraturno: config.contraturno || "segunda"
  };
}

function aulasRegularesPorDia() {
  return configuracaoEscolarTurmas().modelo === "5"
    ? 5
    : 6;
}

function modelosPermitidosTurma() {
  if (aulasRegularesPorDia() === 6) {
    return [30];
  }

  return [25, 30];
}

// Carga efetiva da turma.
//
// Escola com 6 aulas/dia:
// todas as turmas têm 30 aulas.
//
// Escola com 5 aulas/dia:
// cada turma pode ter 25 ou 30 aulas.

function cargaSemanalTurma(turma) {
  if (aulasRegularesPorDia() === 6) {
    return 30;
  }

  return Number(turma?.aulasSemanais) === 25
    ? 25
    : 30;
}

// Contraturno só existe quando a escola tem
// 5 aulas por dia e a turma possui 30 aulas.

function turmaTemContraturno(turma) {
  return (
    aulasRegularesPorDia() === 5 &&
    cargaSemanalTurma(turma) === 30
  );
}

function contraturnoTurma(turma) {
  if (!turmaTemContraturno(turma)) {
    return null;
  }

  const config = configuracaoEscolarTurmas();

  return turma?.diaContraturno ||
    config.contraturno ||
    "segunda";
}

function nomeDiaTurma(dia) {
  const nomes = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira"
  };

  return nomes[dia] || dia;
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

      const codigo = normalizarNome(
        vinculo.grupoCompartilhado || ""
      );

      const item = {
        professorId: professor.id,
        professor: professor.nome,
        disciplina: vinculo.disciplina,
        aulas: Number(vinculo.aulas),
        maxDia: Number(vinculo.maxDia),
        grupoCompartilhado: codigo
      };

      // Aula individual.
      if (!codigo) {
        resultado.push(item);
        return;
      }

      // Aula compartilhada:
      // conta somente uma vez para a turma.
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
// CÁLCULO DE CARGA HORÁRIA
// ==========================================

function calcularSituacaoTurma(turma) {
  const distribuicao = obterDistribuicaoTurma(
    turma.nome
  );

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

  elTurma("total-turmas").textContent =
    turmas.length;
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
// RENDERIZAR CADASTRO DAS TURMAS
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

    // Exibição do modelo individual da turma.
    let descricao;

    if (aulasRegularesPorDia() === 6) {
      descricao =
        "6 aulas por dia • 30 semanais • Sem contraturno";

    } else if (turmaTemContraturno(turma)) {
      descricao =
        "5 aulas por dia • 30 semanais • " +
        `Contraturno: ${nomeDiaTurma(
          contraturnoTurma(turma)
        )}`;

    } else {
      descricao =
        "5 aulas por dia • 25 semanais • Sem contraturno";
    }

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
// CAMPOS DINÂMICOS DO FORMULÁRIO
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

  const blocoDia = document.createElement("div");
  blocoDia.id = "bloco-dia-contraturno";

  const rotuloDia = document.createElement("label");
  rotuloDia.htmlFor = "turma-dia-contraturno";
  rotuloDia.textContent = "Dia do contraturno";

  const campoDia = document.createElement("select");
  campoDia.id = "turma-dia-contraturno";

  [
    ["segunda", "Segunda-feira"],
    ["terca", "Terça-feira"],
    ["quarta", "Quarta-feira"],
    ["quinta", "Quinta-feira"],
    ["sexta", "Sexta-feira"]
  ].forEach(([valor, texto]) => {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    campoDia.appendChild(opcao);
  });

  blocoDia.append(rotuloDia, campoDia);

  bloco.append(
    rotuloCarga,
    campoCarga,
    blocoDia
  );

  referencia.insertAdjacentElement(
    "afterend",
    bloco
  );

  campoCarga.addEventListener("change", () => {
    atualizarCamposModeloTurma();
  });
}

// ==========================================
// ATUALIZAR OPÇÕES SEGUNDO A ESCOLA
// ==========================================

function atualizarCamposModeloTurma() {
  const campoCarga = elTurma("turma-aulas-semanais");
  const blocoDia = elTurma("bloco-dia-contraturno");

  if (!campoCarga || !blocoDia) {
    return;
  }

  const modelo = aulasRegularesPorDia();
  const valorAnterior = Number(campoCarga.value);

  campoCarga.replaceChildren();

  if (modelo === 6) {
    const opcao = document.createElement("option");
    opcao.value = "30";
    opcao.textContent =
      "30 aulas — 6 por dia, sem contraturno";

    campoCarga.appendChild(opcao);
    campoCarga.value = "30";

    campoCarga.disabled = true;
    blocoDia.hidden = true;

  } else {
    campoCarga.disabled = false;

    [
      ["25", "25 aulas — somente manhã"],
      ["30", "30 aulas — manhã e contraturno"]
    ].forEach(([valor, texto]) => {
      const opcao = document.createElement("option");
      opcao.value = valor;
      opcao.textContent = texto;
      campoCarga.appendChild(opcao);
    });

    campoCarga.value =
      modelosPermitidosTurma().includes(valorAnterior)
        ? String(valorAnterior)
        : "30";

    blocoDia.hidden = campoCarga.value !== "30";
  }
}

// ==========================================
// ABRIR EDITOR DA TURMA
// ==========================================

function abrirEditorTurma(turma = null) {
  prepararCamposTurma();

  elTurma("editor-turma").hidden = false;
  elTurma("form-turma").reset();

  elTurma("turma-id").value =
    turma?.id || "";

  elTurma("turma-nome").value =
    turma?.nome || "";

  // Primeiro configura as opções disponíveis
  // de acordo com o modelo da escola.
  atualizarCamposModeloTurma();

  // Depois escolhe a carga da turma.
  elTurma("turma-aulas-semanais").value =
    String(cargaSemanalTurma(turma));

  elTurma("turma-dia-contraturno").value =
    turmaTemContraturno(turma)
      ? contraturnoTurma(turma)
      : configuracaoEscolarTurmas().contraturno;

  atualizarCamposModeloTurma();

  elTurma("titulo-editor-turma").textContent =
    turma ? "Editar turma" : "Cadastrar turma";

  elTurma("editor-turma").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function fecharEditorTurma() {
  elTurma("editor-turma").hidden = true;
}

// ==========================================
// EXCLUSÃO DE TURMAS
// ==========================================

function excluirTurma(id) {
  const turma = turmas.find(item => item.id === id);

  if (!turma) {
    return;
  }

  const vinculos = obterDistribuicaoTurma(
    turma.nome
  );

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
// BOTÕES
// ==========================================

elTurma("nova-turma").addEventListener(
  "click",
  () => abrirEditorTurma()
);

elTurma("cancelar-turma").addEventListener(
  "click",
  fecharEditorTurma
);

// ==========================================
// SALVAR TURMA
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

    const modelo = aulasRegularesPorDia();

    const aulasSemanais = modelo === 6
      ? 30
      : Number(
          elTurma("turma-aulas-semanais").value
        );

    if (
      !modelosPermitidosTurma().includes(
        aulasSemanais
      )
    ) {
      alert(
        "A carga semanal selecionada é incompatível " +
        "com o modelo desta escola."
      );
      return;
    }

    const diaInformado =
      elTurma("turma-dia-contraturno").value;

    const precisaContraturno =
      modelo === 5 && aulasSemanais === 30;

    const diasValidos = [
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta"
    ];

    if (
      precisaContraturno &&
      !diasValidos.includes(diaInformado)
    ) {
      alert(
        "Selecione um dia válido para o contraturno."
      );
      return;
    }

    const turmaAnterior = turmas.find(
      t => t.id === id
    );

    // Copia os cadastros antes de alterar.
    const professoresAtualizados =
      professores.map(p => ({
        ...p,
        vinculos: (p.vinculos || []).map(v => ({
          ...v
        }))
      }));

    // Atualizar vínculos ao renomear a turma.
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
          "com o novo nome. Escolha outro."
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

    // Guarda explicitamente a organização
    // escolar escolhida.
    const configuracaoTurma = {
      nome,
      aulasSemanais,
      diaContraturno: precisaContraturno
        ? diaInformado
        : null
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

      fecharEditorTurma();
      renderizarProfessores();
      renderizarTurmas();

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
          "Falha ao restaurar:",
          erroRestauracao
        );
      }

      alert("Erro ao salvar a turma.");
      console.error(erro);
    }
  }
);

renderizarTurmas();
