
/*
 * GradeMestre V2
 * Geração, visualização e edição manual.
 *
 * Preserva a grade V1.
 * Carregar depois dos módulos de turmas
 * e indisponibilidades V2.
 */

(() => {
  "use strict";

  const API = "https://grademestre.onrender.com";
  const CHAVE = "grademestre_grade_v2";

  const DIAS = [
    "segunda", "terca", "quarta", "quinta", "sexta"
  ];

  const TURNOS = ["manha", "tarde", "noite"];

  const NOMES = {
    manha: "Manhã",
    tarde: "Tarde",
    noite: "Noite"
  };

  const $ = id => document.getElementById(id);

  const novo = (tag, texto, classe) => {
    const elemento = document.createElement(tag);

    if (texto !== undefined) {
      elemento.textContent = texto;
    }

    if (classe) elemento.className = classe;

    return elemento;
  };

  const ler = (chave, padrao) => {
    const valor = localStorage.getItem(chave);

    return valor === null
      ? padrao
      : JSON.parse(valor);
  };

  const normal = valor =>
    String(valor || "")
      .trim()
      .toLocaleLowerCase("pt-BR");

  function minuto(hora) {
    const [h, m] = String(hora)
      .split(":")
      .map(Number);

    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      h < 0 || h > 23 ||
      m < 0 || m > 59
    ) {
      throw new Error(`Horário inválido: ${hora}`);
    }

    return h * 60 + m;
  }

  // ==========================================
  // CRIAR PAINEL V2
  // ==========================================

  const pagina = $("horarios");

  if (!pagina) {
    console.error(
      "GradeMestre V2: seção #horarios não encontrada."
    );
    return;
  }

  const painel = novo(
    "section",
    undefined,
    "painel-info"
  );

  painel.id = "painel-gerador-v2";
  painel.style.marginBottom = "20px";

  painel.innerHTML = `
    <h2>Gerador de horários V2 — turnos unificados</h2>

    <p>
      Gere horários considerando manhã, tarde,
      noite e contraturnos individuais.
    </p>

    <div
      class="acoes-form"
      style="
        margin:12px 0;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      "
    >
      <button
        type="button"
        class="btn-secundario"
        id="v2-validar-cadastros"
      >
        Validar cadastros V2
      </button>

      <button
        type="button"
        class="btn-primary"
        id="v2-gerar-grade"
      >
        Gerar grade V2
      </button>

      <button
        type="button"
        class="btn-secundario"
        id="v2-imprimir-grade"
        disabled
      >
        Imprimir grade V2
      </button>
    </div>

    <p id="v2-status-gerador" role="status"></p>

    <div id="v2-diagnostico"></div>

    <div id="v2-resultado-grade"></div>
  `;

  pagina.insertBefore(
    painel,
    pagina.firstChild
  );

  let ocupado = false;

  function status(mensagem, erro = false) {
    const elemento = $("v2-status-gerador");

    elemento.textContent = mensagem;
    elemento.style.color = erro
      ? "#b91c1c"
      : "#15803d";
  }

  // ==========================================
  // PREPARAR DADOS V2
  // ==========================================

  function prepararDados() {
    const escola = ler(
      "grademestre_escola_v2",
      null
    );

    const turmas = ler(
      "grademestre_turmas",
      []
    );

    const professoresV1 = ler(
      "grademestre_professores",
      []
    );

    if (
      !escola?.perfisHorario ||
      !escola.horariosConfirmados
    ) {
      throw new Error(
        "Confirme os horários reais da escola " +
        "no Calendário V2."
      );
    }

    if (
      !Array.isArray(turmas) ||
      !turmas.length ||
      turmas.some(t => !t.agenda)
    ) {
      throw new Error(
        "Salve a agenda V2 de todas as turmas."
      );
    }

    if (
      !Array.isArray(professoresV1) ||
      !professoresV1.length
    ) {
      throw new Error(
        "Cadastre os professores e disciplinas."
      );
    }

    if (
      !window.GradeMestreBloqueiosV2
        ?.prepararProfessores
    ) {
      throw new Error(
        "O módulo de bloqueios V2 não foi carregado."
      );
    }

    const professores =
      window.GradeMestreBloqueiosV2
        .prepararProfessores(professoresV1);

    return {
      schemaVersion: 2,
      escola,
      turmas,
      professores,
      fixadas: {}
    };
  }

  // ==========================================
  // POSIÇÕES FÍSICAS DA GRADE
  // ==========================================

  function posicoesEsperadas(dados) {
    const mapa = new Map();

    for (const turma of dados.turmas) {
      const perfilId =
        turma.perfilHorarioId || "padrao";

      const perfil =
        dados.escola.perfisHorario[perfilId];

      if (!perfil) {
        throw new Error(
          `Perfil de horários ausente: ${perfilId}.`
        );
      }

      for (
        const [dia, turnos]
        of Object.entries(turma.agenda)
      ) {
        if (!DIAS.includes(dia)) {
          throw new Error(
            `Dia inválido em ${turma.nome}.`
          );
        }

        for (
          const [turno, ordens]
          of Object.entries(turnos)
        ) {
          if (
            !TURNOS.includes(turno) ||
            !Array.isArray(ordens)
          ) {
            throw new Error(
              `Agenda inválida em ${turma.nome}, ${dia}.`
            );
          }

          for (const ordem of ordens) {
            const periodo =
              perfil[turno]?.[ordem - 1];

            if (
              !Number.isInteger(ordem) ||
              ordem < 1 ||
              !periodo
            ) {
              throw new Error(
                `Período inexistente: ` +
                `${turma.nome}, ${dia}/${turno}/${ordem}.`
              );
            }

            const inicio =
              minuto(periodo.inicio);

            const fim =
              minuto(periodo.fim);

            if (fim <= inicio) {
              throw new Error(
                `Horário inválido de ${turma.nome}.`
              );
            }

            const sid =
              `${dia}:${perfilId}:${turno}:${ordem}`;

            const chave =
              `${turma.id}|${sid}`;

            if (mapa.has(chave)) {
              throw new Error(
                `Posição duplicada: ${chave}.`
              );
            }

            mapa.set(chave, {
              turma,
              dia,
              turno,
              ordem,
              inicio,
              fim,
              sid
            });
          }
        }
      }
    }

    return mapa;
  }

  // ==========================================
  // AUDITORIA DA GRADE
  // ==========================================

  function auditarRetorno(grade, dados) {
    if (
      !grade ||
      typeof grade !== "object" ||
      Array.isArray(grade)
    ) {
      throw new Error(
        "O servidor retornou uma grade inválida."
      );
    }

    const esperadas =
      posicoesEsperadas(dados);

    const recebidas =
      Object.keys(grade);

    if (recebidas.length !== esperadas.size) {
      throw new Error(
        `A grade possui ${recebidas.length} aulas, ` +
        `mas eram esperadas ${esperadas.size}.`
      );
    }

    const professores = new Map(
      dados.professores.map(
        p => [p.id, p]
      )
    );

    const ocupacoes = new Map();
    const limites = new Map();

    for (
      const [chave, aula]
      of Object.entries(grade)
    ) {
      const slot = esperadas.get(chave);

      if (!slot) {
        throw new Error(
          `Aula fora da agenda: ${chave}.`
        );
      }

      if (
        !aula ||
        !String(aula.disciplina || "").trim()
      ) {
        throw new Error(
          `Disciplina inválida em ${chave}.`
        );
      }

      const ids =
        Array.isArray(aula.professoresIds) &&
        aula.professoresIds.length
          ? aula.professoresIds
          : [aula.professorId];

      if (
        !ids.length ||
        new Set(ids).size !== ids.length
      ) {
        throw new Error(
          `Professores inválidos em ${chave}.`
        );
      }

      for (const id of ids) {
        const professor =
          professores.get(id);

        if (!professor) {
          throw new Error(
            `Professor não encontrado em ${chave}.`
          );
        }

        const vinculo =
          (professor.vinculos || []).find(
            v =>
              normal(v.turma) ===
                normal(slot.turma.nome) &&
              normal(v.disciplina) ===
                normal(aula.disciplina)
          );

        if (!vinculo) {
          throw new Error(
            `Disciplina de ${professor.nome} ` +
            `não cadastrada para ${slot.turma.nome}.`
          );
        }

        const chaveDia =
          `${id}|${slot.dia}`;

        const anteriores =
          ocupacoes.get(chaveDia) || [];

        const conflito = anteriores.some(
          a =>
            slot.inicio < a.fim &&
            a.inicio < slot.fim
        );

        if (conflito) {
          throw new Error(
            `Conflito simultâneo para ` +
            `${professor.nome} em ${slot.dia}.`
          );
        }

        anteriores.push({
          inicio: slot.inicio,
          fim: slot.fim
        });

        ocupacoes.set(
          chaveDia,
          anteriores
        );

        const quantidade =
          (limites.get(chaveDia) || 0) + 1;

        limites.set(
          chaveDia,
          quantidade
        );

        if (
          quantidade > Number(professor.maxDia)
        ) {
          throw new Error(
            `Limite diário ultrapassado para ` +
            `${professor.nome}.`
          );
        }
      }
    }

    return esperadas;
  }

  // ==========================================
  // COMUNICAÇÃO COM A API
  // ==========================================

  async function enviar(rota, dados) {
    const controlador =
      new AbortController();

    const limite = setTimeout(
      () => controlador.abort(),
      120000
    );

    try {
      const resposta = await fetch(
        `${API}${rota}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dados),
          signal: controlador.signal
        }
      );

      let resultado;

      try {
        resultado = await resposta.json();
      } catch {
        throw new Error(
          "A API não retornou JSON válido."
        );
      }

      if (!resposta.ok) {
        const detalhe = resultado.detail;

        const mensagem =
          typeof detalhe === "string"
            ? detalhe
            : Array.isArray(detalhe)
              ? detalhe.map(
                  v => v.msg || String(v)
                ).join("; ")
              : `Erro HTTP ${resposta.status}`;

        throw new Error(mensagem);
      }

      return resultado;

    } finally {
      clearTimeout(limite);
    }
  }

  // ==========================================
  // DIAGNÓSTICO
  // ==========================================

  function mostrarDiagnostico(lista) {
    const area = $("v2-diagnostico");
    area.replaceChildren();

    const problemas =
      Array.isArray(lista) ? lista : [];

    for (const problema of problemas) {
      const artigo = novo(
        "article",
        undefined,
        "diagnostico-item"
      );

      artigo.appendChild(
        novo(
          "strong",
          problema.titulo ||
            "Restrição incompatível"
        )
      );

      artigo.appendChild(
        novo(
          "p",
          problema.detalhe || ""
        )
      );

      const ul = novo("ul");

      for (
        const sugestao
        of problema.sugestoes || []
      ) {
        ul.appendChild(
          novo("li", sugestao)
        );
      }

      artigo.appendChild(ul);
      area.appendChild(artigo);
    }
  }

  // ==========================================
  // RENDERIZAÇÃO DA GRADE V2
  // ==========================================

  function renderizar(
    dados,
    grade,
    geradaEm,
    comparar = true
  ) {
    const area = $("v2-resultado-grade");
    area.replaceChildren();

    const esperadas =
      posicoesEsperadas(dados);

    const professores = new Map(
      dados.professores.map(
        p => [p.id, p.nome]
      )
    );

    const porDiaTurno = new Map();

    for (
      const [chave, slot]
      of esperadas
    ) {
      const grupo =
        `${slot.dia}|${slot.turno}`;

      if (!porDiaTurno.has(grupo)) {
        porDiaTurno.set(
          grupo,
          new Map()
        );
      }

      const linhas =
        porDiaTurno.get(grupo);

      const horario =
        `${slot.inicio}|${slot.fim}`;

      if (!linhas.has(horario)) {
        linhas.set(horario, {
          inicio: slot.inicio,
          fim: slot.fim,
          aulas: new Map()
        });
      }

      linhas.get(horario)
        .aulas.set(
          slot.turma.id,
          grade[chave]
        );
    }

    let aviso = "";

    if (comparar) {
      try {
        const atual = prepararDados();

        if (
          JSON.stringify(atual) !==
          JSON.stringify(dados)
        ) {
          aviso =
            "Atenção: os cadastros mudaram " +
            "após esta geração. Gere novamente.";
        }

      } catch {
        aviso =
          "Atenção: revise os cadastros V2 " +
          "antes de utilizar esta grade.";
      }
    }

    if (aviso) {
      const p = novo("p", aviso);
      p.style.color = "#b91c1c";
      area.appendChild(p);
    }

    area.appendChild(
      novo(
        "h3",
        `Grade V2 — ${Object.keys(grade).length} ` +
        `aulas / ${dados.turmas.length} turmas`
      )
    );

    if (geradaEm) {
      area.appendChild(
        novo(
          "p",
          "Gerada em " +
          new Date(geradaEm)
            .toLocaleString("pt-BR")
        )
      );
    }

    for (const turno of TURNOS) {
      const diasComAulas =
        DIAS.filter(dia =>
          porDiaTurno.has(`${dia}|${turno}`)
        );

      if (!diasComAulas.length) {
        continue;
      }

      const secao = novo("section");
      secao.style.marginTop = "18px";

      secao.appendChild(
        novo(
          "h3",
          `Turno: ${NOMES[turno]}`
        )
      );

      const wrapper = novo(
        "div",
        undefined,
        "grade-wrapper"
      );

      const tabela = novo("table");

      tabela.style.width = "100%";
      tabela.style.borderCollapse =
        "collapse";

      const cabecalho = novo("tr");

      for (
        const nome
        of [
          "Dia",
          "Horário",
          ...dados.turmas.map(t => t.nome)
        ]
      ) {
        cabecalho.appendChild(
          novo("th", nome)
        );
      }

      const thead = novo("thead");
      thead.appendChild(cabecalho);
      tabela.appendChild(thead);

      const tbody = novo("tbody");

      for (const dia of diasComAulas) {
        const linhas = [
          ...porDiaTurno
            .get(`${dia}|${turno}`)
            .values()
        ].sort(
          (a, b) =>
            a.inicio - b.inicio ||
            a.fim - b.fim
        );

        linhas.forEach(
          (linha, indice) => {
            const tr = novo("tr");

            if (indice === 0) {
              const diaCell = novo(
                "th",
                dia.charAt(0).toUpperCase() +
                dia.slice(1)
              );

              diaCell.rowSpan =
                linhas.length;

              tr.appendChild(diaCell);
            }

            const formatar = n =>
              `${String(
                Math.floor(n / 60)
              ).padStart(2, "0")}:${String(
                n % 60
              ).padStart(2, "0")}`;

            tr.appendChild(
              novo(
                "td",
                `${formatar(linha.inicio)}–` +
                `${formatar(linha.fim)}`
              )
            );

            for (
              const turma
              of dados.turmas
            ) {
              const td = novo("td");

              // Associar posição à célula
              // para permitir edição manual.

              const posicaoEditavel = [
                ...esperadas.entries()
              ].find(
                ([, slot]) =>
                  slot.turma.id === turma.id &&
                  slot.dia === dia &&
                  slot.turno === turno &&
                  slot.inicio === linha.inicio &&
                  slot.fim === linha.fim
              );

              if (posicaoEditavel) {
                td.dataset.v2Chave =
                  posicaoEditavel[0];
              }

              const aula =
                linha.aulas.get(turma.id);

              if (aula) {
                td.appendChild(
                  novo(
                    "strong",
                    aula.disciplina
                  )
                );

                const ids =
                  Array.isArray(
                    aula.professoresIds
                  ) &&
                  aula.professoresIds.length
                    ? aula.professoresIds
                    : [aula.professorId];

                const nomes =
                  ids.map(
                    id =>
                      professores.get(id) ||
                      "Desconhecido"
                  ).join(" + ");

                const p = novo(
                  "div",
                  nomes
                );

                p.style.fontSize =
                  "0.84em";

                td.appendChild(p);

              } else {
                td.textContent = "—";
                td.style.color = "#888";
              }

              tr.appendChild(td);
            }

            tbody.appendChild(tr);
          }
        );
      }

      tabela.appendChild(tbody);
      wrapper.appendChild(tabela);
      secao.appendChild(wrapper);
      area.appendChild(secao);
    }

    $("v2-imprimir-grade").disabled =
      !Object.keys(grade).length;
  }

  // ==========================================
  // ESTADO DOS BOTÕES
  // ==========================================

  function atualizarBotoes(bloquear) {
    ocupado = bloquear;

    $("v2-validar-cadastros").disabled =
      bloquear;

    $("v2-gerar-grade").disabled =
      bloquear;

    $("v2-gerar-grade").textContent =
      bloquear
        ? "Calculando..."
        : "Gerar grade V2";
  }

  // ==========================================
  // VALIDAR CADASTROS
  // ==========================================

  $("v2-validar-cadastros")
    .addEventListener(
      "click",
      async () => {
        if (ocupado) return;

        atualizarBotoes(true);
        mostrarDiagnostico([]);

        try {
          const dados = prepararDados();

          status(
            "Validando calendários e cargas..."
          );

          const resultado = await enviar(
            "/v2/validar",
            dados
          );

          if (!resultado.valido) {
            throw new Error(
              "A API não aprovou os cadastros V2."
            );
          }

          status(
            `Cadastros V2 válidos: ` +
            `${resultado.totalAulas} aulas ` +
            `em ${dados.turmas.length} turmas. ` +
            "A viabilidade ainda será verificada " +
            "pelo gerador."
          );

        } catch (erro) {
          status(
            `Validação V2: ${erro.message}`,
            true
          );

          console.error(erro);

        } finally {
          atualizarBotoes(false);
        }
      }
    );

  // ==========================================
  // GERAR GRADE V2
  // ==========================================

  $("v2-gerar-grade")
    .addEventListener(
      "click",
      async () => {
        if (ocupado) return;

        atualizarBotoes(true);
        mostrarDiagnostico([]);

        try {
          const dados = prepararDados();

          status(
            "Conferindo cargas e agendas..."
          );

          const validacao = await enviar(
            "/v2/validar",
            dados
          );

          if (!validacao.valido) {
            throw new Error(
              "O servidor recusou os cadastros V2."
            );
          }

          status(
            `Procurando uma distribuição de ` +
            `${validacao.totalAulas} aulas...`
          );

          const resultado = await enviar(
            "/v2/gerar",
            dados
          );

          if (!resultado.sucesso) {
            status(
              resultado.mensagem ||
              "Não foi possível gerar a grade.",
              true
            );

            mostrarDiagnostico(
              resultado.diagnostico
            );

            return;
          }

          auditarRetorno(
            resultado.grade,
            dados
          );

          const salvo = {
            schemaVersion: 2,
            geradaEm:
              new Date().toISOString(),
            dados,
            grade: resultado.grade
          };

          localStorage.setItem(
            CHAVE,
            JSON.stringify(salvo)
          );

          ultimaGrade = null;
          botaoDesfazer.disabled = true;

          cancelarSelecao();

          renderizar(
            dados,
            resultado.grade,
            salvo.geradaEm
          );

          status(
            `Grade V2 gerada e salva: ` +
            `${
              Object.keys(
                resultado.grade
              ).length
            } aulas, sem sobreposição detectada.`
          );

        } catch (erro) {
          status(
            erro.name === "AbortError"
              ? "O servidor excedeu o tempo de resposta."
              : `Erro na geração V2: ${erro.message}`,
            true
          );

          console.error(erro);

        } finally {
          atualizarBotoes(false);
        }
      }
    );

  // ==========================================
  // IMPRESSÃO
  // ==========================================

  $("v2-imprimir-grade")
    .addEventListener(
      "click",
      () => {
        const area =
          $("v2-resultado-grade");

        if (!area.querySelector("table")) {
          return;
        }

        const janela =
          window.open("", "_blank");

        if (!janela) {
          status(
            "O navegador bloqueou a janela de impressão.",
            true
          );
          return;
        }

        janela.document.open();

        janela.document.write(
          '<!DOCTYPE html>' +
          '<html lang="pt-BR">' +
          '<head>' +
          '<meta charset="UTF-8">' +
          '<title>GradeMestre V2</title>' +
          '<style>' +
          'body{font:11px Arial,sans-serif;margin:12px}' +
          'table{border-collapse:collapse;width:100%;margin-bottom:16px}' +
          'th,td{border:1px solid #888;padding:4px;text-align:center}' +
          'h3{margin:12px 0 6px}' +
          '@page{size:A3 landscape;margin:9mm}' +
          'section{break-inside:avoid}' +
          '</style>' +
          '</head><body></body></html>'
        );

        janela.document.close();

        janela.document.body.appendChild(
          area.cloneNode(true)
        );

        janela.focus();
        janela.print();
      }
    );

  // ==========================================
  // EDIÇÃO MANUAL V2
  // ==========================================

  const estiloEdicao = novo("style");

  estiloEdicao.textContent = `
    #painel-gerador-v2.gm-v2-editando td[data-v2-chave] {
      cursor: pointer;
    }

    #painel-gerador-v2.gm-v2-editando
    td[data-v2-chave]:hover {
      outline: 2px solid #b99542;
      outline-offset: -2px;
    }

    #painel-gerador-v2 td.gm-v2-selecionada {
      outline: 3px solid #ba8d27 !important;
      outline-offset: -3px;
      background: #fff4cb !important;
    }

    #v2-controles-edicao {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin: 12px 0;
    }
  `;

  document.head.appendChild(estiloEdicao);

  const controlesEdicao = novo("div");
  controlesEdicao.id = "v2-controles-edicao";

  const botaoEditar = novo(
    "button",
    "Ativar edição manual",
    "btn-secundario"
  );

  botaoEditar.type = "button";

  const botaoCancelar = novo(
    "button",
    "Cancelar seleção",
    "btn-secundario"
  );

  botaoCancelar.type = "button";
  botaoCancelar.disabled = true;

  const botaoDesfazer = novo(
    "button",
    "Desfazer última troca",
    "btn-secundario"
  );

  botaoDesfazer.type = "button";
  botaoDesfazer.disabled = true;

  const avisoEdicao = novo(
    "p",
    "Ative a edição para trocar duas aulas da mesma turma."
  );

  avisoEdicao.id = "v2-aviso-edicao";
  avisoEdicao.style.margin =
    "4px 0 12px";

  controlesEdicao.append(
    botaoEditar,
    botaoCancelar,
    botaoDesfazer
  );

  painel.insertBefore(
    controlesEdicao,
    $("v2-resultado-grade")
  );

  painel.insertBefore(
    avisoEdicao,
    $("v2-resultado-grade")
  );

  let modoEdicao = false;
  let primeiraChave = null;
  let ultimaGrade = null;

  function mensagemEdicao(
    texto,
    erro = false
  ) {
    avisoEdicao.textContent = texto;
    avisoEdicao.style.color =
      erro ? "#b91c1c" : "";
  }

  function cancelarSelecao() {
    primeiraChave = null;

    botaoCancelar.disabled = true;

    $("v2-resultado-grade")
      .querySelectorAll(
        ".gm-v2-selecionada"
      )
      .forEach(
        td => td.classList.remove(
          "gm-v2-selecionada"
        )
      );
  }

  // ==========================================
  // VERIFICAR SE A GRADE ESTÁ ATUALIZADA
  // ==========================================

  function configuracaoIntacta(dados) {
    const atual = prepararDados();

    for (
      const campo
      of [
        "escola",
        "turmas",
        "professores"
      ]
    ) {
      if (
        JSON.stringify(atual[campo]) !==
        JSON.stringify(dados[campo])
      ) {
        throw new Error(
          "Os cadastros ou bloqueios foram alterados. " +
          "Gere outra grade antes de editar."
        );
      }
    }
  }

  // ==========================================
  // CONFERIR BLOQUEIOS DO PROFESSOR
  // ==========================================

  function professorTemBloqueio(
    professor,
    slot,
    escola
  ) {
    for (
      const bloqueio
      of professor.indisponibilidades || []
    ) {
      let b;

      if (typeof bloqueio === "string") {
        const partes = bloqueio.split(":");

        let dia;
        let perfil;
        let turno;
        let ordem;

        if (partes.length === 4) {
          [
            dia,
            perfil,
            turno,
            ordem
          ] = partes;

        } else if (
          partes.length === 3 &&
          TURNOS.includes(partes[1])
        ) {
          [dia, turno, ordem] = partes;
          perfil = "padrao";

        } else {
          throw new Error(
            `Bloqueio antigo de ${professor.nome}: ` +
            bloqueio
          );
        }

        const periodo =
          escola.perfisHorario?.[perfil]
            ?.[turno]?.[Number(ordem) - 1];

        if (!periodo) {
          throw new Error(
            `Bloqueio sem horário: ${bloqueio}.`
          );
        }

        b = {
          dia,
          inicio: minuto(periodo.inicio),
          fim: minuto(periodo.fim)
        };

      } else if (
        bloqueio &&
        typeof bloqueio === "object"
      ) {
        b = {
          dia: bloqueio.dia,
          inicio: minuto(bloqueio.inicio),
          fim: minuto(bloqueio.fim)
        };

      } else {
        throw new Error(
          `Bloqueio inválido de ${professor.nome}.`
        );
      }

      if (
        b.dia === slot.dia &&
        slot.inicio < b.fim &&
        b.inicio < slot.fim
      ) {
        return true;
      }
    }

    return false;
  }

  // ==========================================
  // VALIDAÇÃO COMPLETA DA TROCA
  // ==========================================

  function validarTroca(grade, dados) {
    // Confere sobreposições e limite global.
    const slots = auditarRetorno(
      grade,
      dados
    );

    const professores = new Map(
      dados.professores.map(
        p => [p.id, p]
      )
    );

    const diariasVinculo = new Map();
    const contagens = new Map();

    for (
      const [chave, aula]
      of Object.entries(grade)
    ) {
      const slot = slots.get(chave);

      const ids =
        aula.professoresIds?.length
          ? aula.professoresIds
          : [aula.professorId];

      for (const pid of ids) {
        const professor =
          professores.get(pid);

        const vinculo =
          professor.vinculos.find(
            v =>
              normal(v.turma) ===
                normal(slot.turma.nome) &&
              normal(v.disciplina) ===
                normal(aula.disciplina) &&
              normal(v.grupoCompartilhado) ===
                normal(aula.grupoCompartilhado)
          );

        if (!vinculo) {
          throw new Error(
            `Vínculo não encontrado para ` +
            `${professor.nome}: ${aula.disciplina}.`
          );
        }

        if (
          professorTemBloqueio(
            professor,
            slot,
            dados.escola
          )
        ) {
          throw new Error(
            `${professor.nome} está indisponível ` +
            `em ${slot.dia}, ${slot.turno}, ` +
            `${slot.ordem}ª aula.`
          );
        }

        const chaveDiaria =
          `${pid}|${slot.turma.id}|` +
          `${normal(aula.disciplina)}|${slot.dia}`;

        const quantidade =
          (diariasVinculo.get(chaveDiaria) || 0)
          + 1;

        diariasVinculo.set(
          chaveDiaria,
          quantidade
        );

        if (
          quantidade > Number(vinculo.maxDia)
        ) {
          throw new Error(
            `Limite diário da disciplina ` +
            `${aula.disciplina} excedido para ` +
            `${professor.nome}.`
          );
        }

        const semanal =
          `${pid}|${slot.turma.id}|` +
          `${normal(aula.disciplina)}`;

        contagens.set(
          semanal,
          (contagens.get(semanal) || 0) + 1
        );
      }
    }

    // Conferir carga semanal e geminadas.

    for (
      const professor
      of dados.professores
    ) {
      for (
        const vinculo
        of professor.vinculos || []
      ) {
        const turma = dados.turmas.find(
          t =>
            normal(t.nome) ===
            normal(vinculo.turma)
        );

        if (!turma) {
          throw new Error(
            `Turma de ${professor.nome} não encontrada.`
          );
        }

        const semanal =
          `${professor.id}|${turma.id}|` +
          `${normal(vinculo.disciplina)}`;

        if (
          (contagens.get(semanal) || 0) !==
          Number(vinculo.aulas)
        ) {
          throw new Error(
            `Carga semanal de ${professor.nome} ` +
            `em ${vinculo.disciplina} foi alterada.`
          );
        }

        if (
          vinculo.geminadas !== "obrigatoria" ||
          Number(vinculo.paresGeminados) <= 0
        ) {
          continue;
        }

        const grupos = new Map();

        for (
          const [chave, aula]
          of Object.entries(grade)
        ) {
          const slot = slots.get(chave);

          const ids =
            aula.professoresIds?.length
              ? aula.professoresIds
              : [aula.professorId];

          if (
            slot.turma.id !== turma.id ||
            !ids.includes(professor.id) ||
            normal(aula.disciplina) !==
              normal(vinculo.disciplina) ||
            normal(aula.grupoCompartilhado) !==
              normal(vinculo.grupoCompartilhado)
          ) {
            continue;
          }

          const grupo =
            `${slot.dia}|${slot.turno}`;

          if (!grupos.has(grupo)) {
            grupos.set(grupo, []);
          }

          grupos.get(grupo).push(
            slot.ordem
          );
        }

        let pares = 0;

        for (
          const ordens
          of grupos.values()
        ) {
          ordens.sort(
            (a, b) => a - b
          );

          for (
            let i = 0;
            i < ordens.length - 1;
          ) {
            if (
              ordens[i + 1] ===
              ordens[i] + 1
            ) {
              pares++;
              i += 2;
            } else {
              i++;
            }
          }
        }

        if (
          pares <
          Number(vinculo.paresGeminados)
        ) {
          throw new Error(
            `A troca desfez as geminadas ` +
            `obrigatórias de ${professor.nome} ` +
            `(${vinculo.disciplina}).`
          );
        }
      }
    }
  }

  // ==========================================
  // ATIVAR E DESATIVAR EDIÇÃO
  // ==========================================

  botaoEditar.addEventListener(
    "click",
    () => {
      modoEdicao = !modoEdicao;

      painel.classList.toggle(
        "gm-v2-editando",
        modoEdicao
      );

      botaoEditar.textContent =
        modoEdicao
          ? "Encerrar edição manual"
          : "Ativar edição manual";

      cancelarSelecao();

      mensagemEdicao(
        modoEdicao
          ? "Clique na primeira aula e depois " +
            "na segunda aula da MESMA turma."
          : "Edição encerrada."
      );
    }
  );

  botaoCancelar.addEventListener(
    "click",
    () => {
      cancelarSelecao();

      mensagemEdicao(
        "Seleção cancelada. Escolha duas aulas."
      );
    }
  );

  // ==========================================
  // TROCAR DUAS AULAS
  // ==========================================

  $("v2-resultado-grade")
    .addEventListener(
      "click",
      evento => {
        if (!modoEdicao) return;

        const td = evento.target.closest(
          "td[data-v2-chave]"
        );

        if (!td) return;

        const chave =
          td.dataset.v2Chave;

        const salva = ler(
          CHAVE,
          null
        );

        if (
          !salva?.dados ||
          !salva?.grade
        ) {
          mensagemEdicao(
            "Gere uma grade V2 primeiro.",
            true
          );
          return;
        }

        // PRIMEIRA AULA

        if (!primeiraChave) {
          primeiraChave = chave;

          td.classList.add(
            "gm-v2-selecionada"
          );

          botaoCancelar.disabled = false;

          mensagemEdicao(
            "Primeira aula selecionada. " +
            "Clique na segunda aula da mesma turma."
          );

          return;
        }

        // CANCELAR SELEÇÃO

        if (
          primeiraChave === chave
        ) {
          cancelarSelecao();

          mensagemEdicao(
            "Seleção cancelada."
          );

          return;
        }

        // IMPEDIR TROCA ENTRE TURMAS

        if (
          primeiraChave.split("|")[0] !==
          chave.split("|")[0]
        ) {
          mensagemEdicao(
            "Escolha duas aulas da mesma turma.",
            true
          );

          return;
        }

        try {
          configuracaoIntacta(
            salva.dados
          );

          const proposta = {
            ...salva.grade
          };

          // Troca apenas a posição das aulas.
          // Professores compartilhados seguem juntos.

          [
            proposta[primeiraChave],
            proposta[chave]
          ] = [
            proposta[chave],
            proposta[primeiraChave]
          ];

          // Não salva se causar conflito.
          validarTroca(
            proposta,
            salva.dados
          );

          ultimaGrade = JSON.parse(
            JSON.stringify(salva.grade)
          );

          salva.grade = proposta;
          salva.editadoEm =
            new Date().toISOString();

          localStorage.setItem(
            CHAVE,
            JSON.stringify(salva)
          );

          renderizar(
            salva.dados,
            salva.grade,
            salva.geradaEm
          );

          cancelarSelecao();

          botaoDesfazer.disabled = false;

          mensagemEdicao(
            "Troca realizada e salva! " +
            "A impressão já utilizará o novo horário."
          );

        } catch (erro) {
          mensagemEdicao(
            `Troca não permitida: ${erro.message}`,
            true
          );
        }
      }
    );

  // ==========================================
  // DESFAZER ÚLTIMA TROCA
  // ==========================================

  botaoDesfazer.addEventListener(
    "click",
    () => {
      if (!ultimaGrade) return;

      try {
        const salva = ler(
          CHAVE,
          null
        );

        configuracaoIntacta(
          salva.dados
        );

        validarTroca(
          ultimaGrade,
          salva.dados
        );

        salva.grade = ultimaGrade;

        salva.editadoEm =
          new Date().toISOString();

        localStorage.setItem(
          CHAVE,
          JSON.stringify(salva)
        );

        ultimaGrade = null;

        renderizar(
          salva.dados,
          salva.grade,
          salva.geradaEm
        );

        cancelarSelecao();

        botaoDesfazer.disabled = true;

        mensagemEdicao(
          "Última troca desfeita."
        );

      } catch (erro) {
        mensagemEdicao(
          `Não foi possível desfazer: ${erro.message}`,
          true
        );
      }
    }
  );

  // ==========================================
  // RECUPERAR GRADE V2 SALVA
  // ==========================================

  try {
    const salva = ler(
      CHAVE,
      null
    );

    if (
      salva?.schemaVersion === 2 &&
      salva.dados &&
      salva.grade
    ) {
      renderizar(
        salva.dados,
        salva.grade,
        salva.geradaEm
      );

      status(
        "Grade V2 anteriormente salva carregada. " +
        "Confira se os cadastros continuam atuais."
      );
    }

  } catch (erro) {
    status(
      "Não foi possível recuperar a grade V2: " +
      erro.message,
      true
    );
  }
})();
