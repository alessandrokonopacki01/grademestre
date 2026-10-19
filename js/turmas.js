
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
}

function normalizarNome(nome) {
  return nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function elementoTurma(tag, texto, classe = "") {
  const e = document.createElement(tag);
  e.textContent = texto;
  if (classe) e.className = classe;
  return e;
}

// Consulta os vínculos já cadastrados pelos professores.
function obterDistribuicaoTurma(nomeTurma) {
  const resultado = [];
  const chave = normalizarNome(nomeTurma);

  professores.forEach(professor => {
    (professor.vinculos || []).forEach(vinculo => {
      if (normalizarNome(vinculo.turma) !== chave) return;

      resultado.push({
        professorId: professor.id,
        professor: professor.nome,
        disciplina: vinculo.disciplina,
        aulas: Number(vinculo.aulas),
        maxDia: Number(vinculo.maxDia)
      });
    });
  });

  return resultado;
}

function calcularSituacaoTurma(turma) {
  const distribuicao = obterDistribuicaoTurma(turma.nome);

  const total = distribuicao.reduce(
    (soma, item) => soma + item.aulas, 0
  );

  return {
    distribuicao,
    total,
    faltantes: Math.max(0, 30 - total),
    excedentes: Math.max(0, total - 30),
    completa: total === 30
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

function renderizarResumoTurmas() {
  const resumo = elTurma("resumo-turmas");
  resumo.replaceChildren();

  const completas = turmas.filter(
    turma => calcularSituacaoTurma(turma).completa
  ).length;

  resumo.append(
    criarIndicador(turmas.length, "Turmas cadastradas"),
    criarIndicador(completas, "Turmas com 30 aulas"),
    criarIndicador(
      turmas.length - completas,
      "Turmas pendentes"
    )
  );

  elTurma("total-turmas").textContent = turmas.length;
}

function criarTabelaDistribuicao(distribuicao) {
  const wrapper = document.createElement("div");
  wrapper.className = "turma-detalhes";

  const tabela = document.createElement("table");
  tabela.className = "tabela-turma";

  const cabecalho = document.createElement("thead");
  const trCabecalho = document.createElement("tr");

  ["Disciplina", "Professor", "Aulas/semana", "Máx./dia"]
    .forEach(titulo => {
      trCabecalho.appendChild(elementoTurma("th", titulo));
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
      linha.appendChild(elementoTurma("td", valor));
    });

    corpo.appendChild(linha);
  });

  tabela.appendChild(corpo);
  wrapper.appendChild(tabela);

  return wrapper;
}

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

    topo.appendChild(elementoTurma("h3", turma.nome));
    topo.appendChild(
      elementoTurma(
        "strong",
        `${situacao.total} / 30 aulas`
      )
    );

    card.appendChild(topo);

    const barra = document.createElement("div");
    barra.className = "progresso-turma";

    const preenchimento = document.createElement("div");
    preenchimento.style.width =
      `${Math.min(100, situacao.total / 30 * 100)}%`;

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
      textoSituacao = "Carga horária completa: 30 aulas";
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

    if (situacao.distribuicao.length) {
      card.appendChild(
        criarTabelaDistribuicao(situacao.distribuicao)
      );
    } else {
      card.appendChild(
        elementoTurma(
          "p",
          "Nenhuma disciplina vinculada. Acesse Professores para adicionar."
        )
      );
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes-form";

    const editar = document.createElement("button");
    editar.className = "btn-secundario";
    editar.textContent = "Renomear";
    editar.addEventListener("click", () => abrirEditorTurma(turma));

    const excluir = document.createElement("button");
    excluir.className = "btn-remover";
    excluir.textContent = "Excluir";

    excluir.addEventListener("click", () => excluirTurma(turma.id));

    acoes.append(editar, excluir);
    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

function abrirEditorTurma(turma = null) {
  elTurma("editor-turma").hidden = false;
  elTurma("form-turma").reset();

  elTurma("turma-id").value = turma?.id || "";
  elTurma("turma-nome").value = turma?.nome || "";

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

function excluirTurma(id) {
  const turma = turmas.find(item => item.id === id);
  if (!turma) return;

  const vinculos = obterDistribuicaoTurma(turma.nome);

  if (vinculos.length) {
    alert(
      "Esta turma possui professores vinculados. " +
      "Remova os vínculos no cadastro dos professores antes de excluí-la."
    );
    return;
  }

  if (!confirm(`Excluir a turma ${turma.nome}?`)) return;

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

elTurma("nova-turma").addEventListener("click", () => {
  abrirEditorTurma();
});

elTurma("cancelar-turma").addEventListener(
  "click",
  fecharEditorTurma
);

elTurma("form-turma").addEventListener("submit", evento => {
  evento.preventDefault();

  const id = elTurma("turma-id").value;
  const nome = elTurma("turma-nome").value.trim()
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

  const turmaAnterior = turmas.find(t => t.id === id);

  // A mudança de nome atualiza os vínculos dos professores.
  let professoresAtualizados = professores.map(p => ({
    ...p,
    vinculos: (p.vinculos || []).map(v => ({ ...v }))
  }));

  if (turmaAnterior &&
      normalizarNome(turmaAnterior.nome) !== normalizarNome(nome)) {

    // Impede unir, por acidente, vínculos de uma turma
    // cadastrada com outra identificação.
    const vinculosNoDestino = professoresAtualizados.some(p =>
      p.vinculos.some(v =>
        normalizarNome(v.turma) === normalizarNome(nome)
      )
    );

    if (vinculosNoDestino) {
      alert(
        "Já existem vínculos de professores com o novo nome. " +
        "Escolha outro nome para evitar conflitos."
      );
      return;
    }

    professoresAtualizados.forEach(p => {
      p.vinculos.forEach(v => {
        if (normalizarNome(v.turma) ===
            normalizarNome(turmaAnterior.nome)) {
          v.turma = nome;
        }
      });
    });
  }

  const novasTurmas = id
    ? turmas.map(t => t.id === id ? { ...t, nome } : t)
    : [...turmas, { id: crypto.randomUUID(), nome }];

  try {
    // Armazena primeiro as cópias novas.
    // Em caso de falha, tenta restaurar o estado anterior.
    const backupTurmas = localStorage.getItem(CHAVE_TURMAS);
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
    } catch (erro) {
      if (backupTurmas === null) {
        localStorage.removeItem(CHAVE_TURMAS);
      } else {
        localStorage.setItem(CHAVE_TURMAS, backupTurmas);
      }

      if (backupProfessores === null) {
        localStorage.removeItem(CHAVE_PROFESSORES);
      } else {
        localStorage.setItem(
          CHAVE_PROFESSORES,
          backupProfessores
        );
      }

      throw erro;
    }

    turmas = novasTurmas;
    professores = professoresAtualizados;

    renderizarProfessores();
    renderizarTurmas();
    fecharEditorTurma();

  } catch (erro) {
    alert("Erro ao salvar a turma.");
    console.error(erro);
  }
});

renderizarTurmas();
