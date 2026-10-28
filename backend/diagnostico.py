
from collections import defaultdict

DIAS = ["segunda", "terca", "quarta", "quinta", "sexta"]


def diagnosticar(dados):
    config = dados.get("config", {})
    professores = dados.get("professores", [])
    turmas = dados.get("turmas", [])

    modelo = str(config.get("modelo", "6"))
    contraturno = config.get("contraturno", "segunda")

    if modelo not in ("5", "6"):
        return []

    quantidade = int(modelo)
    posicoes = []

    for dia in DIAS:
        for aula in range(1, quantidade + 1):
            posicoes.append(f"{dia}:regular:{aula}")

        if modelo == "5" and dia == contraturno:
            for aula in range(1, 6):
                posicoes.append(f"{dia}:contraturno:{aula}")

    problemas = []

    def adicionar(codigo, titulo, detalhe, sugestoes):
        problemas.append({
            "codigo": codigo,
            "titulo": titulo,
            "detalhe": detalhe,
            "tipo": "comprovado",
            "sugestoes": sugestoes
        })

    cargas_por_turma = defaultdict(int)
    grupos_contabilizados = set()

    for professor in professores:
        nome = professor.get("nome", "Professor sem nome")
        limite_dia = int(professor.get("maxDia", 0))
        bloqueios = set(professor.get("indisponibilidades", []))
        vinculos = professor.get("vinculos", [])

        carga_total = sum(
            int(v.get("aulas", 0)) for v in vinculos
        )

        livres = [
            p for p in posicoes if p not in bloqueios
        ]

        capacidade = 0
        livres_por_dia = {}

        for dia in DIAS:
            quantidade_livre = sum(
                1 for p in livres
                if p.split(":")[0] == dia
            )

            livres_por_dia[dia] = quantidade_livre

            capacidade += min(
                quantidade_livre,
                max(0, limite_dia)
            )

        if carga_total > capacidade:
            adicionar(
                "CAPACIDADE_PROFESSOR",
                f"Capacidade insuficiente: {nome}",
                (
                    f"{nome} possui {carga_total} aulas semanais, "
                    f"mas seus horários disponíveis e o limite "
                    f"diário permitem no máximo {capacidade}."
                ),
                [
                    "Revise as indisponibilidades do professor.",
                    "Confira o limite máximo diário.",
                    "Avalie a redistribuição de aulas."
                ]
            )

        for vinculo in vinculos:
            turma = vinculo.get("turma", "")
            disciplina = vinculo.get("disciplina", "")
            aulas = int(vinculo.get("aulas", 0))
            max_vinculo = int(vinculo.get("maxDia", 0))


            turma_chave = " ".join(
                turma.strip().casefold().split()
            )

            grupo = str(
                vinculo.get("grupoCompartilhado") or ""
            ).strip().casefold()

            if grupo:
                chave_grupo = (turma_chave, grupo)

                if chave_grupo not in grupos_contabilizados:
                    grupos_contabilizados.add(chave_grupo)
                    cargas_por_turma[turma_chave] += aulas
            else:
                cargas_por_turma[turma_chave] += aulas


            capacidade_vinculo = sum(
                min(
                    livres_por_dia[dia],
                    max(0, limite_dia),
                    max(0, max_vinculo)
                )
                for dia in DIAS
            )

            if aulas > capacidade_vinculo:
                adicionar(
                    "CAPACIDADE_DISCIPLINA",
                    f"{disciplina} — {turma}",
                    (
                        f"{nome} precisa ministrar {aulas} aulas, "
                        f"mas há capacidade para no máximo "
                        f"{capacidade_vinculo}, considerando "
                        f"as restrições cadastradas."
                    ),
                    [
                        "Revise o limite diário dessa disciplina.",
                        "Confira os horários indisponíveis.",
                        "Verifique a carga semanal do vínculo."
                    ]
                )

            pares = (
                int(vinculo.get("paresGeminados", 0))
                if vinculo.get("geminadas") == "obrigatoria"
                else 0
            )

            if pares <= 0:
                continue

            # Limite superior seguro: mesmo ignorando
            # conflitos com outras turmas, quantos pares
            # consecutivos poderiam ser formados?
            capacidade_pares = 0

            for dia in DIAS:
                pares_dia = 0

                for periodo in ("regular", "contraturno"):
                    slots = [
                        p for p in posicoes
                        if p.startswith(f"{dia}:{periodo}:")
                    ]

                    sequencia = 0

                    for slot in slots:
                        if slot not in bloqueios:
                            sequencia += 1
                        else:
                            pares_dia += sequencia // 2
                            sequencia = 0

                    pares_dia += sequencia // 2

                capacidade_pares += min(
                    pares_dia,
                    max(0, max_vinculo) // 2,
                    max(0, limite_dia) // 2
                )

            if pares > capacidade_pares:
                adicionar(
                    "GEMINADAS_IMPOSSIVEIS",
                    f"Aulas geminadas: {disciplina} — {turma}",
                    (
                        f"Foram exigidos {pares} pares de {disciplina} "
                        f"com {nome}, mas suas disponibilidades e "
                        f"limites permitem no máximo "
                        f"{capacidade_pares} pares."
                    ),
                    [
                        "Confira se há duas aulas consecutivas disponíveis.",
                        "Revise os limites diários.",
                        "Reduza os pares obrigatórios, se permitido."
                    ]
                )

    for turma in turmas:
        nome = turma.get("nome", "")
        total = cargas_por_turma[nome.strip().casefold()]

        if total != 30:
            adicionar(
                "CARGA_TURMA",
                f"Carga semanal: {nome}",
                (
                    f"A turma possui {total} aulas cadastradas. "
                    f"São necessárias exatamente 30."
                ),
                [
                    "Confira as disciplinas cadastradas.",
                    "Revise a quantidade semanal de cada vínculo."
                ]
            )

    return problemas
