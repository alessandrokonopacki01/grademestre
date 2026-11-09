
/* GradeMestre V2 — Editor de agendas por turma.
 * Carregar depois de js/turmas.js. Nao chama o solver V1.
 */
(() => {
  "use strict";
  const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta"];
  const TURNOS = ["manha", "tarde", "noite"];
  const NOMES = {manha: "Manhã", tarde: "Tarde", noite: "Noite"};
  const CHAVE_ESCOLA_V2 = "grademestre_escola_v2";
  const horariosExemplo = {
    manha: [["07:00", "07:50"], ["07:50", "08:40"], ["08:40", "09:30"], ["09:40", "10:30"], ["10:30", "11:20"], ["11:20", "12:10"]],
    tarde: [["12:30", "13:20"], ["13:20", "14:10"], ["14:10", "15:00"], ["15:10", "16:00"], ["16:00", "16:50"], ["16:50", "17:40"]],
    noite: [["19:00", "19:45"], ["19:45", "20:30"], ["20:30", "21:15"], ["21:25", "22:10"], ["22:10", "22:55"]]
  };

  const $ = id => document.getElementById(id);
  const li = (tag, texto, classe) => {
    const el = document.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    if (classe) el.className = classe;
    return el;
  };
  const copiar = obj => JSON.parse(JSON.stringify(obj));

  function escolaPadrao() {
    let nome = "Escola";
    try { nome = JSON.parse(localStorage.getItem("grademestre_config") || "{}").nome || nome; } catch (_) {}
    return {
      nome,
      horariosConfirmados: false,
      perfisHorario: {padrao: Object.fromEntries(
        TURNOS.map(t => [t, horariosExemplo[t].map(([inicio, fim]) => ({inicio, fim}))])
      )}
    };
  }

  function carregarEscola() {
    try {
      const salva = JSON.parse(localStorage.getItem(CHAVE_ESCOLA_V2));
      if (salva && salva.perfisHorario && salva.perfisHorario.padrao) return salva;
    } catch (_) {}
    return escolaPadrao();
  }

  let escola = carregarEscola();
  let selecionada = null;
  let agendaRascunho = {};

  function minutos(hora) {
    if (!/^\d{2}:\d{2}$/.test(hora || "")) throw new Error("Horário deve estar em HH:MM.");
    const [h, m] = hora.split(":").map(Number);
    if (h > 23 || m > 59) throw new Error(`Horário inválido: ${hora}.`);
    return h * 60 + m;
  }

  function perfil() { return escola.perfisHorario.padrao; }

  function validarEscola() {
    for (const turno of TURNOS) {
      const aulas = perfil()[turno];
      if (!Array.isArray(aulas)) throw new Error(`Turno ${turno} inválido.`);
      let ultimoFim = -1;
      aulas.forEach((a, indice) => {
        const inicio = minutos(a.inicio), fim = minutos(a.fim);
        if (inicio >= fim || inicio < ultimoFim) {
          throw new Error(`Confira a aula ${indice + 1} do turno ${NOMES[turno]}.`);
        }
        ultimoFim = fim;
      });
    }
  }

  function normalizarAgenda(agenda) {
    if (!agenda || typeof agenda !== "object") throw new Error("Agenda inválida.");
    const limpa = {};
    for (const dia of DIAS) {
      const turnos = agenda[dia] || {};
      for (const turno of TURNOS) {
        const ordens = turnos[turno] || [];
        if (!Array.isArray(ordens)) throw new Error(`Aulas inválidas em ${dia}/${turno}.`);
        const n = perfil()[turno].length;
        if (ordens.some(x => !Number.isInteger(x) || x < 1 || x > n) ||
            new Set(ordens).size !== ordens.length) {
          throw new Error(`Agenda excede o perfil de ${NOMES[turno]} em ${dia}.`);
        }
        if (ordens.length) (limpa[dia] ||= {})[turno] = [...ordens].sort((a, b) => a - b);
      }
    }
    if (!Object.keys(limpa).length) throw new Error("A turma deve ter ao menos uma aula.");
    return limpa;
  }

  const contar = agenda => Object.values(agenda).reduce(
    (total, turnos) => total + Object.values(turnos).reduce((s, a) => s + a.length, 0), 0
  );

  function agendaModelo(modelo, turno, diaExtra, turnoExtra) {
    const agenda = {};
    const porDia = (dia, t, quantidade) => {
      if (quantidade > perfil()[t].length) {
        throw new Error(`O turno ${NOMES[t]} só possui ${perfil()[t].length} períodos cadastrados.`);
      }
      (agenda[dia] ||= {})[t] = Array.from({length: quantidade}, (_, i) => i + 1);
    };
    const regular = modelo === "6" ? 6 : 5;
    DIAS.forEach(dia => porDia(dia, turno, regular));
    if (modelo === "30extra") {
      if (turnoExtra === turno) throw new Error("O turno adicional deve ser diferente do regular.");
      porDia(diaExtra, turnoExtra, 5);
    }
    if (modelo === "integral") {
      if (turnoExtra === turno) throw new Error("O turno adicional deve ser diferente do regular.");
      DIAS.forEach(dia => porDia(dia, turnoExtra, 5));
    }
    return agenda;
  }

  const container = li("section", undefined, "painel-info");
  container.id = "painel-agendas-v2";
  container.style.marginTop = "18px";
  container.innerHTML = `
    <h2>Calendário das turmas — V2 (experimental)</h2>
    <p>Defina os turnos físicos de cada turma. Os horários abaixo são exemplos até você confirmar os sinos reais da escola.</p>
    <details id="v2-detalhes-horarios">
      <summary><strong>1. Horários reais dos turnos (clique para configurar)</strong></summary>
      <div id="v2-horarios" style="margin:12px 0"></div>
      <label style="display:block;margin:10px 0"><input type="checkbox" id="v2-confirmou"> Conferi os horários reais de entrada e saída de cada aula</label>
      <button type="button" class="btn-secundario" id="v2-salvar-escola">Salvar horários da escola</button>
    </details>
    <hr style="margin:16px 0">
    <h3>2. Agenda semanal da turma</h3>
    <label for="v2-turma">Turma</label>
    <select id="v2-turma"></select>
    <div id="v2-editor" hidden>
      <label for="v2-turno">Turno regular</label>
      <select id="v2-turno"><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select>
      <label for="v2-modelo">Modelo rápido</label>
      <select id="v2-modelo">
        <option value="5">5 aulas por dia (25 semanais)</option>
        <option value="6">6 aulas por dia (30 semanais)</option>
        <option value="30extra">5 aulas/dia + 5 em outro turno (30)</option>
        <option value="integral">5 aulas/dia em dois turnos (50)</option>
        <option value="personalizado">Personalizado — editar dia por dia</option>
      </select>
      <div id="v2-extra">
        <label for="v2-dia-extra">Dia do turno adicional</label>
        <select id="v2-dia-extra">
          <option value="segunda">Segunda</option><option value="terca">Terça</option><option value="quarta">Quarta</option><option value="quinta">Quinta</option><option value="sexta">Sexta</option>
        </select>
        <label for="v2-turno-extra">Turno adicional</label>
        <select id="v2-turno-extra"><option value="manha">Manhã</option><option value="tarde" selected>Tarde</option><option value="noite">Noite</option></select>
      </div>
      <button type="button" id="v2-aplicar-modelo" class="btn-secundario">Aplicar modelo à prévia</button>
      <p style="margin-top:12px"><strong>Quantidade de aulas por dia e turno</strong> — 0 significa que a turma não tem aula nesse turno.</p>
      <div class="grade-wrapper" id="v2-grade-agenda"></div>
      <p id="v2-total-aulas"></p>
      <button type="button" id="v2-salvar-agenda" class="btn-primary">Salvar agenda V2 da turma</button>
    </div>
    <p id="v2-mensagem" role="status" style="margin-top:10px"></p>
    <p><small>Esta tela apenas cadastra agendas V2; o botão atual "Gerar horários" ainda usa a V1. Não use a V1 para testar turmas integrais.</small></p>
  `;
  const pagina = $("turmas");
  if (!pagina || typeof turmas === "undefined") {
    console.error("GradeMestre V2: carregue este script depois de turmas.js.");
    return;
  }
  pagina.appendChild(container);

  function mensagem(texto, erro = false) {
    $("v2-mensagem").textContent = texto;
    $("v2-mensagem").style.color = erro ? "#b91c1c" : "#15803d";
  }

  function renderizarHorarios() {
    const destino = $("v2-horarios");
    destino.replaceChildren();
    TURNOS.forEach(turno => {
      const secao = li("div");
      secao.style.marginBottom = "14px";
      secao.appendChild(li("h4", NOMES[turno]));
      perfil()[turno].forEach((a, i) => {
        const linha = li("div");
        linha.style.margin = "5px 0";
        linha.appendChild(li("span", `Aula ${i + 1}: `));
        ["inicio", "fim"].forEach(campo => {
          const entrada = li("input");
          entrada.type = "time";
          entrada.value = a[campo];
          entrada.dataset.turno = turno;
          entrada.dataset.ordem = i;
          entrada.dataset.campo = campo;
          entrada.style.width = "120px";
          entrada.style.display = "inline-block";
          entrada.addEventListener("change", () => {
            perfil()[turno][i][campo] = entrada.value;
            escola.horariosConfirmados = false;
            $("v2-confirmou").checked = false;
          });
          linha.appendChild(entrada);
          if (campo === "inicio") linha.appendChild(li("span", " até "));
        });
        secao.appendChild(linha);
      });
      const adicionar = li("button", "+ Adicionar aula", "btn-secundario");
      adicionar.type = "button";
      adicionar.addEventListener("click", () => {
        const lista = perfil()[turno];
        if (lista.length >= 12) return mensagem("Máximo de 12 aulas por turno.", true);
        const ultimo = lista[lista.length - 1];
        const inicio = ultimo ? minutos(ultimo.fim) + 10 : ({manha: 420, tarde: 750, noite: 1140})[turno];
        const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
        if (inicio + 45 >= 1440) return mensagem("Não há espaço para outra aula no dia.", true);
        lista.push({inicio: hhmm(inicio), fim: hhmm(inicio + 45)});
        escola.horariosConfirmados = false;
        $("v2-confirmou").checked = false;
        renderizarHorarios();
      });
      secao.appendChild(adicionar);
      const remover = li("button", "Remover última", "btn-secundario");
      remover.type = "button";
      remover.style.marginLeft = "6px";
      remover.addEventListener("click", () => {
        perfil()[turno].pop();
        escola.horariosConfirmados = false;
        $("v2-confirmou").checked = false;
        renderizarHorarios();
      });
      secao.appendChild(remover);
      destino.appendChild(secao);
    });
    $("v2-confirmou").checked = Boolean(escola.horariosConfirmados);
  }

  function atualizarTurmas() {
    const select = $("v2-turma");
    const anterior = select.value;
    select.replaceChildren();
    select.appendChild(new Option("Selecione uma turma", ""));
    turmas.forEach(t => select.appendChild(new Option(t.nome, t.id)));
    if (turmas.some(t => t.id === anterior)) select.value = anterior;
    else if (selecionada && turmas.some(t => t.id === selecionada)) select.value = selecionada;
    selecionada = select.value || null;
    carregarTurmaSelecionada();
  }

  function carregarTurmaSelecionada() {
    const turma = turmas.find(t => t.id === selecionada);
    $("v2-editor").hidden = !turma;
    if (!turma) return;
    $("v2-turno").value = turma.turnoRegular || "manha";
    $("v2-modelo").value = "personalizado";
    $("v2-extra").hidden = true;
    // Nunca inventa o turno nem o contraturno de cadastros antigos.
    // O usuario deve escolher explicitamente um modelo V2.
    agendaRascunho = turma.agenda ? copiar(turma.agenda) : {};
    renderizarGradeAgenda();
  }

  function renderizarGradeAgenda() {
    const destino = $("v2-grade-agenda");
    destino.replaceChildren();
    const tabela = li("table");
    tabela.style.width = "100%";
    tabela.style.borderCollapse = "collapse";
    const trh = li("tr");
    ["Dia", "Manhã", "Tarde", "Noite"].forEach(v => trh.appendChild(li("th", v)));
    tabela.appendChild(trh);
    DIAS.forEach(dia => {
      const tr = li("tr");
      tr.appendChild(li("th", dia[0].toUpperCase() + dia.slice(1)));
      TURNOS.forEach(turno => {
        const td = li("td");
        const seletor = li("select");
        const max = perfil()[turno].length;
        for (let i = 0; i <= max; i++) seletor.appendChild(new Option(String(i), String(i)));
        const lista = agendaRascunho[dia]?.[turno] || [];
        seletor.value = String(lista.length);
        seletor.setAttribute("aria-label", `${dia} ${NOMES[turno]}`);
        seletor.addEventListener("change", () => {
          const quantidade = Number(seletor.value);
          agendaRascunho[dia] ||= {};
          if (quantidade) agendaRascunho[dia][turno] = Array.from({length: quantidade}, (_, i) => i + 1);
          else delete agendaRascunho[dia][turno];
          if (!Object.keys(agendaRascunho[dia]).length) delete agendaRascunho[dia];
          atualizarTotal();
        });
        td.appendChild(seletor);
        tr.appendChild(td);
      });
      tabela.appendChild(tr);
    });
    destino.appendChild(tabela);
    atualizarTotal();
  }

  function atualizarTotal() {
    $("v2-total-aulas").textContent = `Carga semanal desta turma: ${contar(agendaRascunho)} aulas.`;
  }

  $("v2-turma").addEventListener("change", event => {
    selecionada = event.target.value;
    carregarTurmaSelecionada();
  });
  $("v2-modelo").addEventListener("change", () => {
    $("v2-extra").hidden = !["30extra", "integral"].includes($("v2-modelo").value);
  });
  $("v2-turno").addEventListener("change", () => {
    if ($("v2-turno").value === $("v2-turno-extra").value) {
      $("v2-turno-extra").value = $("v2-turno").value === "manha" ? "tarde" : "manha";
    }
  });
  $("v2-aplicar-modelo").addEventListener("click", () => {
    try {
      const tipo = $("v2-modelo").value;
      if (tipo === "personalizado") return mensagem("Edite diretamente as quantidades na tabela.");
      agendaRascunho = agendaModelo(tipo, $("v2-turno").value,
        $("v2-dia-extra").value, $("v2-turno-extra").value);
      renderizarGradeAgenda();
      mensagem("Modelo aplicado à prévia. Clique em Salvar agenda para confirmar.");
    } catch (erro) { mensagem(erro.message, true); }
  });
  $("v2-salvar-escola").addEventListener("click", () => {
    try {
      escola.horariosConfirmados = $("v2-confirmou").checked;
      validarEscola();
      for (const turma of turmas) {
        if (!turma.agenda) continue;
        normalizarAgenda(turma.agenda);
      }
      escola.nome = JSON.parse(localStorage.getItem("grademestre_config") || "{}").nome || escola.nome;
      localStorage.setItem(CHAVE_ESCOLA_V2, JSON.stringify(escola));
      if (typeof avisarGradeDesatualizada === "function") avisarGradeDesatualizada();
      renderizarGradeAgenda();
      mensagem(escola.horariosConfirmados ? "Horários V2 confirmados e salvos." : "Horários salvos como rascunho. Confirme os sinos antes de gerar.");
    } catch (erro) { mensagem(erro.message, true); }
  });
  $("v2-salvar-agenda").addEventListener("click", () => {
    try {
      const agenda = normalizarAgenda(agendaRascunho);
      const total = contar(agenda);
      if (!selecionada) throw new Error("Selecione uma turma.");
      const atualizadas = turmas.map(t => t.id === selecionada
        ? {...t, perfilHorarioId: "padrao", turnoRegular: $("v2-turno").value,
           agenda, aulasSemanais: total}
        : t);
      localStorage.setItem("grademestre_turmas", JSON.stringify(atualizadas));
      turmas = atualizadas;
      if (typeof renderizarTurmas === "function") renderizarTurmas();
      if (typeof avisarGradeDesatualizada === "function") avisarGradeDesatualizada();
      mensagem(`Agenda da turma salva: ${total} aulas/semana. O gerador V2 será conectado na próxima etapa.`);
    } catch (erro) { mensagem(erro.message, true); }
  });

  // Atualiza a lista caso novas turmas sejam cadastradas ou excluidas pelo modulo V1.
  const listaAtual = $("lista-turmas");
  if (listaAtual && typeof MutationObserver === "function") {
    new MutationObserver(() => {
      const ids = turmas.map(t => `${t.id}:${t.nome}`).join("|");
      if (ids !== $("v2-turma").dataset.ids) {
        $("v2-turma").dataset.ids = ids;
        atualizarTurmas();
      }
    }).observe(listaAtual, {childList: true});
  }

  window.GradeMestreV2 = {
    obterPayload() {
      validarEscola();
      if (!escola.horariosConfirmados) {
        throw new Error("Confirme os horários reais dos turnos antes de gerar.");
      }
      if (turmas.some(t => !t.agenda)) {
        throw new Error("Configure a agenda V2 de todas as turmas.");
      }
      const docentes = JSON.parse(localStorage.getItem("grademestre_professores") || "[]");
      for (const p of docentes) {
        if ((p.indisponibilidades || []).some(b => typeof b === "string" &&
            /:(regular|contraturno):/.test(b))) {
          throw new Error(`Bloqueios antigos de ${p.nome}: adapte os horários dos professores à V2 antes de gerar.`);
        }
      }
      return {schemaVersion: 2, escola: copiar(escola), turmas: copiar(turmas),
        professores: docentes, fixadas: {}};
    },
    total(turma) { return contar(normalizarAgenda(turma.agenda)); }
  };

  renderizarHorarios();
  atualizarTurmas();
})();
