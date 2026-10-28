
const CHAVE_PROFESSORES = "grademestre_professores";

const DIAS = [
  { id: "segunda", nome: "Segunda" },
  { id: "terca", nome: "Terça" },
  { id: "quarta", nome: "Quarta" },
  { id: "quinta", nome: "Quinta" },
  { id: "sexta", nome: "Sexta" }
];

const $p = id => document.getElementById(id);

let professores = carregarProfessores();

function carregarProfessores() {
  try {
    const dados = JSON.parse(
      localStorage.getItem(CHAVE_PROFESSORES) || "[]"
    );
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarProfessores() {
  localStorage.setItem(
    CHAVE_PROFESSORES,
    JSON.stringify(professores)
  );
  if (typeof avisarGradeDesatualizada === "function") {
  avisarGradeDesatualizada();
}
}

function obterModeloEscolar() {
  let config = {};

  try {
    config = JSON.parse(
      localStorage.getItem("grademestre_config") || "{}"
    ) || {};
  } catch {}

  return {
    aulas: config.modelo === "5" ? 5 : 6,
    contraturno: config.contraturno || "segunda"
  };
}

function horariosDoDia(dia, config) {
  const slots = [];

  for (let aula = 1; aula <= config.aulas; aula++) {
    slots.push(`${dia}:regular:${aula}`);
  }

  if (config.aulas === 5 && dia === config.contraturno) {
    for (let aula = 1; aula <= 5; aula++) {
      slots.push(`${dia}:contraturno:${aula}`);
    }
  }

  return slots;
}

function criarGradeIndisponibilidade(marcados = []) {
  const config = obterModeloEscolar();
  const container = $p("grade-indisponibilidade");
  container.replaceChildren();

  const tabela = document.createElement("table");
  tabela.className = "tabela-disponibilidade";

  const cabecalho = document.createElement("thead");
  const linhaCabecalho = document.createElement("tr");

  ["Aula", ...DIAS.map(d => d.nome)].forEach(nome => {
    const th = document.createElement("th");
    th.textContent = nome;
    linhaCabecalho.appendChild(th);
  });

  cabecalho.appendChild(linhaCabecalho);
  tabela.appendChild(cabecalho);

  const corpo = document.createElement("tbody");

  const linhas = [];

  for (let aula = 1; aula <= config.aulas; aula++) {
    linhas.push({
      periodo: "regular",
      aula,
      nome: `${aula}ª aula`
    });
  }

  if (config.aulas === 5) {
    for (let aula = 1; aula <= 5; aula++) {
      linhas.push({
        periodo: "contraturno",
        aula,
        nome: `CT ${aula}ª`
      });
    }
  }

  linhas.forEach(item => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = item.nome;
    tr.appendChild(th);

    DIAS.forEach(dia => {
      const td = document.createElement("td");

      if (item.periodo === "contraturno") {
        td.classList.add("contraturno");
      }

      const existe = item.periodo === "regular" ||
        dia.id === config.contraturno;

      if (existe) {
        const id = `${dia.id}:${item.periodo}:${item.aula}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "bloqueio-horario";
        checkbox.value = id;
        checkbox.checked = marcados.includes(id);
        checkbox.setAttribute(
          "aria-label",
          `Indisponível: ${dia.nome}, ${item.nome}`
        );

        td.appendChild(checkbox);
      } else {
        td.classList.add("sem-aula");
        td.textContent = "—";
      }

      tr.appendChild(td);
    });

    corpo.appendChild(tr);
  });

  tabela.appendChild(corpo);
  container.appendChild(tabela);
}


function criarCampo(rotulo, tipo, classe, valor, min, max) {
  const grupo = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = rotulo;

  const input = document.createElement("input");
  input.type = tipo;
  input.className = classe;
  input.value = valor;

  // Somente o grupo compartilhado é opcional.
  input.required = classe !== "vinculo-compartilhado";

  if (tipo === "number") {
    input.min = min;
    input.max = max;
    input.step = "1";
  }

  grupo.append(label, input);
  return grupo;
}


function adicionarVinculo(dados = {}) {
  const linha = document.createElement("div");
  linha.className = "vinculo";

  linha.appendChild(
    criarCampo(
      "Turma", "text", "vinculo-turma",
      dados.turma || "", null, null
    )
  );

  linha.appendChild(
    criarCampo(
      "Disciplina", "text", "vinculo-disciplina",
      dados.disciplina || "", null, null
    )
  );

  linha.appendChild(
    criarCampo(
      "Aulas/semana", "number", "vinculo-aulas",
      dados.aulas ?? 2, 1, 30
    )
  );

  linha.appendChild(
    criarCampo(
      "Máx./dia", "number", "vinculo-max",
      dados.maxDia ?? 2, 1, 10
    )
  );

  // CONFIGURAÇÃO DE AULAS GEMINADAS

  const configuracaoGeminadas = document.createElement("div");

  const labelGeminadas = document.createElement("label");
  labelGeminadas.textContent = "Aulas geminadas";

  const selectGeminadas = document.createElement("select");
  selectGeminadas.className = "vinculo-geminadas";

  [
    ["obrigatoria", "Obrigatória"],
    ["livre", "Livre"]
  ].forEach(([valor, titulo]) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = titulo;
    selectGeminadas.appendChild(option);
  });

  const cargaInicial = Number(dados.aulas ?? 2);

  // Nos novos cadastros, a exigência é obrigatória
  // por padrão para disciplinas com 2 ou mais aulas.

const cadastroNovo =
  !Object.prototype.hasOwnProperty.call(dados, "turma");

const modoInicial = dados.geminadas ||
  (cadastroNovo && cargaInicial >= 2
    ? "obrigatoria"
    : "livre");


  selectGeminadas.value = modoInicial;

  configuracaoGeminadas.append(
    labelGeminadas,
    selectGeminadas
  );

  linha.appendChild(configuracaoGeminadas);

  const grupoPares = criarCampo(
    "Pares por semana",
    "number",
    "vinculo-pares",
    dados.paresGeminados ??
      (modoInicial === "obrigatoria" ? 1 : 0),
    0,
    Math.floor(cargaInicial / 2)
  );

  linha.appendChild(grupoPares);
  
  // DOCÊNCIA COMPARTILHADA

  const grupoCompartilhado = criarCampo(
    "Grupo compartilhado (opcional)",
    "text",
    "vinculo-compartilhado",
    dados.grupoCompartilhado || "",
    null,
    null
  );

  linha.appendChild(grupoCompartilhado);


  const campoAulas = linha.querySelector(".vinculo-aulas");
  const campoPares = grupoPares.querySelector("input");

  function atualizarGeminadas() {
    const aulas = Number(campoAulas.value) || 0;
    const maxPares = Math.floor(aulas / 2);
    const obrigatoria = selectGeminadas.value === "obrigatoria";

    campoPares.max = maxPares;
    campoPares.disabled = !obrigatoria;

    if (!obrigatoria) {
      campoPares.value = 0;
    } else if (Number(campoPares.value) === 0 && maxPares > 0) {
      campoPares.value = 1;
    }

    if (Number(campoPares.value) > maxPares) {
      campoPares.value = maxPares;
    }
  }

  selectGeminadas.addEventListener(
    "change", atualizarGeminadas
  );

  campoAulas.addEventListener(
    "change", atualizarGeminadas
  );

  atualizarGeminadas();

  const remover = document.createElement("button");
  remover.type = "button";
  remover.className = "btn-remover";
  remover.textContent = "Remover";
  remover.addEventListener("click", () => linha.remove());

  linha.appendChild(remover);
  $p("vinculos-professor").appendChild(linha);
}

function abrirEditorProfessor(professor = null) {
  $p("editor-professor").hidden = false;
  $p("form-professor").reset();
  $p("vinculos-professor").replaceChildren();
  $p("mensagem-professor").textContent = "";

  $p("professor-id").value = professor?.id || "";
  $p("professor-nome").value = professor?.nome || "";

  const config = obterModeloEscolar();
  const maiorDia = config.aulas === 5 ? 10 : 6;

  $p("professor-max-dia").max = maiorDia;
  $p("professor-max-dia").value =
    professor?.maxDia ?? config.aulas;

  $p("titulo-editor-professor").textContent = professor
    ? "Editar professor"
    : "Cadastrar professor";

  if (professor?.vinculos?.length) {
    professor.vinculos.forEach(adicionarVinculo);
  } else {
    adicionarVinculo();
  }

  criarGradeIndisponibilidade(
    professor?.indisponibilidades || []
  );

  $p("editor-professor").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function fecharEditorProfessor() {
  $p("editor-professor").hidden = true;
}


function coletarVinculos() {
  return [...document.querySelectorAll(".vinculo")].map(linha => {
    const geminadas = linha.querySelector(
      ".vinculo-geminadas"
    ).value;

    return {
      turma: linha.querySelector(".vinculo-turma").value.trim(),
      disciplina: linha.querySelector(".vinculo-disciplina").value.trim(),
      aulas: Number(linha.querySelector(".vinculo-aulas").value),
      maxDia: Number(linha.querySelector(".vinculo-max").value),
      grupoCompartilhado: linha
  .querySelector(".vinculo-compartilhado")
  .value.trim(),
      geminadas,
      paresGeminados: geminadas === "obrigatoria"
        ? Number(linha.querySelector(".vinculo-pares").value)
        : 0
    };
  });
}

function validarVinculos(vinculos, maxDia) {
  if (!vinculos.length) {
    return "Adicione pelo menos uma disciplina/turma.";
  }

  const identificadores = new Set();

  for (const v of vinculos) {
    if (!v.turma || !v.disciplina) {
      return "Preencha a turma e a disciplina em todos os vínculos.";
    }

    if (!Number.isInteger(v.aulas) ||
        v.aulas < 1 || v.aulas > 30) {
      return "A carga semanal deve estar entre 1 e 30 aulas.";
    }

    if (!Number.isInteger(v.maxDia) ||
        v.maxDia < 1 || v.maxDia > maxDia) {
      return "Revise o limite diário de cada disciplina.";
    }

    if (!["livre", "obrigatoria"].includes(v.geminadas)) {
      return "Configuração de aulas geminadas inválida.";
    }

    if (!Number.isInteger(v.paresGeminados) ||
        v.paresGeminados < 0 ||
        2 * v.paresGeminados > v.aulas) {
      return "A quantidade de pares geminados é incompatível " +
        "com as aulas semanais.";
    }

    if (v.geminadas === "obrigatoria" &&
        v.paresGeminados < 1) {
      return "Informe pelo menos um par obrigatório ou " +
        "selecione a modalidade Livre.";
    }

if (v.geminadas === "obrigatoria" &&
    (v.maxDia < 2 || maxDia < 2)) {
      return "Aulas geminadas obrigatórias exigem " +
        "um limite diário de pelo menos 2 aulas.";
    }

    const chave = `${v.turma.toLowerCase()}|${v.disciplina.toLowerCase()}`;

    if (identificadores.has(chave)) {
      return "Há uma turma e disciplina repetidas neste cadastro.";
    }

    identificadores.add(chave);
  }

  return null;
}

function validarCapacidade(professor) {
  const config = obterModeloEscolar();

  const horariosLivres = DIAS.map(dia => {
    const horarios = horariosDoDia(dia.id, config);
    return horarios.filter(
      slot => !professor.indisponibilidades.includes(slot)
    ).length;
  });

  const capacidade = horariosLivres.reduce(
    (soma, livres) => soma + Math.min(livres, professor.maxDia),
    0
  );

  const carga = professor.vinculos.reduce(
    (soma, v) => soma + v.aulas,
    0
  );

  if (carga > capacidade) {
    return `O professor tem ${carga} aulas, mas apenas ` +
      `${capacidade} posições disponíveis considerando ` +
      `os bloqueios e o limite diário.`;
  }

  for (const v of professor.vinculos) {
    const capacidadeVinculo = horariosLivres.reduce(
      (soma, livres) =>
        soma + Math.min(livres, v.maxDia, professor.maxDia),
      0
    );

    if (v.aulas > capacidadeVinculo) {
      return `A carga de ${v.disciplina} na turma ${v.turma} ` +
        `não cabe no limite diário informado.`;
    }
  }

  return null;
}

function textoElemento(tag, texto) {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;
  return elemento;
}

function renderizarProfessores() {
  const container = $p("lista-professores");
  container.replaceChildren();

  $p("total-professores").textContent = professores.length;

  if (!professores.length) {
    const vazio = document.createElement("div");
    vazio.className = "estado-vazio";
    vazio.textContent = "Nenhum professor cadastrado.";
    container.appendChild(vazio);
    return;
  }

  professores.forEach(professor => {
    const card = document.createElement("article");
    card.className = "professor-card";
    card.appendChild(textoElemento("h3", professor.nome));

    const carga = professor.vinculos.reduce(
      (soma, v) => soma + v.aulas, 0
    );

    card.appendChild(
      textoElemento(
        "p",
        `${carga} aulas semanais • Máximo de ${professor.maxDia} por dia`
      )
    );

    
professor.vinculos.forEach(v => {
  const detalheCompartilhado = v.grupoCompartilhado
  ? ` • Compartilhada: ${v.grupoCompartilhado}`
  : "";
  const detalheGeminadas = v.geminadas === "obrigatoria"
    ? ` • ${v.paresGeminados} par(es) obrigatório(s)`
    : " • Aulas livres";

  card.appendChild(
    textoElemento(
      "p",
      `${v.turma} — ${v.disciplina}: ${v.aulas} aulas/semana ` +
      `(máx. ${v.maxDia}/dia)` +
      detalheGeminadas + detalheCompartilhado
    )
  );
});


    card.appendChild(
      textoElemento(
        "p",
        `${professor.indisponibilidades.length} horários bloqueados`
      )
    );

    const acoes = document.createElement("div");
    acoes.className = "acoes-form";

    const editar = document.createElement("button");
    editar.className = "btn-secundario";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirEditorProfessor(professor));

    const excluir = document.createElement("button");
    excluir.className = "btn-remover";
    excluir.textContent = "Excluir";
    excluir.addEventListener("click", () => {
      if (!confirm(`Excluir o professor ${professor.nome}?`)) return;

      professores = professores.filter(p => p.id !== professor.id);
      salvarProfessores();
fecharEditorProfessor();
renderizarProfessores();
renderizarTurmas();
    });

    acoes.append(editar, excluir);
    card.appendChild(acoes);
    container.appendChild(card);
  });
}

$p("novo-professor").addEventListener("click", () => {
  abrirEditorProfessor();
});

$p("adicionar-vinculo").addEventListener("click", () => {
  adicionarVinculo();
});

$p("cancelar-professor").addEventListener("click", fecharEditorProfessor);

$p("form-professor").addEventListener("submit", evento => {
  evento.preventDefault();

  const config = obterModeloEscolar();
  const limite = config.aulas === 5 ? 10 : 6;
  const idAtual = $p("professor-id").value;
  const maxDia = Number($p("professor-max-dia").value);
  const vinculos = coletarVinculos();

  if (!Number.isInteger(maxDia) || maxDia < 1 || maxDia > limite) {
    alert(`O limite diário deve estar entre 1 e ${limite}.`);
    return;
  }

  const erroVinculos = validarVinculos(vinculos, maxDia);

  if (erroVinculos) {
    alert(erroVinculos);
    return;
  }

  const indisponibilidades = [
    ...document.querySelectorAll(".bloqueio-horario:checked")
  ].map(checkbox => checkbox.value);

  const professor = {
    id: idAtual || crypto.randomUUID(),
    nome: $p("professor-nome").value.trim(),
    maxDia,
    vinculos,
    indisponibilidades
  };

  if (!professor.nome) {
    alert("Informe o nome do professor.");
    return;
  }

  const erroCapacidade = validarCapacidade(professor);

  if (erroCapacidade) {
    alert(erroCapacidade);
    return;
  }

  const nomeRepetido = professores.some(p =>
    p.id !== professor.id &&
    p.nome.toLowerCase() === professor.nome.toLowerCase()
  );

  if (nomeRepetido) {
    alert("Já existe um professor com esse nome.");
    return;
  }

  if (idAtual) {
    professores = professores.map(p =>
      p.id === idAtual ? professor : p
    );
  } else {
    professores.push(professor);
  }

  try {
   salvarProfessores();
fecharEditorProfessor();
renderizarProfessores();
renderizarTurmas();
  } catch (erro) {
    alert("Erro ao salvar os dados neste navegador.");
    console.error(erro);
  }
});

renderizarProfessores();
