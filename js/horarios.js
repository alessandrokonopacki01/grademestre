
const CHAVE_GRADE = "grademestre_grade_v1";
const CHAVE_REVISAO_GRADE = "grademestre_grade_revisao_v1";

function assinaturaCadastros() {
  const config = JSON.parse(
    localStorage.getItem("grademestre_config") || "{}"
  );
  const turmasSalvas = JSON.parse(
    localStorage.getItem("grademestre_turmas") || "[]"
  );
  const professoresSalvos = JSON.parse(
    localStorage.getItem("grademestre_professores") || "[]"
  );

  return JSON.stringify({
    config,
    turmas: turmasSalvas,
    professores: professoresSalvos
  });
}

function gradeDesatualizada() {
  if (Object.keys(grade).length === 0) return false;
  return localStorage.getItem(CHAVE_REVISAO_GRADE) !==
    assinaturaCadastros();
}

function avisarGradeDesatualizada() {
  renderizarGrade();
}

const DIAS_GRADE = [
  { id: "segunda", nome: "Segunda" },
  { id: "terca", nome: "Terça" },
  { id: "quarta", nome: "Quarta" },
  { id: "quinta", nome: "Quinta" },
  { id: "sexta", nome: "Sexta" }
];

const gh = id => document.getElementById(id);

let grade = carregarGrade();
let selecaoGrade = null;

function carregarGrade() {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_GRADE) || "{}"
    );
    return dados && typeof dados === "object" &&
      !Array.isArray(dados) ? dados : {};
  } catch {
    return {};
  }
}

function salvarGrade(dados) {
  localStorage.setItem(CHAVE_GRADE, JSON.stringify(dados));
  localStorage.setItem(
    CHAVE_REVISAO_GRADE,
    assinaturaCadastros()
  );
  grade = dados;
}

function configGrade() {
  let c = {};
  try {
    c = JSON.parse(
      localStorage.getItem("grademestre_config") || "{}"
    ) || {};
  } catch {}

  return {
    aulas: c.modelo === "5" ? 5 : 6,
    contraturno: c.contraturno || "segunda"
  };
}

function nomeNormalizado(texto) {
  return String(texto || "").trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}


function posicoesTurmaGrade(turma) {
  const config = configGrade();
  const posicoes = [];

  const temCT =
    config.aulas === 5 &&
    cargaSemanalTurma(turma) === 30;

  const diaCT = temCT
    ? contraturnoTurma(turma)
    : null;

  DIAS_GRADE.forEach(dia => {
    for (let n = 1; n <= config.aulas; n++) {
      posicoes.push(`${dia.id}:regular:${n}`);
    }

    if (temCT && dia.id === diaCT) {
      for (let n = 1; n <= 5; n++) {
        posicoes.push(`${dia.id}:contraturno:${n}`);
      }
    }
  });

  return posicoes;
}

function posicoesGrade() {
  const conjunto = new Set();

  turmas.forEach(turma => {
    posicoesTurmaGrade(turma).forEach(pos => {
      conjunto.add(pos);
    });
  });

  return [...conjunto];
}


function chaveCelula(turmaId, posicao) {
  return `${turmaId}|${posicao}`;
}

function dadosCelula(chave) {
  const divisor = chave.indexOf("|");
  return {
    turmaId: chave.slice(0, divisor),
    posicao: chave.slice(divisor + 1)
  };
}

// Uma opção representa uma aula individual ou compartilhada.
function opcoesTurma(turma) {
  const opcoes = [];
  const grupos = new Map();
  const turmaNome = nomeNormalizado(turma.nome);

  professores.forEach(professor => {
    (professor.vinculos || []).forEach(vinculo => {
      if (nomeNormalizado(vinculo.turma) !== turmaNome) return;

      const grupo = nomeNormalizado(vinculo.grupoCompartilhado);
      const membro = { professor, vinculo };

      if (!grupo) {
        opcoes.push({
          professorId: professor.id,
          professoresIds: [professor.id],
          professores: [membro],
          professor: professor.nome,
          disciplina: vinculo.disciplina,
          grupoCompartilhado: ""
        });
        return;
      }

      const chave = `${turmaNome}|${grupo}`;

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          professorId: professor.id,
          professoresIds: [],
          professores: [],
          professor: "",
          disciplina: vinculo.disciplina,
          grupoCompartilhado:
            String(vinculo.grupoCompartilhado).trim()
        });
      }

      const op = grupos.get(chave);
      op.professores.push(membro);
      op.professoresIds.push(professor.id);
    });
  });

  grupos.forEach(op => {
    op.professor = op.professores
      .map(m => m.professor.nome)
      .join(" + ");
    opcoes.push(op);
  });

  return opcoes.sort((a, b) =>
    a.disciplina.localeCompare(b.disciplina, "pt-BR")
  );
}

function validarOpcaoCompartilhada(op) {
  if (!op.grupoCompartilhado) return null;

  if (op.professores.length < 2) {
    return `O grupo ${op.grupoCompartilhado} precisa de dois professores.`;
  }

  const ids = op.professoresIds;

  if (new Set(ids).size !== ids.length) {
    return `Professor repetido no grupo ${op.grupoCompartilhado}.`;
  }

  const referencia = op.professores[0].vinculo;

  for (const membro of op.professores.slice(1)) {
    const v = membro.vinculo;

    if (
      nomeNormalizado(v.disciplina) !==
        nomeNormalizado(referencia.disciplina) ||
      Number(v.aulas) !== Number(referencia.aulas) ||
      (v.geminadas || "livre") !==
        (referencia.geminadas || "livre") ||
      Number(v.paresGeminados || 0) !==
        Number(referencia.paresGeminados || 0)
    ) {
      return `Os participantes de ${op.grupoCompartilhado} devem ter ` +
        `disciplina, carga e geminadas iguais.`;
    }
  }

  return null;
}

function encontrarVinculo(turma, atribuicao) {
  if (!turma || !atribuicao) return null;

  const idsRecebidos = Array.isArray(atribuicao.professoresIds)
    ? atribuicao.professoresIds
    : [atribuicao.professorId];

  if (
    !idsRecebidos.length ||
    new Set(idsRecebidos).size !== idsRecebidos.length
  ) {
    return null;
  }

  const opcoes = opcoesTurma(turma);

  const op = opcoes.find(opcao => {
    if (
      nomeNormalizado(opcao.disciplina) !==
      nomeNormalizado(atribuicao.disciplina)
    ) return false;

    if (opcao.professoresIds.length !== idsRecebidos.length) {
      return false;
    }

    if (!opcao.professoresIds.every(id =>
      idsRecebidos.includes(id)
    )) return false;

    if (
      atribuicao.grupoCompartilhado !== undefined &&
      nomeNormalizado(atribuicao.grupoCompartilhado) !==
        nomeNormalizado(opcao.grupoCompartilhado)
    ) return false;

    return true;
  });

  if (!op || validarOpcaoCompartilhada(op)) return null;
  return op;
}

// Valida a grade inteira.
function validarGrade(dados, verificarCompletude = false) {
  const posicoes = posicoesGrade();
  const ocupacoes = new Set();
  const totais = new Map();
  const diarios = new Map();
  const diariosVinculo = new Map();

  for (const turma of turmas) {
    for (const op of opcoesTurma(turma)) {
      const problema = validarOpcaoCompartilhada(op);
      if (problema) return problema;
    }
  }

  for (const [chave, atribuicao] of Object.entries(dados)) {
    if (!atribuicao) continue;

    if (!chave.includes("|")) {
      return "Existe uma posição de horário inválida.";
    }

    const { turmaId, posicao } = dadosCelula(chave);
    const turma = turmas.find(t => t.id === turmaId);

if (!turma || !posicoesTurmaGrade(turma).includes(posicao)) {
      return "Há uma aula em uma turma ou posição inexistente.";
    }

    const op = encontrarVinculo(turma, atribuicao);

    if (!op) {
      return `Vínculo inválido na turma ${turma.nome}.`;
    }

    const [dia] = posicao.split(":");

    for (const { professor, vinculo } of op.professores) {
      if ((professor.indisponibilidades || [])
          .includes(posicao)) {
        return `${professor.nome} está indisponível em ${posicao}.`;
      }

      const ocupacao = `${professor.id}|${posicao}`;

      if (ocupacoes.has(ocupacao)) {
        return `${professor.nome} foi colocado em duas turmas ` +
          `no mesmo horário.`;
      }

      ocupacoes.add(ocupacao);

      const chaveVinculo =
        `${professor.id}|${nomeNormalizado(turma.nome)}|` +
        nomeNormalizado(vinculo.disciplina);

      const totalAtual =
        (totais.get(chaveVinculo) || 0) + 1;

      totais.set(chaveVinculo, totalAtual);

      if (totalAtual > Number(vinculo.aulas)) {
        return `${professor.nome} ultrapassou as aulas semanais ` +
          `de ${vinculo.disciplina} na turma ${turma.nome}.`;
      }

      const chaveDia = `${professor.id}|${dia}`;
      const totalDia = (diarios.get(chaveDia) || 0) + 1;
      diarios.set(chaveDia, totalDia);

      if (totalDia > Number(professor.maxDia)) {
        return `${professor.nome} ultrapassou o limite de aulas diárias.`;
      }

      const chaveVDia = `${chaveVinculo}|${dia}`;
      const totalVDia =
        (diariosVinculo.get(chaveVDia) || 0) + 1;

      diariosVinculo.set(chaveVDia, totalVDia);

      if (totalVDia > Number(vinculo.maxDia)) {
        return `${professor.nome} ultrapassou o máximo diário de ` +
          `${vinculo.disciplina} na turma ${turma.nome}.`;
      }
    }
  }

  if (verificarCompletude) {
    if (!turmas.length) {
      return "Cadastre pelo menos uma turma.";
    }


    for (const turma of turmas) {
      const posicoesTurma = posicoesTurmaGrade(turma);
      const meta = cargaSemanalTurma(turma);

      const total = posicoesTurma.filter(pos =>
        !!dados[chaveCelula(turma.id, pos)]
      ).length;

      if (total !== meta) {
        return `A turma ${turma.nome} possui ${total}/${meta} aulas.`;
      }

      const distribuicao = obterDistribuicaoTurma(turma.nome);

      if (
        distribuicao.reduce(
          (s, v) => s + Number(v.aulas), 0
        ) !== meta
      ) {
        return `A carga cadastrada de ${turma.nome} não é ${meta}.`;
      }
    }


    // Confere cada participante da aula compartilhada.
    for (const professor of professores) {
      for (const vinculo of professor.vinculos || []) {
        const turma = turmas.find(t =>
          nomeNormalizado(t.nome) ===
          nomeNormalizado(vinculo.turma)
        );

        if (!turma) {
          return `Turma não encontrada: ${vinculo.turma}.`;
        }

        const chaveV =
          `${professor.id}|${nomeNormalizado(turma.nome)}|` +
          nomeNormalizado(vinculo.disciplina);

        if (
          (totais.get(chaveV) || 0) !==
          Number(vinculo.aulas)
        ) {
          return `A distribuição de ${vinculo.disciplina} em ` +
            `${turma.nome} não está completa para ${professor.nome}.`;
        }

        if (vinculo.geminadas !== "obrigatoria") {
          continue;
        }

        const exigidos = Number(
          vinculo.paresGeminados || 0
        );

        if (!exigidos) continue;

        let paresEncontrados = 0;

        for (const dia of DIAS_GRADE) {
          for (const periodo of ["regular", "contraturno"]) {
            const slots = posicoesTurmaGrade(turma).filter(pos =>
              pos.startsWith(`${dia.id}:${periodo}:`)
            );

            let consecutivas = 0;

            for (const posicao of slots) {
              const atribuicao = dados[
                chaveCelula(turma.id, posicao)
              ];

              const corresponde = atribuicao &&
                (
                  Array.isArray(atribuicao.professoresIds)
                    ? atribuicao.professoresIds.includes(professor.id)
                    : atribuicao.professorId === professor.id
                ) &&
                nomeNormalizado(atribuicao.disciplina) ===
                  nomeNormalizado(vinculo.disciplina);

              if (corresponde) {
                consecutivas++;
              } else {
                paresEncontrados += Math.floor(
                  consecutivas / 2
                );
                consecutivas = 0;
              }
            }

            paresEncontrados += Math.floor(
              consecutivas / 2
            );
          }
        }

        if (paresEncontrados < exigidos) {
          return `${vinculo.disciplina} na turma ${turma.nome} ` +
            `precisa de ${exigidos} par(es) geminado(s), ` +
            `mas possui apenas ${paresEncontrados}.`;
        }
      }
    }
  }

  return null;
}

function elementoGrade(tag, texto, classe = "") {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;

  if (classe) {
    elemento.className = classe;
  }

  return elemento;
}

function mensagemGrade(texto, erro = false) {
  const elemento = gh("mensagem-grade");
  elemento.textContent = texto;
  elemento.className = erro ? "erro" : "sucesso";
}

function aplicarAlteracao(novaGrade) {
  if (gradeDesatualizada()) {
    mensagemGrade(
      "Cadastros alterados: gere uma nova grade antes de editar.",
      true
    );
    return false;
  }

  const erro = validarGrade(novaGrade);

  if (erro) {
    mensagemGrade(erro, true);
    return false;
  }

  // Uma grade completa deve continuar completa.
  if (!validarGrade(grade, true)) {
    const erroCompleto = validarGrade(novaGrade, true);

    if (erroCompleto) {
      mensagemGrade(
        "Alteração rejeitada: " + erroCompleto,
        true
      );
      return false;
    }
  }

  try {
    salvarGrade(novaGrade);
    selecaoGrade = null;
    renderizarGrade();
    return true;
  } catch (erroSalvar) {
    mensagemGrade(
      "Não foi possível salvar a grade.",
      true
    );
    console.error(erroSalvar);
    return false;
  }
}

function editarAula(chave) {
  const { turmaId } = dadosCelula(chave);
  const turma = turmas.find(t => t.id === turmaId);

  if (!turma) return;

  const opcoes = opcoesTurma(turma);

  const antiga = document.querySelector(".editor-horario");
  if (antiga) antiga.remove();

  const editor = document.createElement("div");
  editor.className = "editor-horario";

  const grupo = document.createElement("div");

  const label = elementoGrade(
    "label",
    `Selecionar aula — ${turma.nome}`
  );

  const select = document.createElement("select");
  select.setAttribute(
    "aria-label",
    "Disciplina e professor"
  );

  const opcaoVazia = document.createElement("option");
  opcaoVazia.value = "";
  opcaoVazia.textContent = "Horário vazio";
  select.appendChild(opcaoVazia);

  opcoes.forEach((op, indice) => {
    const option = document.createElement("option");
    option.value = String(indice);
    option.textContent =
      `${op.disciplina} — ${op.professor}`;
    select.appendChild(option);
  });

  const atual = grade[chave];

  const indiceAtual = opcoes.findIndex(op =>
    atual &&
    op.professoresIds.length ===
      (
        Array.isArray(atual.professoresIds)
          ? atual.professoresIds.length
          : 1
      ) &&
    op.professoresIds.every(id =>
      (
        Array.isArray(atual.professoresIds)
          ? atual.professoresIds
          : [atual.professorId]
      ).includes(id)
    ) &&
    nomeNormalizado(op.disciplina) ===
      nomeNormalizado(atual.disciplina)
  );

  select.value = indiceAtual >= 0
    ? String(indiceAtual)
    : "";

  grupo.append(label, select);

  const salvar = elementoGrade("button", "Aplicar");
  salvar.className = "btn-primary";
  salvar.type = "button";

  salvar.addEventListener("click", () => {
    const nova = { ...grade };

    if (select.value === "") {
      delete nova[chave];
    } else {
      const op = opcoes[Number(select.value)];

      nova[chave] = {
        professorId: op.professorId,
        professoresIds: [...op.professoresIds],
        disciplina: op.disciplina,
        grupoCompartilhado: op.grupoCompartilhado
      };
    }

    if (aplicarAlteracao(nova)) {
      mensagemGrade("Aula atualizada com sucesso.");
    }
  });

  const cancelar = elementoGrade(
    "button",
    "Cancelar"
  );

  cancelar.className = "btn-secundario";
  cancelar.type = "button";

  cancelar.addEventListener(
    "click",
    () => editor.remove()
  );

  editor.append(grupo, salvar, cancelar);

  gh("grade-escolar").before(editor);

  editor.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function selecionarCelula(chave, elemento) {
  if (!selecaoGrade) {
    selecaoGrade = chave;
    elemento.classList.add("selecionada");

    mensagemGrade(
      "Clique em outra célula para trocar as posições. " +
      "Clique novamente nesta célula para editar."
    );
    return;
  }

  if (selecaoGrade === chave) {
    selecaoGrade = null;

    document.querySelectorAll(".celula-aula")
      .forEach(c =>
        c.classList.remove("selecionada")
      );

    editarAula(chave);
    return;
  }

  const antiga = selecaoGrade;
  const nova = { ...grade };

  const valorA = nova[antiga];
  const valorB = nova[chave];

  if (valorB) {
    nova[antiga] = valorB;
  } else {
    delete nova[antiga];
  }

  if (valorA) {
    nova[chave] = valorA;
  } else {
    delete nova[chave];
  }

  selecaoGrade = null;

  if (aplicarAlteracao(nova)) {
    mensagemGrade("Posições trocadas com sucesso.");
  } else {
    renderizarGrade();
  }
}


function corDisciplinaGrade(disciplina) {
  const nome = nomeNormalizado(disciplina);
  let codigo = 0;

  for (const letra of nome) {
    codigo = (codigo * 31 + letra.charCodeAt(0)) % 360;
  }

  return `hsl(${codigo}, 73%, 85%)`;
}

function criarCelulaGradeConsolidada(turma, posicao) {
  const td = document.createElement("td");
  
  if (!posicoesTurmaGrade(turma).includes(posicao)) {
    td.className = "celula-aula sem-posicao";
    td.textContent = "—";
    return td;
  }

  const chave = chaveCelula(turma.id, posicao);
  const atribuicao = grade[chave];

  td.className = atribuicao
    ? "celula-aula preenchida"
    : "celula-aula vazia";

  if (atribuicao) {
    const referencia = encontrarVinculo(turma, atribuicao);

    if (referencia) {
      td.style.backgroundColor =
        corDisciplinaGrade(atribuicao.disciplina);
      td.style.color = "#222";

      td.append(
        elementoGrade("strong", atribuicao.disciplina),
        elementoGrade("small", referencia.professor)
      );
    } else {
      td.classList.add("invalida");
      td.textContent = "Vínculo inválido";
    }
  } else {
    td.textContent = "+ Adicionar";
  }

  td.tabIndex = 0;
  td.setAttribute("role", "button");
  td.setAttribute("aria-label", `${turma.nome}, ${posicao}`);

  td.addEventListener("click", () => {
    selecionarCelula(chave, td);
  });

  td.addEventListener("keydown", evento => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      selecionarCelula(chave, td);
    }
  });

  return td;
}

function criarTabelaGeral(periodo, dias, quantidade) {
  const tabela = document.createElement("table");
  tabela.className =
    "tabela-horarios tabela-horarios-geral";

  const thead = document.createElement("thead");
  const cabecalho = document.createElement("tr");

  cabecalho.appendChild(elementoGrade("th", "Dia"));
  cabecalho.appendChild(elementoGrade("th", "Aula"));

  turmas.forEach(turma => {
    cabecalho.appendChild(
      elementoGrade("th", turma.nome)
    );
  });

  thead.appendChild(cabecalho);
  tabela.appendChild(thead);

  const tbody = document.createElement("tbody");

  dias.forEach(dia => {
    for (let n = 1; n <= quantidade; n++) {
      const tr = document.createElement("tr");

      if (n === 1) {
        const celulaDia = elementoGrade(
          "th", dia.nome, "dia-grade"
        );
        celulaDia.rowSpan = quantidade;
        celulaDia.scope = "rowgroup";
        tr.appendChild(celulaDia);
      }

      tr.appendChild(
        elementoGrade("th", `${n}ª`, "numero-aula-grade")
      );

      const posicao = `${dia.id}:${periodo}:${n}`;

      turmas.forEach(turma => {
        tr.appendChild(
          criarCelulaGradeConsolidada(turma, posicao)
        );
      });

      if (n === 1) {
        tr.classList.add("inicio-dia-grade");
      }

      tbody.appendChild(tr);
    }
  });

  tabela.appendChild(tbody);

  const wrapper = document.createElement("div");
  wrapper.className =
    "grade-wrapper grade-wrapper-geral";
  wrapper.appendChild(tabela);

  return wrapper;
}


function renderizarGrade() {
  const container = gh("grade-escolar");
  const resumo = gh("resumo-grade");

  container.replaceChildren();
  resumo.replaceChildren();

  const totalNecessario = turmas.reduce(
    (soma, turma) =>
      soma + cargaSemanalTurma(turma),
    0
  );

  const totalPreenchido = turmas.reduce(
    (soma, turma) =>
      soma + posicoesTurmaGrade(turma).filter(pos =>
        !!grade[chaveCelula(turma.id, pos)]
      ).length,
    0
  );

  if (turmas.length) {
    const config = configGrade();

    // TURNO REGULAR
    const principal = document.createElement("article");
    principal.className =
      "bloco-horario bloco-grade-geral";

    principal.appendChild(
      elementoGrade(
        "h3",
        "Grade geral — turno regular"
      )
    );

    principal.appendChild(
      criarTabelaGeral(
        "regular",
        DIAS_GRADE,
        config.aulas
      )
    );

    container.appendChild(principal);

    // CONTRATURNOS INDIVIDUAIS
    if (config.aulas === 5) {
      const diasCT = DIAS_GRADE.filter(dia =>
        turmas.some(turma =>
          cargaSemanalTurma(turma) === 30 &&
          contraturnoTurma(turma) === dia.id
        )
      );

      if (diasCT.length) {
        const tarde = document.createElement("article");
        tarde.className =
          "bloco-horario bloco-grade-geral";

        tarde.appendChild(
          elementoGrade(
            "h3",
            "Grade geral — contraturnos"
          )
        );

        tarde.appendChild(
          criarTabelaGeral(
            "contraturno",
            diasCT,
            5
          )
        );

        container.appendChild(tarde);
      }
    }
  } else {
    container.appendChild(
      elementoGrade(
        "div",
        "Cadastre as turmas antes de montar a grade.",
        "estado-vazio"
      )
    );
  }

  const div = document.createElement("div");
  div.className = "resumo-horarios";

  div.append(
    elementoGrade(
      "span",
      `${turmas.length} turma(s)`
    ),
    elementoGrade(
      "span",
      `${totalPreenchido}/${totalNecessario} aulas`
    ),
    elementoGrade(
      "span",
      `${totalNecessario - totalPreenchido} posições vazias`
    )
  );

  resumo.appendChild(div);

  const erro = validarGrade(grade);

  if (gradeDesatualizada()) {
    mensagemGrade(
      "Grade desatualizada: os cadastros mudaram. " +
      "Gere novamente sem preservar as aulas.",
      true
    );
  } else if (erro) {
    mensagemGrade(
      `Atenção: existem dados inválidos. ${erro}`,
      true
    );
  } else if (turmas.length) {
    const erroFinal = validarGrade(grade, true);

    mensagemGrade(
      erroFinal ||
        `Todas as ${totalNecessario} aulas estão distribuídas!`,
      !!erroFinal
    );
  }
}



gh("atualizar-grade").addEventListener("click", () => {
  selecaoGrade = null;
  renderizarGrade();
});

gh("imprimir-grade").addEventListener("click", () => {
  if (gradeDesatualizada()) {
    mensagemGrade(
      "Grade desatualizada. Gere novamente antes de imprimir.",
      true
    );
    return;
  }

  const erro = validarGrade(grade, true);

  if (erro) {
    mensagemGrade(
      "Impressão bloqueada: " + erro,
      true
    );
    return;
  }

  window.print();
});

gh("limpar-grade").addEventListener("click", () => {
  if (!confirm(
    "Remover todas as aulas posicionadas? " +
    "Os cadastros serão mantidos."
  )) {
    return;
  }

  try {
    salvarGrade({});
    selecaoGrade = null;
    renderizarGrade();

    mensagemGrade("Grade limpa com sucesso.");
  } catch (erro) {
    mensagemGrade(
      "Não foi possível limpar a grade.",
      true
    );
  }
});

renderizarGrade();
