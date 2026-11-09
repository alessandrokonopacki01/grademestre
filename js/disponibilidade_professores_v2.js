
/*
 * GradeMestre V2
 * Indisponibilidades por turno físico.
 *
 * Mantém intactos os professores e bloqueios V1.
 * Carregar depois de agenda_turmas_v2.js.
 */

(() => {
  "use strict";

  const CHAVE = "grademestre_bloqueios_v2";

  const DIAS = [
    ["segunda", "Segunda"],
    ["terca", "Terça"],
    ["quarta", "Quarta"],
    ["quinta", "Quinta"],
    ["sexta", "Sexta"]
  ];

  const TURNOS = [
    ["manha", "Manhã"],
    ["tarde", "Tarde"],
    ["noite", "Noite"]
  ];

  const $ = id => document.getElementById(id);

  const el = (tag, texto) => {
    const elemento = document.createElement(tag);
    if (texto !== undefined) {
      elemento.textContent = texto;
    }
    return elemento;
  };

  function lerJSON(chave, padrao) {
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return padrao;
    return JSON.parse(bruto);
  }

  function professoresSalvos() {
    const lista = lerJSON(
      "grademestre_professores",
      []
    );

    if (!Array.isArray(lista)) {
      throw new Error("Cadastro de professores inválido.");
    }

    return lista;
  }

  function perfilAtual() {
    const escola = lerJSON(
      "grademestre_escola_v2",
      null
    );

    const perfil = escola?.perfisHorario?.padrao;

    if (!perfil) {
      throw new Error(
        "Configure e salve os horários da escola " +
        "em Turmas → Calendário V2."
      );
    }

    for (const [turno] of TURNOS) {
      if (!Array.isArray(perfil[turno])) {
        throw new Error(
          `Turno ${turno} não configurado.`
        );
      }
    }

    return perfil;
  }

  function assinaturaPerfil(perfil) {
    return JSON.stringify(
      TURNOS.map(([turno]) => [
        turno,
        perfil[turno]
      ])
    );
  }

  function mapaSalvo() {
    const mapa = lerJSON(CHAVE, {});

    if (
      !mapa ||
      typeof mapa !== "object" ||
      Array.isArray(mapa)
    ) {
      throw new Error(
        "Dados de disponibilidade V2 inválidos."
      );
    }

    return mapa;
  }

  function todosSlots(perfil) {
    const ids = new Set();

    for (const [dia] of DIAS) {
      for (const [turno] of TURNOS) {
        perfil[turno].forEach((_, indice) => {
          ids.add(
            `${dia}:padrao:${turno}:${indice + 1}`
          );
        });
      }
    }

    return ids;
  }

  // ========================================
  // CRIAR PAINEL EXPERIMENTAL
  // ========================================

  const pagina = $("professores");

  if (!pagina || !window.GradeMestreV2) {
    console.error(
      "Carregue este arquivo depois de " +
      "agenda_turmas_v2.js."
    );
    return;
  }

  const painel = el("section");
  painel.id = "painel-professores-v2";
  painel.className = "painel-info";
  painel.style.marginTop = "20px";

  painel.innerHTML = `
    <h2>Indisponibilidades dos professores — V2</h2>

    <p>
      Marque os horários em que o professor
      <strong>não pode lecionar</strong>.
      Manhã, tarde e noite são configurados separadamente.
    </p>

    <p>
      Os bloqueios da V1 permanecem intactos.
      A conversão é manual para evitar
      atribuir restrições ao turno errado.
    </p>

    <label for="p2-professor">Professor</label>
    <select id="p2-professor"></select>

    <div id="p2-editor" hidden>
      <p id="p2-legado"></p>

      <details>
        <summary>
          <strong>
            Converter indisponibilidades antigas (V1)
          </strong>
        </summary>

        <p>
          Escolha a qual turno correspondem
          os bloqueios antigos do professor.
        </p>

        <label for="p2-regular">
          Bloqueios de aulas regulares V1
        </label>

        <select id="p2-regular">
          <option value="">Escolha o turno</option>
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="noite">Noite</option>
        </select>

        <label for="p2-ct">
          Bloqueios de contraturno V1
        </label>

        <select id="p2-ct">
          <option value="">Escolha o turno</option>
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="noite">Noite</option>
        </select>

        <button
          type="button"
          class="btn-secundario"
          id="p2-converter"
        >
          Aplicar conversão à prévia
        </button>
      </details>

      <div id="p2-grades"></div>

      <p id="p2-contagem"></p>

      <button
        type="button"
        class="btn-primary"
        id="p2-salvar"
      >
        Salvar bloqueios V2
      </button>
    </div>

    <p id="p2-status" role="status"></p>
  `;

  pagina.appendChild(painel);

  let professorId = "";
  let selecionados = new Set();
  let alterado = false;

  function status(mensagem, erro = false) {
    $("p2-status").textContent = mensagem;
    $("p2-status").style.color =
      erro ? "#b91c1c" : "#15803d";
  }

  function professorAtual() {
    return professoresSalvos().find(
      p => p.id === professorId
    );
  }

  function atualizarContagem() {
    $("p2-contagem").textContent =
      `${selecionados.size} horários bloqueados na V2` +
      (
        alterado
          ? " — alterações não salvas"
          : " — salvo ou sem alteração"
      );
  }

  // ========================================
  // DESENHAR GRADE DE DISPONIBILIDADE
  // ========================================

  function desenharGrade() {
    const destino = $("p2-grades");
    destino.replaceChildren();

    const perfil = perfilAtual();

    for (const [turno, nomeTurno] of TURNOS) {
      const secao = el("section");

      const titulo = el(
        "h3",
        `${nomeTurno} — ${perfil[turno].length} aulas`
      );

      titulo.style.marginTop = "16px";
      secao.appendChild(titulo);

      if (!perfil[turno].length) {
        secao.appendChild(
          el(
            "p",
            "Nenhum horário cadastrado neste turno."
          )
        );

        destino.appendChild(secao);
        continue;
      }

      const wrapper = el("div");
      wrapper.className = "grade-wrapper";

      const tabela = el("table");
      tabela.className = "tabela-disponibilidade";

      const thead = el("thead");
      const cabecalho = el("tr");

      [
        "Aula / horário",
        ...DIAS.map(([, nome]) => nome)
      ].forEach(texto => {
        cabecalho.appendChild(el("th", texto));
      });

      thead.appendChild(cabecalho);
      tabela.appendChild(thead);

      const corpo = el("tbody");

      perfil[turno].forEach((aula, indice) => {
        const ordem = indice + 1;

        const linha = el("tr");

        linha.appendChild(
          el(
            "th",
            `${ordem}ª — ${aula.inicio}–${aula.fim}`
          )
        );

        for (const [dia, nomeDia] of DIAS) {
          const id =
            `${dia}:padrao:${turno}:${ordem}`;

          const td = el("td");

          const checkbox = el("input");
          checkbox.type = "checkbox";
          checkbox.value = id;

          checkbox.checked =
            selecionados.has(id);

          checkbox.setAttribute(
            "aria-label",
            `${nomeDia}, ${nomeTurno}, aula ${ordem}`
          );

          checkbox.addEventListener(
            "change",
            () => {
              if (checkbox.checked) {
                selecionados.add(id);
              } else {
                selecionados.delete(id);
              }

              alterado = true;
              atualizarContagem();
            }
          );

          td.appendChild(checkbox);
          linha.appendChild(td);
        }

        corpo.appendChild(linha);
      });

      tabela.appendChild(corpo);
      wrapper.appendChild(tabela);
      secao.appendChild(wrapper);
      destino.appendChild(secao);
    }

    atualizarContagem();
  }

  // ========================================
  // CARREGAR UM PROFESSOR
  // ========================================

  function carregarProfessor() {
    const professor = professorAtual();

    $("p2-editor").hidden = !professor;
    if (!professor) return;

    const perfil = perfilAtual();
    const assinatura = assinaturaPerfil(perfil);

    const registro = mapaSalvo()[professor.id];

    if (registro) {
      if (!Array.isArray(registro.bloqueios)) {
        throw new Error(
          `Bloqueios V2 inválidos de ${professor.nome}.`
        );
      }

      selecionados = new Set(
        registro.bloqueios
      );

      if (registro.assinatura !== assinatura) {
        status(
          "Os horários da escola mudaram. " +
          "Revise os bloqueios e salve novamente.",
          true
        );
      } else {
        status(
          `Bloqueios V2 carregados: ${professor.nome}.`
        );
      }
    } else {
      selecionados = new Set();

      status(
        (professor.indisponibilidades || []).length
          ? "Este professor ainda tem bloqueios V1. " +
            "Converta ou revise antes de gerar V2."
          : "Sem bloqueios antigos. Marque as " +
            "indisponibilidades necessárias."
      );
    }

    $("p2-legado").textContent =
      `${
        (professor.indisponibilidades || []).length
      } bloqueio(s) no cadastro V1; ` +
      `${
        registro?.bloqueios?.length || 0
      } bloqueio(s) salvos na V2.`;

    alterado = false;
    desenharGrade();
  }

  function atualizarSelecao() {
    const seletor = $("p2-professor");
    const anterior = professorId;

    seletor.replaceChildren();

    seletor.appendChild(
      new Option(
        "Selecione um professor",
        ""
      )
    );

    professoresSalvos().forEach(p => {
      seletor.appendChild(
        new Option(p.nome, p.id)
      );
    });

    if (
      professoresSalvos().some(
        p => p.id === anterior
      )
    ) {
      seletor.value = anterior;
    }

    professorId = seletor.value;
    carregarProfessor();
  }

  $("p2-professor").addEventListener(
    "change",
    evento => {
      const proximo = evento.target.value;

      if (
        alterado &&
        !confirm(
          "Descartar alterações V2 não salvas?"
        )
      ) {
        evento.target.value = professorId;
        return;
      }

      professorId = proximo;

      try {
        carregarProfessor();
      } catch (erro) {
        status(erro.message, true);
      }
    }
  );

  // ========================================
  // CONVERTER BLOQUEIOS V1
  // ========================================

  $("p2-converter").addEventListener(
    "click",
    () => {
      try {
        const professor = professorAtual();

        if (!professor) {
          throw new Error(
            "Selecione um professor."
          );
        }

        const antigos =
          professor.indisponibilidades || [];

        const reg = $("p2-regular").value;
        const ct = $("p2-ct").value;

        const perfil = perfilAtual();

        const novos = new Set();
        const ignorados = [];

        for (const item of antigos) {
          const partes =
            /^([^:]+):(regular|contraturno):(\d+)$/
              .exec(item);

          if (
            !partes ||
            !DIAS.some(
              ([dia]) => dia === partes[1]
            )
          ) {
            ignorados.push(item);
            continue;
          }

          const [, dia, tipo, numero] = partes;

          const turno =
            tipo === "regular" ? reg : ct;

          if (!turno) {
            throw new Error(
              `Escolha o turno dos bloqueios ${tipo} V1.`
            );
          }

          const ordem = Number(numero);

          if (
            ordem < 1 ||
            ordem > perfil[turno].length
          ) {
            ignorados.push(item);
            continue;
          }

          novos.add(
            `${dia}:padrao:${turno}:${ordem}`
          );
        }

        if (
          ignorados.length &&
          !confirm(
            `${ignorados.length} bloqueio(s) ` +
            "antigos não cabem no perfil atual " +
            "ou têm formato inválido. " +
            "Eles NÃO serão importados para a V2, " +
            "mas continuarão guardados na V1. " +
            "Continuar?\n\n" +
            ignorados.join("\n")
          )
        ) {
          return;
        }

        // Preserva bloqueios V2 já marcados.
        novos.forEach(
          id => selecionados.add(id)
        );

        alterado = true;
        desenharGrade();

        status(
          `Conversão aplicada à prévia: ` +
          `${novos.size} bloqueio(s). ` +
          "Salve para confirmar."
        );

      } catch (erro) {
        status(erro.message, true);
      }
    }
  );

  // ========================================
  // SALVAR BLOQUEIOS V2
  // ========================================

  $("p2-salvar").addEventListener(
    "click",
    () => {
      try {
        const professor = professorAtual();

        if (!professor) {
          throw new Error(
            "Selecione um professor."
          );
        }

        const perfil = perfilAtual();
        const validos = todosSlots(perfil);

        const invalidos = [
          ...selecionados
        ].filter(
          id => !validos.has(id)
        );

        if (invalidos.length) {
          throw new Error(
            "Há bloqueios sem horário " +
            "correspondente: " +
            invalidos.join(", ")
          );
        }

        if (
          !mapaSalvo()[professor.id] &&
          (professor.indisponibilidades || [])
            .length > 0 &&
          selecionados.size === 0 &&
          !confirm(
            `O professor ${professor.nome} ` +
            "possui bloqueios V1, mas ficará " +
            "sem nenhum bloqueio V2. Confirmar?"
          )
        ) {
          return;
        }

        const mapa = mapaSalvo();

        mapa[professor.id] = {
          bloqueios: [
            ...selecionados
          ].sort(),

          assinatura:
            assinaturaPerfil(perfil)
        };

        localStorage.setItem(
          CHAVE,
          JSON.stringify(mapa)
        );

        alterado = false;
        atualizarContagem();

        status(
          `Indisponibilidades V2 de ` +
          `${professor.nome} salvas com sucesso.`
        );

        if (
          typeof avisarGradeDesatualizada
          === "function"
        ) {
          avisarGradeDesatualizada();
        }

      } catch (erro) {
        status(erro.message, true);
      }
    }
  );

  // ========================================
  // PREPARAR DADOS PARA O SOLVER V2
  // ========================================

  function prepararProfessores(lista) {
    const perfil = perfilAtual();

    const assinatura =
      assinaturaPerfil(perfil);

    const validos = todosSlots(perfil);
    const mapa = mapaSalvo();

    return lista.map(professor => {
      const registro = mapa[professor.id];

      if (!registro) {
        if (
          (professor.indisponibilidades || [])
            .length
        ) {
          throw new Error(
            `${professor.nome} tem bloqueios V1 ` +
            "ainda não convertidos para a V2."
          );
        }

        return {
          ...professor,
          indisponibilidades: []
        };
      }

      if (registro.assinatura !== assinatura) {
        throw new Error(
          `Revise e salve os bloqueios de ` +
          `${professor.nome}: o perfil de ` +
          "horários mudou."
        );
      }

      if (
        !Array.isArray(registro.bloqueios) ||
        registro.bloqueios.some(
          id => !validos.has(id)
        )
      ) {
        throw new Error(
          `Bloqueios V2 inválidos de ` +
          `${professor.nome}.`
        );
      }

      return {
        ...professor,
        indisponibilidades: [
          ...registro.bloqueios
        ]
      };
    });
  }

  window.GradeMestreBloqueiosV2 = {
    prepararProfessores,
    atualizarProfessores: atualizarSelecao
  };

  try {
    atualizarSelecao();
  } catch (erro) {
    status(erro.message, true);
  }

  // Atualiza a lista após cadastros V1.
  const lista = $("lista-professores");

  if (
    lista &&
    typeof MutationObserver === "function"
  ) {
    new MutationObserver(() => {
      const ids = professoresSalvos()
        .map(p => `${p.id}:${p.nome}`)
        .join("|");

      if (
        ids !== $("p2-professor").dataset.ids
      ) {
        $("p2-professor").dataset.ids = ids;

        if (alterado) return;

        atualizarSelecao();
      }
    }).observe(
      lista,
      { childList: true }
    );
  }
})();
