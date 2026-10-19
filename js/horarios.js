
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
  localStorage.setItem(
    CHAVE_GRADE,
    JSON.stringify(dados)
  );

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

function posicoesGrade() {
  const config = configGrade();
  const posicoes = [];

  DIAS_GRADE.forEach(dia => {
    for (let n = 1; n <= config.aulas; n++) {
      posicoes.push(`${dia.id}:regular:${n}`);
    }

    if (config.aulas === 5 &&
        dia.id === config.contraturno) {
      for (let n = 1; n <= 5; n++) {
        posicoes.push(`${dia.id}:contraturno:${n}`);
      }
    }
  });

  return posicoes;
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

function encontrarVinculo(turma, atribuicao) {
  if (!turma || !atribuicao) return null;

  const professor = professores.find(
    p => p.id === atribuicao.professorId
  );

  if (!professor) return null;

  const vinculo = professor.vinculos.find(v =>
    nomeNormalizado(v.turma) === nomeNormalizado(turma.nome) &&
    nomeNormalizado(v.disciplina) ===
      nomeNormalizado(atribuicao.disciplina)
  );

  if (!vinculo) return null;

  return { professor, vinculo };
}

function opcoesTurma(turma) {
  const resultado = [];

  professores.forEach(professor => {
    professor.vinculos.forEach(v => {
      if (nomeNormalizado(v.turma) ===
          nomeNormalizado(turma.nome)) {
        resultado.push({
          professorId: professor.id,
          professor: professor.nome,
          disciplina: v.disciplina
        });
      }
    });
  });

  return resultado.sort((a, b) =>
    a.disciplina.localeCompare(b.disciplina, "pt-BR")
  );
}

// Valida a grade inteira, não apenas a célula editada.
function validarGrade(dados, verificarCompletude = false) {
  const config = configGrade();
  const posicoes = new Set(posicoesGrade());
  const ocupacoes = new Map();
  const totais = new Map();
  const diarios = new Map();
  const diariosVinculo = new Map();

  for (const [chave, atribuicao] of Object.entries(dados)) {
    if (!atribuicao) continue;

    if (!chave.includes("|")) {
      return "Existe uma posição de horário inválida.";
    }

    const { turmaId, posicao } = dadosCelula(chave);
    const turma = turmas.find(t => t.id === turmaId);

    if (!turma || !posicoes.has(posicao)) {
      return "Há uma aula em uma turma ou posição inexistente.";
    }

    const referencia = encontrarVinculo(turma, atribuicao);

    if (!referencia) {
      return `Vínculo inválido na turma ${turma.nome}.`;
    }

    const { professor, vinculo } = referencia;
    const [dia] = posicao.split(":");

    if ((professor.indisponibilidades || [])
        .includes(posicao)) {
      return `${professor.nome} está indisponível em ${posicao}.`;
    }

    const ocupacao = `${professor.id}|${posicao}`;

    if (ocupacoes.has(ocupacao)) {
      return `${professor.nome} foi colocado em duas turmas ` +
        `no mesmo horário.`;
    }

    ocupacoes.set(ocupacao, true);

    const chaveVinculo =
      `${professor.id}|${nomeNormalizado(turma.nome)}|` +
      nomeNormalizado(vinculo.disciplina);

    const totalAtual = (totais.get(chaveVinculo) || 0) + 1;
    totais.set(chaveVinculo, totalAtual);

    if (totalAtual > Number(vinculo.aulas)) {
      return `${professor.nome} ultrapassou as aulas semanais ` +
        `de ${vinculo.disciplina} na turma ${turma.nome}.`;
    }

    const chaveDia = `${professor.id}|${dia}`;
    const totalDia = (diarios.get(chaveDia) || 0) + 1;
    diarios.set(chaveDia, totalDia);

    if (totalDia > Number(professor.maxDia)) {
      return `${professor.nome} ultrapassou o limite ` +
        `de aulas diárias.`;
    }

    const chaveVDia = `${chaveVinculo}|${dia}`;
    const totalVDia = (diariosVinculo.get(chaveVDia) || 0) + 1;
    diariosVinculo.set(chaveVDia, totalVDia);

    if (totalVDia > Number(vinculo.maxDia)) {
      return `${professor.nome} ultrapassou o máximo diário ` +
        `de ${vinculo.disciplina} na turma ${turma.nome}.`;
    }
  }

  if (verificarCompletude) {
    for (const turma of turmas) {
      const total = posicoesGrade().filter(pos =>
        !!dados[chaveCelula(turma.id, pos)]
      ).length;

      if (total !== 30) {
        return `A turma ${turma.nome} possui ${total}/30 aulas.`;
      }

      const distribuicao = obterDistribuicaoTurma(turma.nome);

      if (distribuicao.reduce((s, v) => s + v.aulas, 0) !== 30) {
        return `A carga cadastrada de ${turma.nome} não é 30.`;
      }

      for (const v of distribuicao) {
        const chaveV =
          `${v.professorId}|${nomeNormalizado(turma.nome)}|` +
          nomeNormalizado(v.disciplina);

        if ((totais.get(chaveV) || 0) !== Number(v.aulas)) {
          return `A distribuição de ${v.disciplina} em ` +
            `${turma.nome} não está completa.`;
        }
      }
    }
  }

  // Uma turma vazia também precisa ser reconhecida como
  // uma grade ainda não concluída.
  if (verificarCompletude && turmas.length === 0) {
    return "Cadastre pelo menos uma turma.";
  }

  // VALIDAÇÃO DAS AULAS GEMINADAS NA GRADE COMPLETA

  if (verificarCompletude) {
    for (const professor of professores) {
      for (const vinculo of professor.vinculos) {
        if (vinculo.geminadas !== "obrigatoria") {
          continue;
        }

        const exigidos = Number(vinculo.paresGeminados || 0);
        if (exigidos === 0) continue;

        const turma = turmas.find(t =>
          nomeNormalizado(t.nome) ===
          nomeNormalizado(vinculo.turma)
        );

        if (!turma) {
          return `Turma não encontrada: ${vinculo.turma}.`;
        }

        let paresEncontrados = 0;

        for (const dia of DIAS_GRADE) {
          for (const periodo of ["regular", "contraturno"]) {
            const slots = posicoesGrade().filter(pos =>
              pos.startsWith(`${dia.id}:${periodo}:`)
            );

            let consecutivas = 0;

            for (const posicao of slots) {
              const atribuicao = dados[
                chaveCelula(turma.id, posicao)
              ];

              const corresponde = atribuicao &&
                atribuicao.professorId === professor.id &&
                nomeNormalizado(atribuicao.disciplina) ===
                nomeNormalizado(vinculo.disciplina);

              if (corresponde) {
                consecutivas++;
              } else {
                paresEncontrados += Math.floor(consecutivas / 2);
                consecutivas = 0;
              }
            }

            paresEncontrados += Math.floor(consecutivas / 2);
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
  if (classe) elemento.className = classe;
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

  // Uma grade completa deve continuar completa
  // após qualquer alteração manual.
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
    "label", `Selecionar aula — ${turma.nome}`
  );
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Disciplina e professor");

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
    op.professorId === atual.professorId &&
    nomeNormalizado(op.disciplina) ===
      nomeNormalizado(atual.disciplina)
  );

  select.value = indiceAtual >= 0 ?
    String(indiceAtual) : "";

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
        disciplina: op.disciplina
      };
    }

    if (aplicarAlteracao(nova)) {
      mensagemGrade("Aula atualizada com sucesso.");
    }
  });

  const cancelar = elementoGrade("button", "Cancelar");
  cancelar.className = "btn-secundario";
  cancelar.type = "button";
  cancelar.addEventListener("click", () => editor.remove());

  editor.append(grupo, salvar, cancelar);

  gh("grade-escolar").before(editor);
  editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      .forEach(c => c.classList.remove("selecionada"));
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

function criarTabelaHorario(turma, periodo, quantidade) {
  const tabela = document.createElement("table");
  tabela.className = "tabela-horarios";

  const thead = document.createElement("thead");
  const cabecalho = document.createElement("tr");

  ["Aula", ...DIAS_GRADE.map(d => d.nome)].forEach(nome => {
    cabecalho.appendChild(elementoGrade("th", nome));
  });

  thead.appendChild(cabecalho);
  tabela.appendChild(thead);

  const tbody = document.createElement("tbody");
  const config = configGrade();

  for (let aula = 1; aula <= quantidade; aula++) {
    const tr = document.createElement("tr");
    tr.appendChild(
      elementoGrade("th", `${aula}ª aula`)
    );

    DIAS_GRADE.forEach(dia => {
      const td = document.createElement("td");

      const posicao = `${dia.id}:${periodo}:${aula}`;
      const existe = periodo === "regular" ||
        dia.id === config.contraturno;

      if (!existe) {
        td.className = "celula-aula sem-posicao";
        td.textContent = "—";
      } else {
        const chave = chaveCelula(turma.id, posicao);
        const atribuicao = grade[chave];

        td.className = atribuicao ?
          "celula-aula preenchida" :
          "celula-aula vazia";

        if (atribuicao) {
          const referencia = encontrarVinculo(turma, atribuicao);

          if (referencia) {
            td.append(
              elementoGrade("strong", atribuicao.disciplina),
              elementoGrade(
                "small", referencia.professor.nome
              )
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
        td.setAttribute(
          "aria-label",
          `${turma.nome}, ${dia.nome}, ` +
          `${periodo}, aula ${aula}`
        );

        td.addEventListener("click", () => {
          selecionarCelula(chave, td);
        });

        td.addEventListener("keydown", evento => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            selecionarCelula(chave, td);
          }
        });
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  tabela.appendChild(tbody);

  const wrapper = document.createElement("div");
  wrapper.className = "grade-wrapper";
  wrapper.appendChild(tabela);

  return wrapper;
}

function renderizarGrade() {
  const container = gh("grade-escolar");
  const resumo = gh("resumo-grade");
  container.replaceChildren();
  resumo.replaceChildren();

  const posicoes = posicoesGrade();

  let totalPreenchido = 0;

  turmas.forEach(turma => {
    totalPreenchido += posicoes.filter(pos =>
      !!grade[chaveCelula(turma.id, pos)]
    ).length;

    const bloco = document.createElement("article");
    bloco.className = "bloco-horario";

    bloco.appendChild(elementoGrade("h3", turma.nome));

    const config = configGrade();

    bloco.appendChild(
      criarTabelaHorario(turma, "regular", config.aulas)
    );

    if (config.aulas === 5) {
      const dia = DIAS_GRADE.find(
        d => d.id === config.contraturno
      );

      bloco.appendChild(
        elementoGrade(
          "div",
          `Contraturno — ${dia?.nome || config.contraturno}`,
          "titulo-contraturno"
        )
      );

      bloco.appendChild(
        criarTabelaHorario(turma, "contraturno", 5)
      );
    }

    container.appendChild(bloco);
  });

  const totalNecessario = turmas.length * 30;

  const div = document.createElement("div");
  div.className = "resumo-horarios";

  div.append(
    elementoGrade(
      "span", `${turmas.length} turma(s)`
    ),
    elementoGrade(
      "span", `${totalPreenchido}/${totalNecessario} aulas`
    ),
    elementoGrade(
      "span",
      `${totalNecessario - totalPreenchido} posições vazias`
    )
  );

  resumo.appendChild(div);

  if (!turmas.length) {
    container.appendChild(
      elementoGrade(
        "div",
        "Cadastre as turmas antes de montar a grade.",
        "estado-vazio"
      )
    );
  }

const erro = validarGrade(grade);

if (gradeDesatualizada()) {
  mensagemGrade(
    "Grade desatualizada: os cadastros mudaram. " +
    "Gere novamente sem preservar as aulas.",
    true
  );
} else if (erro) {
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
  )) return;

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
