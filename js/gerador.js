
const botaoGerar = document.getElementById("gerar-grade");
const statusGerador = document.getElementById("status-gerador");
const URL_API = "https://grademestre.onrender.com";

const painelDiagnostico = document.getElementById(
  "painel-diagnostico"
);

const listaDiagnosticos = document.getElementById(
  "lista-diagnosticos"
);

function limparDiagnostico() {
  painelDiagnostico.hidden = true;
  listaDiagnosticos.replaceChildren();
}

function mostrarDiagnostico(problemas) {
  limparDiagnostico();

  if (!Array.isArray(problemas) || !problemas.length) {
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

    card.append(titulo, etiqueta, detalhe, lista);
    listaDiagnosticos.appendChild(card);
  });

  painelDiagnostico.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


botaoGerar.addEventListener("click", async () => {
  const endereco = URL_API;

  if (!turmas.length || !professores.length) {
    statusGerador.textContent =
      "Cadastre turmas e professores antes de gerar.";
    return;
  }

  for (const turma of turmas) {
    const situacao = calcularSituacaoTurma(turma);

    if (!situacao.completa) {
      statusGerador.textContent =
        `A turma ${turma.nome} possui ` +
        `${situacao.total}/30 aulas cadastradas.`;
      return;
    }
  }

  const preservar = document.getElementById(
    "preservar-aulas"
  ).checked;

  if (preservar && gradeDesatualizada()) {
  statusGerador.textContent =
    "Os cadastros foram alterados. " +
    "Desmarque 'Preservar aulas já preenchidas' " +
    "para gerar novamente.";

  return;
}

  if (preservar) {
    const erroAtual = validarGrade(grade);

    if (erroAtual) {
      statusGerador.textContent =
        "A grade atual possui conflitos: " + erroAtual;
      return;
    }
  }

  const dados = {
    config: {
      modelo: String(configGrade().aulas),
      contraturno: configGrade().contraturno
    },
    turmas,
    professores,
    fixadas: preservar ? { ...grade } : {}
  };

 limparDiagnostico();
  botaoGerar.disabled = true;
  botaoGerar.textContent = "Calculando...";
  statusGerador.textContent =
    "Procurando uma distribuição válida...";

  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 90000);

  try {
    const resposta = await fetch(`${endereco}/gerar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dados),
      signal: controlador.signal
    });

    let resultado;

    try {
      resultado = await resposta.json();
    } catch {
      throw new Error("A API não retornou JSON válido.");
    }

    if (!resposta.ok) {
      throw new Error(
        typeof resultado.detail === "string"
          ? resultado.detail
          : `Erro HTTP ${resposta.status}`
      );
    }

    
if (!resultado.sucesso) {
  statusGerador.textContent =
    resultado.mensagem || "Não foi possível gerar.";

  if (resultado.situacao === "inviavel") {
    mostrarDiagnostico(resultado.diagnostico);
  } else if (resultado.situacao === "limite_ou_erro") {
    statusGerador.textContent +=
      " Tente novamente ou revise as restrições. " +
      "A impossibilidade não foi comprovada.";
  }

  return;
}


    const erro = validarGrade(resultado.grade, true);

    if (erro) {
      throw new Error(
        "O resultado recebido não passou na validação: " + erro
      );
    }

    // Só substituímos os horários depois da validação.
    salvarGrade(resultado.grade);
    selecaoGrade = null;
    renderizarGrade();

    statusGerador.textContent =
      `Horários gerados: ${resultado.totalAulas} aulas ` +
      `distribuídas sem conflitos.`;

  } catch (erro) {
    statusGerador.textContent = erro.name === "AbortError"
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
