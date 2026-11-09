
/*
 * GradeMestre — Interface unificada V2
 *
 * Mantém os componentes antigos carregados,
 * mas oculta as opções V1 da interface principal.
 *
 * Carregar depois de gerador_grade_v2.js.
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const paginaGrade = $("horarios");
  const geradorV2 = $("painel-gerador-v2");
  const paginaConfig = $("configuracoes");

  if (!paginaGrade || !geradorV2 || !paginaConfig) {
    console.error(
      "GradeMestre: carregue a interface unificada " +
      "depois dos módulos V2."
    );
    return;
  }

  // ==========================================
  // ESTILO DA INTERFACE V2
  // ==========================================

  const css = document.createElement("style");

  css.textContent = `
    [data-gm-legado-oculto="true"] {
      display: none !important;
    }

    #turma-aulas-semanais,
    label[for="turma-aulas-semanais"],
    #turma-dia-contraturno,
    label[for="turma-dia-contraturno"] {
      display: none !important;
    }

    #painel-gerador-v2,
    #painel-agendas-v2,
    #painel-professores-v2,
    #gm-config-v2 {
      border-radius: 14px;
    }

    #v2-resultado-grade section {
      margin-top: 20px;
    }

    #v2-resultado-grade .grade-wrapper {
      overflow-x: auto;
      border: 1px solid #d4d7de;
      border-radius: 9px;
      margin-top: 10px;
    }

    #v2-resultado-grade table {
      border-collapse: collapse;
      min-width: 720px;
      width: 100%;
      table-layout: fixed;
    }

    #v2-resultado-grade th,
    #v2-resultado-grade td {
      border: 1px solid #d4d7de;
      padding: 8px 5px;
      text-align: center;
      vertical-align: middle;
      overflow-wrap: anywhere;
      font-size: 12px;
    }

    #v2-resultado-grade thead th {
      background: #262b37;
      color: white;
      font-size: 13px;
    }

    #v2-resultado-grade tbody tr:nth-child(even) {
      background: #f4f6fa;
    }

    #v2-resultado-grade tbody tr:hover {
      background: #fffaeb;
    }

    #v2-resultado-grade td strong {
      display: block;
      font-size: 12px;
    }

    #v2-resultado-grade th:nth-child(1),
    #v2-resultado-grade th:nth-child(2) {
      width: 83px;
    }

    #gm-config-v2 .gm-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin: 10px 0 18px;
    }

    #gm-config-v2 input[type="text"] {
      flex: 1;
      min-width: 190px;
      max-width: 480px;
    }
  `;

  document.head.appendChild(css);

  // ==========================================
  // FUNÇÕES AUXILIARES
  // ==========================================

  function ocultar(elemento) {
    if (!elemento) return;

    elemento.dataset.gmLegadoOculto = "true";
    elemento.setAttribute("aria-hidden", "true");
  }

  function lerJSON(chave) {
    try {
      return JSON.parse(
        localStorage.getItem(chave) || "{}"
      );
    } catch {
      return {};
    }
  }

  // ==========================================
  // 1. OCULTAR GRADE V1
  // ==========================================

  const gradeAntiga = $("grade-escolar");

  const painelAntigo =
    gradeAntiga?.closest(".painel-info");

  if (
    painelAntigo &&
    painelAntigo !== geradorV2
  ) {
    ocultar(painelAntigo);
  }

  // Atualizar apresentação da V2.

  const tituloGrade =
    geradorV2.querySelector("h2");

  if (tituloGrade) {
    tituloGrade.textContent =
      "Gerador de horários";
  }

  const descricaoGrade =
    geradorV2.querySelector("h2 + p");

  if (descricaoGrade) {
    descricaoGrade.textContent =
      "Gere, confira e imprima os horários " +
      "de todos os turnos da escola.";
  }

  // ==========================================
  // 2. SUBSTITUIR CONFIGURAÇÃO VISUAL V1
  // ==========================================

  const formularioAntigo = $("form-config");

  const painelConfigAntigo =
    formularioAntigo?.closest(".painel-info");

  ocultar(painelConfigAntigo);

  const novaConfig =
    document.createElement("section");

  novaConfig.id = "gm-config-v2";
  novaConfig.className = "painel-info";

  novaConfig.innerHTML = `
    <h2>Escola e horários dos turnos</h2>

    <p>
      Configure o nome e os horários reais
      da escola. As quantidades de aulas
      são definidas individualmente
      na agenda de cada turma.
    </p>

    <label for="gm-nome-escola-v2">
      Nome da escola
    </label>

    <div class="gm-linha">
      <input
        id="gm-nome-escola-v2"
        type="text"
        maxlength="120"
        placeholder="Nome da escola"
      >

      <button
        id="gm-salvar-nome-v2"
        type="button"
        class="btn-primary"
      >
        Salvar nome
      </button>
    </div>

    <p id="gm-nome-status-v2" role="status"></p>
  `;

  paginaConfig.appendChild(novaConfig);

  const configV1 = lerJSON(
    "grademestre_config"
  );

  const escolaV2 = lerJSON(
    "grademestre_escola_v2"
  );

  $("gm-nome-escola-v2").value =
    escolaV2.nome || configV1.nome || "";

  $("gm-salvar-nome-v2").addEventListener(
    "click",
    () => {
      try {
        const nome =
          $("gm-nome-escola-v2").value.trim();

        if (!nome) {
          throw new Error(
            "Informe o nome da escola."
          );
        }

        const antiga = lerJSON(
          "grademestre_config"
        );

        const nova = lerJSON(
          "grademestre_escola_v2"
        );

        antiga.nome = nome;
        nova.nome = nome;

        localStorage.setItem(
          "grademestre_config",
          JSON.stringify(antiga)
        );

        localStorage.setItem(
          "grademestre_escola_v2",
          JSON.stringify(nova)
        );

        if ($("nome-escola")) {
          $("nome-escola").value = nome;
        }

        $("gm-nome-status-v2").textContent =
          "Nome da escola salvo.";

      } catch (erro) {
        $("gm-nome-status-v2").textContent =
          erro.message;
      }
    }
  );

  // ==========================================
  // 3. HORÁRIOS REAIS EM CONFIGURAÇÕES
  // ==========================================

  const detalhesHorarios = $(
    "v2-detalhes-horarios"
  );

  if (detalhesHorarios) {
    // Movemos o mesmo elemento.
    // Seus eventos continuam funcionando.
    novaConfig.appendChild(detalhesHorarios);

    const tituloHorarios =
      detalhesHorarios.querySelector(
        "summary strong"
      );

    if (tituloHorarios) {
      tituloHorarios.textContent =
        "Horários de manhã, tarde e noite";
    }
  }

  // ==========================================
  // 4. INDISPONIBILIDADES DOS PROFESSORES
  // ==========================================

  const gradeBloqueiosV1 = $(
    "grade-indisponibilidade"
  );

  ocultar(gradeBloqueiosV1);

  const tituloBloqueiosV1 = [
    ...document.querySelectorAll(
      "#form-professor h3"
    )
  ].find(
    el => el.textContent.trim().toLowerCase()
      === "indisponibilidade"
  );

  if (tituloBloqueiosV1) {
    ocultar(tituloBloqueiosV1);

    if (
      tituloBloqueiosV1
        .nextElementSibling?.tagName === "P"
    ) {
      ocultar(
        tituloBloqueiosV1.nextElementSibling
      );
    }
  }

  const bloqueiosV2 = $(
    "painel-professores-v2"
  );

  const tituloBloqueiosV2 =
    bloqueiosV2?.querySelector("h2");

  if (tituloBloqueiosV2) {
    tituloBloqueiosV2.textContent =
      "Indisponibilidades por turno";
  }

  // ==========================================
  // 5. SIMPLIFICAR O CADASTRO DE TURMAS
  // ==========================================

  const agendaV2 = $("painel-agendas-v2");

  const tituloAgenda =
    agendaV2?.querySelector("h2");

  if (tituloAgenda) {
    tituloAgenda.textContent =
      "Agenda semanal das turmas";
  }

  const orientacaoAgenda =
    agendaV2?.querySelector("h2 + p");

  if (orientacaoAgenda) {
    orientacaoAgenda.textContent =
      "Escolha o turno regular e distribua " +
      "as aulas por dia. Os horários de início " +
      "e fim ficam na aba Configurações.";
  }

  if (agendaV2) {
    const irConfiguracoes =
      document.createElement("button");

    irConfiguracoes.type = "button";
    irConfiguracoes.className =
      "btn-secundario";

    irConfiguracoes.textContent =
      "Configurar horários da escola";

    irConfiguracoes.addEventListener(
      "click",
      () => {
        document.querySelector(
          '.nav-item[data-page="configuracoes"]'
        )?.click();
      }
    );

    tituloAgenda?.after(irConfiguracoes);
  }

  // Esconder instrução ultrapassada sobre V1.

  const textoAntigo = [
    ...(agendaV2?.querySelectorAll("small") || [])
  ].find(
    el => el.textContent.includes("V1")
  );

  if (textoAntigo) {
    ocultar(
      textoAntigo.closest("p") || textoAntigo
    );
  }

  // ==========================================
  // 6. ACESSO TEMPORÁRIO DE MANUTENÇÃO
  // ==========================================

  const manutencao =
    document.createElement("details");

  manutencao.style.marginTop = "18px";

  manutencao.innerHTML = `
    <summary>
      Manutenção: mostrar ferramentas antigas
    </summary>

    <p>
      Estas ferramentas utilizam a V1
      e não editam a grade V2.
    </p>

    <label>
      <input
        type="checkbox"
        id="gm-mostrar-v1"
      >
      Exibir painéis V1
    </label>
  `;

  novaConfig.appendChild(manutencao);

  $("gm-mostrar-v1").addEventListener(
    "change",
    evento => {
      const elementos = [
        painelAntigo,
        painelConfigAntigo,
        gradeBloqueiosV1,
        tituloBloqueiosV1,
        tituloBloqueiosV1?.nextElementSibling
      ];

      elementos.forEach(item => {
        if (!item) return;

        if (evento.target.checked) {
          item.removeAttribute(
            "data-gm-legado-oculto"
          );

          item.removeAttribute(
            "aria-hidden"
          );
        } else {
          ocultar(item);
        }
      });
    }
  );

  // ==========================================
  // 7. RESUMO GERAL COM CARGAS REAIS
  // ==========================================

  const cards = document.querySelectorAll(
    "#painel .cards .card"
  );

  const cardCarga = cards[2];

  function atualizarResumo() {
    if (!cardCarga) return;

    let turmasSalvas = [];

    try {
      turmasSalvas = JSON.parse(
        localStorage.getItem(
          "grademestre_turmas"
        ) || "[]"
      );
    } catch {
      turmasSalvas = [];
    }

    const total = turmasSalvas.reduce(
      (soma, turma) => {
        if (!turma.agenda) return soma;

        return soma + Object.values(
          turma.agenda
        ).reduce(
          (parcial, turnos) =>
            parcial + Object.values(
              turnos
            ).reduce(
              (acumulado, ordens) =>
                acumulado + ordens.length,
              0
            ),
          0
        );
      },
      0
    );

    cardCarga.querySelector("p").textContent =
      "Aulas semanais previstas";

    cardCarga.querySelector(
      "strong"
    ).textContent = String(total);
  }

  atualizarResumo();

  document.querySelector(
    '[data-page="painel"]'
  )?.addEventListener(
    "click",
    atualizarResumo
  );

  const listaTurmas = $("lista-turmas");

  if (listaTurmas) {
    new MutationObserver(
      atualizarResumo
    ).observe(
      listaTurmas,
      { childList: true }
    );
  }

  // ==========================================
  // 8. MOSTRAR BLOQUEIOS DA V2 NOS CARTÕES
  // ==========================================

  function atualizarContagemBloqueiosV2() {
    const mapa = lerJSON(
      "grademestre_bloqueios_v2"
    );

    let docentes = [];

    try {
      docentes = JSON.parse(
        localStorage.getItem(
          "grademestre_professores"
        ) || "[]"
      );
    } catch {
      docentes = [];
    }

    document.querySelectorAll(
      "#lista-professores .professor-card"
    ).forEach(card => {
      const nome =
        card.querySelector("h3")?.textContent;

      const docente = docentes.find(
        p => p.nome === nome
      );

      const resumo = [
        ...card.querySelectorAll("p")
      ].find(
        p =>
          /horários bloqueados|bloqueios V2/
            .test(p.textContent)
      );

      if (!docente || !resumo) return;

      const bloqueios =
        mapa[docente.id]?.bloqueios;

      resumo.textContent =
        Array.isArray(bloqueios)
          ? `${bloqueios.length} bloqueios V2`
          : "Bloqueios V2 ainda não configurados";
    });
  }

  atualizarContagemBloqueiosV2();

  $("p2-salvar")?.addEventListener(
    "click",
    atualizarContagemBloqueiosV2
  );

  const listaProfessores = $(
    "lista-professores"
  );

  if (listaProfessores) {
    new MutationObserver(
      atualizarContagemBloqueiosV2
    ).observe(
      listaProfessores,
      { childList: true }
    );
  }

  console.info(
    "GradeMestre: interface V2 ativa."
  );
})();
