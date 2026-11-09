
/*
 * GradeMestre — Acabamento visual da V2
 * Estiliza a interface, oculta colunas sem aulas por turno
 * e imprime uma grade mais limpa.
 *
 * Carregar DEPOIS de interface_unificada_v2.js.
 * Nao altera os dados nem a edicao manual.
 */
(() => {
  "use strict";

  const area = document.getElementById("v2-resultado-grade");
  const painel = document.getElementById("painel-gerador-v2");

  if (!area || !painel) {
    console.warn(
      "GradeMestre: painel da grade V2 nao encontrado."
    );
    return;
  }

  // ==========================================
  // 1. APARENCIA DO SISTEMA E DA GRADE
  // ==========================================

  const estilo = document.createElement("style");
  estilo.id = "gm-v2-estilo-profissional";

  estilo.textContent = `
    :root {
      --fundo: #f4f6f9;
      --sidebar: #111827;
      --primary: #ac8034;
      --texto: #172033;
      --cinza: #66758a;
      --borda: #e2e7ee;
      --gm-ouro: #bc9144;
      --gm-ouro-escuro: #8c6528;
      --gm-azul: #24344d;
    }

    body {
      background: var(--fundo);
    }

    .sidebar {
      background: #111827;
    }

    .sidebar .logo span {
      color: #edc77f;
    }

    .sidebar .nav-item {
      transition: background .15s, color .15s;
    }

    .sidebar .nav-item.ativo,
    .sidebar .nav-item:hover {
      background: #263146;
      color: #fff;
    }

    .sidebar .nav-item.ativo {
      box-shadow: inset 3px 0 #dab66f;
    }

    .topbar .subtitulo {
      color: var(--gm-ouro-escuro);
    }

    .etiqueta {
      background: #fff5df;
      color: #75551e;
    }

    .boas-vindas {
      background: linear-gradient(
        120deg,
        #172238,
        #31425d
      );
    }

    .boas-vindas p {
      color: #e7ecf5;
    }

    .card,
    .painel-info {
      border-color: var(--borda);
      box-shadow: 0 4px 18px
        rgba(22, 33, 52, .04);
    }

    .card strong {
      color: var(--gm-ouro-escuro);
    }

    .btn-primary {
      background: var(--gm-ouro-escuro);
      color: #fff;
    }

    .btn-primary:hover {
      background: #73511d;
    }

    .btn-secundario {
      color: #283950;
      border-color: #d7dee8;
    }

    .btn-secundario:hover {
      background: #f5f7fa;
    }

    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 3px solid #d6af65;
      outline-offset: 2px;
    }

    /* PAINEL PRINCIPAL */

    #painel-gerador-v2 {
      background: #fff;
      border: 1px solid #e0e5ed;
      border-radius: 18px !important;
      padding: clamp(16px, 2.2vw, 30px);
      box-shadow: 0 8px 32px
        rgba(21, 32, 51, .06);
    }

    #painel-gerador-v2 > h2 {
      color: #18263d;
      font-size: clamp(20px, 2.5vw, 27px);
      letter-spacing: -.5px;
      margin-bottom: 6px;
    }

    #painel-gerador-v2 > p {
      color: #66758a;
    }

    #painel-gerador-v2 > .acoes-form {
      border-top: 1px solid #ebeff4;
      padding-top: 17px;
      margin: 22px 0 16px !important;
    }

    #painel-gerador-v2 > .acoes-form button,
    #v2-controles-edicao button {
      margin-top: 0;
      min-height: 43px;
      font-weight: 700;
      font-size: 13px;
    }

    #painel-gerador-v2 button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    #v2-status-gerador:not(:empty) {
      background: #f6f9f7;
      border: 1px solid #deebe3;
      border-radius: 10px;
      padding: 12px 15px;
      font-size: 13px;
      font-weight: 600;
    }

    /* CONTROLES DA EDIÇÃO MANUAL */

    #v2-controles-edicao {
      display: flex;
      gap: 9px;
      flex-wrap: wrap;
      align-items: center;
      margin: 18px 0 9px;
      padding: 14px;
      border-radius: 12px;
      background: #f6f7fa;
      border: 1px solid #e4e9f0;
    }

    #v2-aviso-edicao {
      font-size: 13px;
      padding: 0 3px;
    }

    /* TITULO DA GRADE */

    #v2-resultado-grade {
      margin-top: 24px;
    }

    #v2-resultado-grade > h3 {
      font-size: clamp(18px, 2vw, 22px);
      color: #172238;
      margin: 0 0 5px;
      letter-spacing: -.35px;
    }

    #v2-resultado-grade > p {
      font-size: 12px;
      margin: 0 0 18px;
    }

    /* BLOCOS DOS TURNOS */

    #v2-resultado-grade > section.gm-v2-turno {
      margin: 20px 0 24px !important;
      padding: 0;
      background: #fff;
      border: 1px solid #dde4ec;
      border-radius: 14px;
      box-shadow: 0 5px 20px
        rgba(23, 34, 56, .045);
      overflow: hidden;
    }

    #v2-resultado-grade .gm-v2-turno > h3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0;
      padding: 14px 18px;
      background: #19283d;
      color: #fff;
      border-left: 5px solid #c99d56;
      font-size: 16px;
      font-weight: 750;
    }

    #v2-resultado-grade
    .gm-v2-turno--tarde > h3 {
      border-left-color: #8fb7d9;
    }

    #v2-resultado-grade
    .gm-v2-turno--noite > h3 {
      border-left-color: #b69cd3;
    }

    #v2-resultado-grade .gm-v2-contagem {
      font-size: 11px;
      font-weight: 600;
      color: #dce5ef;
      background: rgba(255, 255, 255, .1);
      padding: 5px 10px;
      border-radius: 99px;
    }

    /* TABELAS */

    #v2-resultado-grade
    .gm-v2-turno .grade-wrapper {
      margin: 0;
      border: 0;
      border-radius: 0;
      overflow-x: auto;
    }

    #v2-resultado-grade table {
      width: 100% !important;
      min-width: 0 !important;
      table-layout: auto !important;
      border-collapse: collapse;
    }

    #v2-resultado-grade th,
    #v2-resultado-grade td {
      border: 1px solid #e4eaf1;
      vertical-align: middle;
      text-align: center;
      padding: 10px 8px;
      overflow-wrap: normal;
      font-size: 12px;
    }

    #v2-resultado-grade thead th {
      background: #eff2f7;
      color: #283850;
      font-size: 12px;
      font-weight: 800;
      padding: 13px 8px;
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
    }

    #v2-resultado-grade
    thead th:first-child {
      width: 100px;
    }

    #v2-resultado-grade
    thead th:nth-child(2) {
      width: 113px;
    }

    /* DIAS DA SEMANA */

    #v2-resultado-grade tbody th[rowspan] {
      background: #f0f3f8;
      color: #21324b;
      font-weight: 800;
      border-left: 3px solid #d8ad63;
      white-space: nowrap;
    }

    /* HORARIOS DAS AULAS */

    #v2-resultado-grade
    tbody td:first-of-type {
      color: #40516b;
      background: #f8fafc;
      white-space: nowrap;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }

    /* CELULAS DE AULA */

    #v2-resultado-grade td.gm-v2-aula {
      min-width: 130px;
      height: 52px;
      background: #fff;
      transition: filter .15s,
        box-shadow .15s;
    }

    #v2-resultado-grade td.gm-v2-aula strong {
      display: block;
      font-size: 12px;
      line-height: 1.3;
      color: #20314a;
      margin-bottom: 4px;
    }

    #v2-resultado-grade td.gm-v2-aula div {
      font-size: 10.5px !important;
      line-height: 1.35;
      color: #627087;
    }

    /* CORES SUAVES POR AREA */

    #v2-resultado-grade
    td.gm-v2-matematica {
      background: #edf3ff;
    }

    #v2-resultado-grade
    td.gm-v2-linguagens {
      background: #fff1f5;
    }

    #v2-resultado-grade
    td.gm-v2-ciencias {
      background: #eaf8f0;
    }

    #v2-resultado-grade
    td.gm-v2-humanas {
      background: #fff7e7;
    }

    #v2-resultado-grade
    td.gm-v2-outras {
      background: #f1f0fa;
    }

    #v2-resultado-grade
    td.gm-v2-vazia {
      background: #f8fafc;
      color: #aab4c2 !important;
    }

    /* DESTAQUE NA EDICAO MANUAL */

    #painel-gerador-v2.gm-v2-editando
    td[data-v2-chave]:hover {
      filter: brightness(.94);
      box-shadow: inset 0 0 0 2px #bc9144;
    }

    #painel-gerador-v2
    td.gm-v2-selecionada {
      background: #ffe5a5 !important;
      box-shadow: inset 0 0 0 3px #a87922;
    }

    /* COLUNAS VAZIAS */

    #v2-resultado-grade [hidden] {
      display: none !important;
    }

    /* TELAS MENORES */

    @media (max-width: 800px) {
      #painel-gerador-v2 {
        padding: 14px;
      }

      #v2-resultado-grade
      .gm-v2-turno > h3 {
        padding: 12px;
      }

      #v2-resultado-grade th,
      #v2-resultado-grade td {
        padding: 8px 6px;
      }

      #v2-resultado-grade
      td.gm-v2-aula {
        min-width: 115px;
      }

      #v2-resultado-grade
      .gm-v2-contagem {
        font-size: 10px;
      }
    }
  `;

  document.head.appendChild(estilo);

  // ==========================================
  // 2. IDENTIFICAR DISCIPLINAS
  // ==========================================

  const semAcento = texto =>
    String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  function classeDisciplina(disciplina) {
    const d = semAcento(disciplina);

    if (
      /matematica|financeira|estatistica|raciocinio/.test(d)
    ) {
      return "gm-v2-matematica";
    }

    if (
      /portugues|redacao|literatura|ingles|espanhol|lingua/.test(d)
    ) {
      return "gm-v2-linguagens";
    }

    if (
      /fisica|quimica|biologia|ciencias/.test(d)
    ) {
      return "gm-v2-ciencias";
    }

    if (
      /historia|geografia|filosofia|sociologia|religioso/.test(d)
    ) {
      return "gm-v2-humanas";
    }

    return "gm-v2-outras";
  }

  // ==========================================
  // 3. ORGANIZAR AS TABELAS POR TURNO
  // ==========================================

  function atualizarVisual() {
    for (
      const secao
      of area.querySelectorAll("section")
    ) {
      const tabela = secao.querySelector("table");
      const cabecalho = tabela?.tHead?.rows?.[0];

      const linhas = Array.from(
        tabela?.tBodies?.[0]?.rows || []
      );

      if (
        !tabela ||
        !cabecalho ||
        !linhas.length
      ) {
        continue;
      }

      const nomeTurno = semAcento(
        secao.querySelector("h3")?.textContent
      );

      const turno =
        nomeTurno.includes("manha")
          ? "manha"
          : nomeTurno.includes("tarde")
            ? "tarde"
            : "noite";

      secao.classList.add(
        "gm-v2-turno",
        `gm-v2-turno--${turno}`
      );

      // Identificar quais turmas realmente
      // possuem aulas nesse turno.

      const totalColunas =
        cabecalho.cells.length;

      let turmasVisiveis = 0;

      for (
        let coluna = 2;
        coluna < totalColunas;
        coluna++
      ) {
        const celulas = linhas.map(linha => {
          const temDia =
            linha.cells[0]?.tagName === "TH";

          return linha.cells[
            coluna - (temDia ? 0 : 1)
          ];
        });

        const temAulas = celulas.some(
          celula => celula?.querySelector("strong")
        );

        cabecalho.cells[coluna].hidden =
          !temAulas;

        celulas.forEach(celula => {
          if (celula) {
            celula.hidden = !temAulas;
          }
        });

        if (temAulas) {
          turmasVisiveis++;
        }
      }

      // Aplicar cores às disciplinas,
      // sem alterar o conteúdo das células.

      for (
        const td
        of tabela.querySelectorAll("tbody td")
      ) {
        const titulo =
          td.querySelector("strong");

        if (titulo) {
          td.classList.add(
            "gm-v2-aula",
            classeDisciplina(titulo.textContent)
          );

          td.classList.remove(
            "gm-v2-vazia"
          );

        } else if (td.dataset.v2Chave) {
          td.classList.add(
            "gm-v2-vazia"
          );
        }
      }

      // Indicar quantas turmas estão
      // presentes em cada turno.

      let contagem =
        secao.querySelector(".gm-v2-contagem");

      if (!contagem) {
        contagem = document.createElement("span");
        contagem.className = "gm-v2-contagem";

        secao.querySelector("h3")
          ?.appendChild(contagem);
      }

      contagem.textContent =
        `${turmasVisiveis} turma${
          turmasVisiveis === 1 ? "" : "s"
        }`;
    }
  }

  // Aplicar agora e após cada nova geração
  // ou edição manual da grade.

  atualizarVisual();

  new MutationObserver(
    atualizarVisual
  ).observe(area, {
    childList: true,
    subtree: false
  });

  // ==========================================
  // 4. IMPRESSÃO PROFISSIONAL
  // ==========================================

  function imprimirGrade() {
    if (!area.querySelector("table")) {
      return;
    }

    atualizarVisual();

    const janela = window.open(
      "",
      "_blank"
    );

    if (!janela) {
      alert(
        "O navegador bloqueou a janela de " +
        "impressão. Autorize pop-ups para este site."
      );
      return;
    }

    let nomeEscola = "GradeMestre";

    try {
      const salva = JSON.parse(
        localStorage.getItem(
          "grademestre_grade_v2"
        ) || "null"
      );

      nomeEscola =
        salva?.dados?.escola?.nome ||
        nomeEscola;

    } catch (_) {
      // Manter o título padrão.
    }

    const doc = janela.document;

    doc.open();

    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Grade horária — GradeMestre</title>

        <style>
          @page {
            size: A3 landscape;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font: 10px Arial, sans-serif;
            color: #172238;
            margin: 0;
          }

          header {
            border-bottom: 2px solid #b58a43;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }

          header h1 {
            margin: 0 0 4px;
            font-size: 20px;
          }

          header p {
            margin: 0;
            font-size: 11px;
            color: #596575;
          }

          #v2-resultado-grade > h3 {
            font-size: 13px;
            margin: 0 0 3px;
          }

          #v2-resultado-grade > p {
            margin: 0 0 10px;
            color: #5a6474;
          }

          .gm-v2-turno {
            break-before: page;
            page-break-before: always;
          }

          .gm-v2-turno:first-of-type {
            break-before: auto;
            page-break-before: auto;
          }

          .gm-v2-turno > header {
            margin-bottom: 10px;
          }

          .gm-v2-turno > h3 {
            margin: 0 0 8px;
            padding: 8px 11px;
            font-size: 13px;
            background: #e8edf4;
            border-left: 4px solid #b58a43;
          }

          .gm-v2-contagem {
            float: right;
            font-size: 10px;
            color: #526173;
          }

          .grade-wrapper {
            overflow: visible;
          }

          table {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #bfc8d4;
            text-align: center;
            vertical-align: middle;
            padding: 5px 3px;
            overflow-wrap: anywhere;
          }

          thead {
            display: table-header-group;
          }

          thead th {
            background: #e9edf3;
            font-weight: 700;
            font-size: 10px;
          }

          thead th:first-child {
            width: 75px;
          }

          thead th:nth-child(2) {
            width: 91px;
          }

          tbody th[rowspan] {
            background: #f0f2f6;
            font-weight: 700;
          }

          tbody td:first-of-type {
            background: #f8fafc;
            font-weight: 600;
            white-space: nowrap;
          }

          td strong {
            display: block;
            font-size: 10px;
            margin-bottom: 2px;
          }

          td div {
            font-size: 9px !important;
            color: #48576c;
          }

          td.gm-v2-matematica {
            background: #eef3fc;
          }

          td.gm-v2-linguagens {
            background: #fff0f4;
          }

          td.gm-v2-ciencias {
            background: #edf8f1;
          }

          td.gm-v2-humanas {
            background: #fff7e7;
          }

          td.gm-v2-outras {
            background: #f3f0fa;
          }

          [hidden] {
            display: none !important;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @media print {
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>

      <body></body>
      </html>
    `);

    doc.close();

    // Cada turno recebe o nome da escola.
    // Isso identifica as páginas do PDF.

    const copia = area.cloneNode(true);

    for (
      const secao
      of copia.querySelectorAll(
        "section.gm-v2-turno"
      )
    ) {
      const cabecalho =
        doc.createElement("header");

      const titulo =
        doc.createElement("h1");

      titulo.textContent = nomeEscola;

      const subtitulo =
        doc.createElement("p");

      subtitulo.textContent =
        "Grade semanal por turno • Emitida em " +
        new Date().toLocaleDateString("pt-BR");

      cabecalho.append(
        titulo,
        subtitulo
      );

      secao.insertBefore(
        cabecalho,
        secao.firstChild
      );
    }

    doc.body.appendChild(copia);

    janela.setTimeout(() => {
      janela.focus();
      janela.print();
    }, 160);
  }

  // ==========================================
  // 5. SUBSTITUIR APENAS A IMPRESSÃO V2
  // ==========================================

  document.addEventListener(
    "click",
    evento => {
      const botao =
        evento.target.closest?.(
          "#v2-imprimir-grade"
        );

      if (!botao || botao.disabled) {
        return;
      }

      evento.preventDefault();

      // Impede somente o acionamento
      // da impressão antiga da V2.
      evento.stopImmediatePropagation();

      imprimirGrade();
    },
    true
  );

  console.info(
    "GradeMestre V2: estilo e impressão " +
    "aprimorados carregados."
  );
})();
