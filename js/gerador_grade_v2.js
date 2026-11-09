
/*
 * GradeMestre V2 — Geração e visualização.
 * Preserva o gerador e a grade da V1.
 *
 * Carregar depois de:
 * - agenda_turmas_v2.js
 * - disponibilidade_professores_v2.js
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
    const e = document.createElement(tag);

    if (texto !== undefined) {
      e.textContent = texto;
    }

    if (classe) e.className = classe;

    return e;
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

  const minuto = hora => {
    const [h, m] = String(hora)
      .split(":")
      .map(Number);

    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      h < 0 || h > 23 ||
      m < 0 || m > 59
    ) {
      throw new Error(
        `Horário inválido: ${hora}`
      );
    }

    return h * 60 + m;
  };

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
      A grade V1 não será alterada.
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
    const e = $("v2-status-gerador");

    e.textContent = mensagem;
    e.style.color = erro
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
        "Em Turmas → Calendário V2, confirme " +
        "e salve os horários reais da escola."
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
  // POSIÇÕES REAIS DAS TURMAS
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
          `Perfil inexistente: ${perfilId}.`
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
              `Agenda inválida: ${turma.nome}.`
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
                `Aula inexistente em ` +
                `${turma.nome}: ${dia}/${turno}/${ordem}.`
              );
            }

            const inicio =
              minuto(periodo.inicio);

            const fim =
              minuto(periodo.fim);

            if (fim <= inicio) {
              throw new Error(
                `Horário inválido em ${turma.nome}.`
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
  // AUDITORIA DA RESPOSTA
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

    if (
      recebidas.length !== esperadas.size
    ) {
      throw new Error(
        `O servidor retornou ${recebidas.length} ` +
        `aulas, mas eram esperadas ` +
        `${esperadas.size}.`
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

      if (new Set(ids).size !== ids.length) {
        throw new Error(
          `Professor repetido em ${chave}.`
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
            `Conflito simultâneo detectado para ` +
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
    const controlador = new AbortController();

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
  // MOSTRAR DIAGNÓSTICO
  // ==========================================

  function mostrarDiagnostico(lista) {
    const area = $("v2-diagnostico");
    area.replaceChildren();

    for (
      const problema
      of Array.isArray(lista) ? lista : []
    ) {
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
  // RENDERIZAR GRADE POR TURNO
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

    // Verificar se os cadastros mudaram.
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
          "antes de usar esta grade.";
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

    // Manhã, tarde e noite separadamente.
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

      const thead = novo("thead");
      const cabecalho = novo("tr");

      const colunas = [
        "Dia",
        "Horário",
        ...dados.turmas.map(t => t.nome)
      ];

      colunas.forEach(nome => {
        cabecalho.appendChild(
          novo("th", nome)
        );
      });

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
  // BOTÕES
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
          const dados =
            prepararDados();

          status(
            "Validando calendários e cargas..."
          );

          const resultado =
            await enviar(
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
          const dados =
            prepararDados();

          status(
            "Conferindo cargas e agendas..."
          );

          const validacao =
            await enviar(
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

          const resultado =
            await enviar(
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

          // Nunca salvar sem conferir.
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
  // IMPRESSÃO V2
  // ==========================================

  $("v2-imprimir-grade")
    .addEventListener(
      "click",
      () => {
        const area =
          $("v2-resultado-grade");

        if (
          !area.querySelector("table")
        ) {
          return;
        }

        const janela =
          window.open("", "_blank");

        if (!janela) {
          status(
            "O navegador bloqueou " +
            "a janela de impressão.",
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
