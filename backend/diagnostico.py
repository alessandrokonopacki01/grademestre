
from collections import defaultdict

DIAS = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta"
]


def normalizar(valor):
    return " ".join(
        str(valor or "").strip().casefold().split()
    )


def posicoes_da_turma(turma, config):
    modelo = str(config.get("modelo", "6"))

    if modelo not in ("5", "6"):
        raise ValueError("Modelo escolar inválido.")

    quantidade = int(modelo)

    if quantidade == 6:
        carga = 30
    else:
        carga = int(turma.get("aulasSemanais", 30))

    if carga not in (25, 30):
        raise ValueError(
            f"Carga semanal inválida: {turma.get('nome')}."
        )

    dia_contraturno = (
        turma.get("diaContraturno")
        or config.get("contraturno", "segunda")
    )

    if (
        modelo == "5"
        and carga == 30
        and dia_contraturno not in DIAS
    ):
        raise ValueError(
            f"Dia do contraturno inválido: "
            f"{turma.get('nome')}."
        )

    posicoes = []

    for dia in DIAS:
        for aula in range(1, quantidade + 1):
            posicoes.append(
                f"{dia}:regular:{aula}"
            )

        if (
            modelo == "5"
            and carga == 30
            and dia == dia_contraturno
        ):
            for aula in range(1, 6):
                posicoes.append(
                    f"{dia}:contraturno:{aula}"
                )

    return posicoes


def capacidade_semanal(posicoes, bloqueios, limite):
    total = 0

    for dia in DIAS:
        livres = sum(
            1 for posicao in posicoes
            if posicao.startswith(f"{dia}:")
            and posicao not in bloqueios
        )

        total += min(livres, max(0, limite))

    return total


def capacidade_pares(
    posicoes,
    bloqueios,
    limite_professor,
    limite_vinculo
):
    """
    Calcula um limite superior para a quantidade
    de pares consecutivos disponíveis.

    Não considera conflitos com outras turmas.
    """
    capacidade = 0

    for dia in DIAS:
        livres_por_periodo = []

        for periodo in ("regular", "contraturno"):
            slots = [
                p for p in posicoes
                if p.startswith(f"{dia}:{periodo}:")
            ]

            sequencia = 0
            pares = 0

            for slot in slots:
                if slot not in bloqueios:
                    sequencia += 1
                else:
                    pares += sequencia // 2
                    sequencia = 0

            pares += sequencia // 2
            livres_por_periodo.append(pares)

        pares_disponiveis = sum(livres_por_periodo)

        limite_diario = min(
            max(0, limite_professor),
            max(0, limite_vinculo)
        )

        capacidade += min(
            pares_disponiveis,
            limite_diario // 2
        )

    return capacidade


def diagnosticar(dados):
    config = dados.get("config", {})
    professores = dados.get("professores", [])
    turmas = dados.get("turmas", [])

    problemas = []

    def adicionar(codigo, titulo, detalhe, sugestoes):
        problemas.append({
            "codigo": codigo,
            "titulo": titulo,
            "detalhe": detalhe,
            "tipo": "comprovado",
            "sugestoes": sugestoes
        })

    modelo = str(config.get("modelo", "6"))

    if modelo not in ("5", "6"):
        adicionar(
            "MODELO_ESCOLAR",
            "Modelo escolar inválido",
            "Configure a escola para cinco ou seis "
            "aulas regulares por dia.",
            [
                "Abra Configurações e selecione "
                "um modelo escolar válido."
            ]
        )
        return problemas

    # ==========================================
    # 1. POSIÇÕES INDIVIDUAIS DAS TURMAS
    # ==========================================

    turmas_por_nome = {}
    posicoes_turmas = {}

    for turma in turmas:
        chave = normalizar(turma.get("nome"))

        if chave in turmas_por_nome:
            adicionar(
                "TURMA_REPETIDA",
                "Turmas com nomes repetidos",
                f"O nome {turma.get('nome')} está repetido.",
                ["Revise o cadastro das turmas."]
            )
            continue

        turmas_por_nome[chave] = turma

        try:
            posicoes_turmas[chave] = posicoes_da_turma(
                turma, config
            )
        except (ValueError, TypeError) as erro:
            adicionar(
                "CONFIGURACAO_TURMA",
                f"Configuração: {turma.get('nome')}",
                str(erro),
                [
                    "Revise a carga semanal da turma.",
                    "Confira o dia do contraturno."
                ]
            )

    # União de todos os horários da escola.
    # É fundamental para verificar a carga
    # dos professores com diferentes turmas.

    posicoes_escola = set()

    for lista in posicoes_turmas.values():
        posicoes_escola.update(lista)

    # ==========================================
    # 2. REUNIR VÍNCULOS E GRUPOS COMPARTILHADOS
    # ==========================================

    cargas_por_turma = defaultdict(int)
    grupos = defaultdict(list)

    professores_por_id = {
        professor.get("id"): professor
        for professor in professores
    }

    for professor in professores:
        professor_id = professor.get("id")
        nome = professor.get(
            "nome", "Professor sem nome"
        )

        limite_dia = int(
            professor.get("maxDia", 0)
        )

        bloqueios = set(
            professor.get("indisponibilidades", [])
        )

        vinculos = professor.get("vinculos", [])

        carga_total = sum(
            int(v.get("aulas", 0))
            for v in vinculos
        )

        # ======================================
        # CAPACIDADE TOTAL DO PROFESSOR
        # ======================================

        # Considera apenas posições de turmas
        # nas quais o professor atua.
        posicoes_professor = set()

        for vinculo in vinculos:
            turma_chave = normalizar(
                vinculo.get("turma")
            )

            posicoes_professor.update(
                posicoes_turmas.get(
                    turma_chave, []
                )
            )

        capacidade = capacidade_semanal(
            posicoes_professor,
            bloqueios,
            limite_dia
        )

        if carga_total > capacidade:
            adicionar(
                "CAPACIDADE_PROFESSOR",
                f"Capacidade insuficiente: {nome}",
                (
                    f"{nome} possui {carga_total} aulas "
                    f"semanais, mas seus horários "
                    f"disponíveis e o limite diário "
                    f"permitem no máximo {capacidade}."
                ),
                [
                    "Revise as indisponibilidades.",
                    "Confira o limite diário.",
                    "Verifique os contraturnos "
                    "das turmas atendidas."
                ]
            )

        # ======================================
        # CAPACIDADE INDIVIDUAL DOS VÍNCULOS
        # ======================================

        for vinculo in vinculos:
            turma_nome = vinculo.get("turma", "")
            turma_chave = normalizar(turma_nome)

            disciplina = vinculo.get(
                "disciplina", ""
            )

            aulas = int(
                vinculo.get("aulas", 0)
            )

            max_vinculo = int(
                vinculo.get("maxDia", 0)
            )

            codigo = normalizar(
                vinculo.get("grupoCompartilhado")
            )

            if turma_chave not in turmas_por_nome:
                adicionar(
                    "TURMA_INEXISTENTE",
                    f"Turma não encontrada: {turma_nome}",
                    (
                        f"{nome} possui um vínculo com "
                        f"uma turma não cadastrada."
                    ),
                    [
                        "Confira o nome da turma no "
                        "cadastro do professor."
                    ]
                )
                continue

            if turma_chave not in posicoes_turmas:
                continue

            # Vínculos comuns são independentes.
            # Compartilhados entram no mesmo grupo.
            if codigo:
                chave_grupo = (
                    "compartilhado",
                    turma_chave,
                    codigo
                )
            else:
                chave_grupo = (
                    "individual",
                    professor_id,
                    turma_chave,
                    normalizar(disciplina)
                )

            grupos[chave_grupo].append({
                "professor": professor,
                "vinculo": vinculo,
                "aulas": aulas,
                "maxDia": max_vinculo,
                "disciplina": disciplina,
                "turma": turma_nome,
                "turmaChave": turma_chave,
                "codigo": codigo
            })

            posicoes_vinculo = (
                posicoes_turmas[turma_chave]
            )

            capacidade_vinculo = capacidade_semanal(
                posicoes_vinculo,
                bloqueios,
                min(limite_dia, max_vinculo)
            )

            if aulas > capacidade_vinculo:
                adicionar(
                    "CAPACIDADE_DISCIPLINA",
                    f"{disciplina} — {turma_nome}",
                    (
                        f"{nome} precisa ministrar "
                        f"{aulas} aulas, mas possui "
                        f"capacidade para apenas "
                        f"{capacidade_vinculo} nessa turma."
                    ),
                    [
                        "Confira as indisponibilidades.",
                        "Revise os limites diários.",
                        "Verifique se essa turma "
                        "possui contraturno."
                    ]
                )

            # ==================================
            # AULAS GEMINADAS
            # ==================================

            pares = (
                int(vinculo.get(
                    "paresGeminados", 0
                ))
                if vinculo.get("geminadas")
                == "obrigatoria"
                else 0
            )

            if pares > 0:
                max_pares = capacidade_pares(
                    posicoes_vinculo,
                    bloqueios,
                    limite_dia,
                    max_vinculo
                )

                if pares > max_pares:
                    adicionar(
                        "GEMINADAS_IMPOSSIVEIS",
                        (
                            f"Aulas geminadas: "
                            f"{disciplina} — {turma_nome}"
                        ),
                        (
                            f"Foram exigidos {pares} pares "
                            f"para {nome}, mas existem "
                            f"no máximo {max_pares} pares "
                            f"compatíveis com seus bloqueios "
                            f"e limites diários."
                        ),
                        [
                            "Confira os horários consecutivos.",
                            "Revise os limites diários.",
                            "Reduza os pares obrigatórios, "
                            "se permitido."
                        ]
                    )

    # ==========================================
    # 3. VALIDAR DOCÊNCIA COMPARTILHADA
    # ==========================================

    for chave_grupo, membros in grupos.items():
        principal = membros[0]
        codigo = principal["codigo"]
        turma_chave = principal["turmaChave"]

        ids = [
            membro["professor"].get("id")
            for membro in membros
        ]

        if len(ids) != len(set(ids)):
            adicionar(
                "PROFESSOR_REPETIDO_GRUPO",
                "Professor repetido",
                (
                    f"Há professores repetidos no grupo "
                    f"{codigo or principal['disciplina']}."
                ),
                [
                    "Confira os vínculos compartilhados."
                ]
            )
            continue

        if codigo and len(membros) < 2:
            adicionar(
                "GRUPO_INCOMPLETO",
                f"Grupo incompleto: {codigo}",
                (
                    f"O grupo compartilhado {codigo} "
                    f"da turma {principal['turma']} "
                    f"possui apenas um professor."
                ),
                [
                    "Associe outro professor ao mesmo grupo.",
                    "Ou retire o código de compartilhamento."
                ]
            )
            continue

        referencia = principal["vinculo"]

        inconsistente = False

        for membro in membros[1:]:
            vinculo = membro["vinculo"]

            if (
                membro["aulas"] != principal["aulas"]
                or normalizar(membro["disciplina"])
                != normalizar(principal["disciplina"])
                or vinculo.get("geminadas", "livre")
                != referencia.get("geminadas", "livre")
                or int(vinculo.get(
                    "paresGeminados", 0
                ))
                != int(referencia.get(
                    "paresGeminados", 0
                ))
            ):
                inconsistente = True

        if inconsistente:
            adicionar(
                "GRUPO_INCONSISTENTE",
                f"Grupo compartilhado: {codigo}",
                (
                    "Os professores de um grupo "
                    "compartilhado precisam ter a mesma "
                    "disciplina, quantidade de aulas "
                    "e configuração de geminadas."
                ),
                [
                    "Revise os vínculos dos participantes.",
                    "Padronize aulas e pares geminados."
                ]
            )
            continue

        # Uma aula compartilhada conta
        # UMA vez na carga da turma.
        cargas_por_turma[turma_chave] += (
            principal["aulas"]
        )

        if not codigo:
            continue

        # ======================================
        # DISPONIBILIDADE COMUM DOS PARTICIPANTES
        # ======================================

        posicoes_grupo = (
            posicoes_turmas[turma_chave]
        )

        bloqueios_conjuntos = set()
        limite_grupo = principal["maxDia"]

        for membro in membros:
            professor = membro["professor"]

            bloqueios_conjuntos.update(
                professor.get(
                    "indisponibilidades", []
                )
            )

            limite_grupo = min(
                limite_grupo,
                membro["maxDia"],
                int(professor.get("maxDia", 0))
            )

        capacidade_grupo = capacidade_semanal(
            posicoes_grupo,
            bloqueios_conjuntos,
            limite_grupo
        )

        if principal["aulas"] > capacidade_grupo:
            adicionar(
                "CAPACIDADE_COMPARTILHADA",
                f"Docência compartilhada: {codigo}",
                (
                    f"O grupo {codigo} precisa de "
                    f"{principal['aulas']} aulas, mas "
                    f"os participantes possuem somente "
                    f"{capacidade_grupo} horários "
                    f"compatíveis em comum."
                ),
                [
                    "Compare as indisponibilidades.",
                    "Revise os limites diários.",
                    "Confira os horários dessa turma."
                ]
            )

        pares = (
            int(referencia.get(
                "paresGeminados", 0
            ))
            if referencia.get("geminadas")
            == "obrigatoria"
            else 0
        )

        if pares > 0:
            max_pares = capacidade_pares(
                posicoes_grupo,
                bloqueios_conjuntos,
                limite_grupo,
                limite_grupo
            )

            if pares > max_pares:
                adicionar(
                    "GEMINADAS_COMPARTILHADAS",
                    f"Geminadas compartilhadas: {codigo}",
                    (
                        f"O grupo {codigo} exige {pares} "
                        f"pares, mas os participantes "
                        f"possuem no máximo {max_pares} "
                        f"pares consecutivos disponíveis "
                        f"em comum."
                    ),
                    [
                        "Compare os bloqueios dos professores.",
                        "Revise os limites diários.",
                        "Confira o contraturno da turma."
                    ]
                )

    # ==========================================
    # 4. CONFERIR CARGA DE CADA TURMA
    # ==========================================

    for turma in turmas:
        nome = turma.get("nome", "")
        chave = normalizar(nome)

        if chave not in posicoes_turmas:
            continue

        necessario = len(
            posicoes_turmas[chave]
        )

        total = cargas_por_turma[chave]

        if total != necessario:
            adicionar(
                "CARGA_TURMA",
                f"Carga semanal: {nome}",
                (
                    f"A turma possui {total} aulas "
                    f"cadastradas, mas precisa de "
                    f"exatamente {necessario}."
                ),
                [
                    "Confira as disciplinas cadastradas.",
                    "Revise as aulas semanais da turma.",
                    "Verifique os grupos compartilhados.",
                    "Confira a configuração do contraturno."
                ]
            )

    return problemas
