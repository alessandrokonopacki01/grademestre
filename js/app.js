
const paginas = document.querySelectorAll(".pagina");
const botoesMenu = document.querySelectorAll(".nav-item");
const tituloPagina = document.getElementById("titulo-pagina");

const titulos = {
  painel: "Painel geral",
  professores: "Professores",
  turmas: "Turmas",
  horarios: "Grade horária",
  configuracoes: "Configurações"
};

function abrirPagina(id) {
  paginas.forEach(pagina => {
    pagina.classList.toggle("ativa", pagina.id === id);
  });

  botoesMenu.forEach(botao => {
    botao.classList.toggle("ativo", botao.dataset.page === id);
  });

  tituloPagina.textContent = titulos[id];
}

botoesMenu.forEach(botao => {
  botao.addEventListener("click", () => {
    abrirPagina(botao.dataset.page);
  });
});

document.querySelectorAll("[data-ir]").forEach(botao => {
  botao.addEventListener("click", () => {
    abrirPagina(botao.dataset.ir);
  });
});

// CONFIGURAÇÃO DA ESCOLA

const modelo = document.getElementById("modelo");
const areaContraturno = document.getElementById("area-contraturno");
const diaContraturno = document.getElementById("dia-contraturno");
const nomeEscola = document.getElementById("nome-escola");
const resumoModelo = document.getElementById("resumo-modelo");
const mensagem = document.getElementById("mensagem-config");

function atualizarModelo() {
  const cincoAulas = modelo.value === "5";

  areaContraturno.hidden = !cincoAulas;

  resumoModelo.textContent = cincoAulas
    ? "5 dias × 5 aulas + 5 no contraturno"
    : "5 dias × 6 aulas";

  mensagem.textContent = "";
}

modelo.addEventListener("change", atualizarModelo);

function carregarConfiguracoes() {
  try {
    const salvas = JSON.parse(
      localStorage.getItem("grademestre_config")
    );

    if (salvas) {
      nomeEscola.value = salvas.nome || "";
      modelo.value = salvas.modelo === "5" ? "5" : "6";
      diaContraturno.value = salvas.contraturno || "segunda";
    }
  } catch (erro) {
    console.error("Erro ao carregar configurações:", erro);
  }

  atualizarModelo();
}

document.getElementById("form-config").addEventListener(
  "submit",
  function(evento) {
    evento.preventDefault();

    const dados = {
      nome: nomeEscola.value.trim(),
      modelo: modelo.value,
      contraturno: modelo.value === "5"
        ? diaContraturno.value
        : null,
      aulasSemanais: 30
    };

    try {
      localStorage.setItem(
        "grademestre_config",
        JSON.stringify(dados)
      );


mensagem.textContent =
  "Configurações salvas. Confira se a grade precisa " +
  "ser gerada novamente.";

if (typeof avisarGradeDesatualizada === "function") {
  avisarGradeDesatualizada();
}

    } catch (erro) {
      mensagem.textContent = "Não foi possível salvar.";
      console.error(erro);
    }
  }
);

carregarConfiguracoes();
