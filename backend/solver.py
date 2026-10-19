
from collections import defaultdict
from ortools.sat.python import cp_model
from diagnostico import diagnosticar

DIAS = ["segunda", "terca", "quarta", "quinta", "sexta"]


def gerar_posicoes(config):
    modelo = str(config.get("modelo", "6"))
    if modelo not in ("5", "6"):
        raise ValueError("Modelo escolar inválido.")

    contraturno = config.get("contraturno", "segunda")
    if modelo == "5" and contraturno not in DIAS:
        raise ValueError("Dia do contraturno inválido.")

    posicoes = []
    quantidade = int(modelo)

    for dia in DIAS:
        for n in range(1, quantidade + 1):
            posicoes.append(f"{dia}:regular:{n}")

        if modelo == "5" and dia == contraturno:
            for n in range(1, 6):
                posicoes.append(f"{dia}:contraturno:{n}")

    return posicoes


def gerar_horarios(dados):
    turmas = dados.get("turmas", [])
    professores = dados.get("professores", [])
    config = dados.get("config", {})
    fixadas = dados.get("fixadas", {})

    if not isinstance(turmas, list) or not turmas:
        raise ValueError("Cadastre pelo menos uma turma.")

    if not isinstance(professores, list) or not professores:
        raise ValueError("Cadastre os professores.")

    if not isinstance(fixadas, dict):
        raise ValueError("Formato de aulas fixadas inválido.")

    posicoes = gerar_posicoes(config)
    conjunto_posicoes = set(posicoes)

    ids_turmas = [t["id"] for t in turmas]
    ids_professores = [p["id"] for p in professores]

    if len(set(ids_turmas)) != len(ids_turmas):
        raise ValueError("Existem identificadores de turmas repetidos.")

    if len(set(ids_professores)) != len(ids_professores):
        raise ValueError("Existem professores com IDs repetidos.")

    turmas_por_id = {t["id"]: t for t in turmas}
    professores_por_id = {p["id"]: p for p in professores}

    def normalizar(valor):
        return " ".join(str(valor).strip().casefold().split())

    turmas_por_nome = {}

    for turma in turmas:
        nome = normalizar(turma["nome"])
        if nome in turmas_por_nome:
            raise ValueError("Existem turmas com nomes repetidos.")
        turmas_por_nome[nome] = turma["id"]


    # DIAGNÓSTICO PRELIMINAR
    problemas = diagnosticar(dados)

    if problemas:
        return {
            "sucesso": False,
            "situacao": "inviavel",
            "mensagem": "Foram encontradas restrições impossíveis.",
            "diagnostico": problemas
        }

    # Cada vínculo equivale a uma disciplina ministrada
    # por um professor para uma turma específica.
    vinculos = []
    chaves_vinculos = set()
    carga_turmas = defaultdict(int)

    for professor in professores:
        professor_id = professor["id"]

        max_dia = int(professor.get("maxDia", 0))
        if max_dia < 1:
            raise ValueError(
                f"Limite diário inválido para {professor['nome']}."
            )

        for vinculo in professor.get("vinculos", []):
            turma_id = turmas_por_nome.get(
                normalizar(vinculo.get("turma", ""))
            )

            if turma_id is None:
                raise ValueError(
                    f"Turma não cadastrada: {vinculo.get('turma')}"
                )

            disciplina = str(vinculo.get("disciplina", "")).strip()
            aulas = int(vinculo.get("aulas", 0))
            limite = int(vinculo.get("maxDia", 0))

            if not disciplina or aulas < 1 or limite < 1:
                raise ValueError("Existe um vínculo incompleto.")

            chave = (professor_id, turma_id, normalizar(disciplina))

            if chave in chaves_vinculos:
                raise ValueError("Existem vínculos repetidos.")

            chaves_vinculos.add(chave)

          
            geminadas = vinculo.get("geminadas", "livre")

            pares = int(vinculo.get("paresGeminados", 0))

            if geminadas not in ("livre", "obrigatoria"):
                raise ValueError(
                    f"Configuração geminada inválida em {disciplina}."
                )

            if geminadas == "livre":
                pares = 0

            if pares < 0 or 2 * pares > aulas:
                raise ValueError(
                    f"Quantidade de pares inválida em {disciplina}."
                )

            if geminadas == "obrigatoria":
                if pares < 1 or limite < 2 or max_dia < 2:
                    raise ValueError(
                        f"Revise os pares e os limites diários "
                        f"de {disciplina}."
                    )

            vinculos.append({
                "professorId": professor_id,
                "turmaId": turma_id,
                "disciplina": disciplina,
                "aulas": aulas,
                "maxDia": limite,
                "geminadas": geminadas,
                "paresGeminados": pares
            })


            carga_turmas[turma_id] += aulas

    for turma in turmas:
        total = carga_turmas[turma["id"]]

        if total != 30:
            raise ValueError(
                f"A turma {turma['nome']} possui {total} "
                f"aulas cadastradas. São necessárias 30."
            )

    modelo = cp_model.CpModel()

    # x[(vinculo, posicao)] = 1 se aquela aula
    # estiver alocada na posição especificada.
    x = {}

    for i, vinculo in enumerate(vinculos):
        professor = professores_por_id[vinculo["professorId"]]

        bloqueios = set(
            professor.get("indisponibilidades", [])
        )

        for posicao in posicoes:
            if posicao in bloqueios:
                continue

            x[(i, posicao)] = modelo.new_bool_var(
                f"aula_{i}_{posicao}"
            )

    def variaveis(i=None, turma=None, professor=None,
                  dia=None, posicao=None):
        resultado = []

        for (indice, slot), variavel in x.items():
            vinculo = vinculos[indice]

            if i is not None and indice != i:
                continue

            if turma is not None and vinculo["turmaId"] != turma:
                continue

            if professor is not None and vinculo["professorId"] != professor:
                continue

            if dia is not None and slot.split(":")[0] != dia:
                continue

            if posicao is not None and slot != posicao:
                continue

            resultado.append(variavel)

        return resultado

    # REGRA 1: Cumprir exatamente cada carga semanal.
    for i, vinculo in enumerate(vinculos):
        modelo.add(
            sum(variaveis(i=i)) == vinculo["aulas"]
        )

    # REGRA 2: Cada turma terá exatamente uma aula
    # em cada uma das 30 posições semanais.
    for turma in turmas:
        for posicao in posicoes:
            modelo.add(
                sum(variaveis(
                    turma=turma["id"],
                    posicao=posicao
                )) == 1
            )

    # REGRA 3: Um professor não pode ocupar
    # duas turmas ao mesmo tempo.
    for professor in professores:
        for posicao in posicoes:
            modelo.add(
                sum(variaveis(
                    professor=professor["id"],
                    posicao=posicao
                )) <= 1
            )

    # REGRA 4: Limite total diário de cada professor.
    for professor in professores:
        for dia in DIAS:
            modelo.add(
                sum(variaveis(
                    professor=professor["id"],
                    dia=dia
                )) <= int(professor["maxDia"])
            )

    # REGRA 5: Limite diário por disciplina/turma.
    for i, vinculo in enumerate(vinculos):
        for dia in DIAS:
            modelo.add(
                sum(variaveis(i=i, dia=dia)) <=
                vinculo["maxDia"]
            )

    # REGRA: AULAS GEMINADAS OBRIGATÓRIAS
    #
    # Um par ocupa duas posições consecutivas
    # da mesma disciplina, turma e professor.
    #
    # Não permitimos pares sobrepostos nem
    # pares que atravessem regular/contraturno.

    for i, vinculo in enumerate(vinculos):
        quantidade_pares = vinculo.get("paresGeminados", 0)

        if vinculo.get("geminadas") != "obrigatoria":
            continue

        if quantidade_pares <= 0:
            continue

        inicios = []
        pares_por_posicao = defaultdict(list)

        for dia in DIAS:
            for periodo in ("regular", "contraturno"):

                slots = [
                    p for p in posicoes
                    if p.split(":")[0] == dia
                    and p.split(":")[1] == periodo
                ]

                for j in range(len(slots) - 1):
                    primeira = slots[j]
                    segunda = slots[j + 1]

                    # Só cria o par se ambas as posições
                    # estiverem disponíveis ao professor.
                    if (i, primeira) not in x:
                        continue

                    if (i, segunda) not in x:
                        continue

                    par = modelo.new_bool_var(
                        f"geminado_{i}_{dia}_{periodo}_{j}"
                    )

                    # Escolher o par obriga a alocação
                    # das duas aulas consecutivas.
                    modelo.add(
                        x[(i, primeira)] == 1
                    ).only_enforce_if(par)

                    modelo.add(
                        x[(i, segunda)] == 1
                    ).only_enforce_if(par)

                    inicios.append(par)
                    pares_por_posicao[primeira].append(par)
                    pares_por_posicao[segunda].append(par)

        # Cada aula poderá pertencer a no máximo
        # um dos pares obrigatórios escolhidos.
        for slot, pares_do_slot in pares_por_posicao.items():
            modelo.add(sum(pares_do_slot) <= 1)

        # Obriga o número solicitado de pares
        # distintos durante a semana.
        modelo.add(
            sum(inicios) == quantidade_pares
        )

    # REGRA 6: Respeitar as aulas fixadas manualmente.
    for chave, atribuicao in fixadas.items():
        if "|" not in chave or not isinstance(atribuicao, dict):
            raise ValueError("Aula fixada inválida.")

        turma_id, posicao = chave.split("|", 1)

        if turma_id not in turmas_por_id or posicao not in conjunto_posicoes:
            raise ValueError("Uma aula fixada está fora da grade.")

        correspondente = [
            i for i, v in enumerate(vinculos)
            if v["turmaId"] == turma_id
            and v["professorId"] == atribuicao.get("professorId")
            and normalizar(v["disciplina"]) ==
                normalizar(atribuicao.get("disciplina", ""))
        ]

        if len(correspondente) != 1:
            raise ValueError("Vínculo de aula fixada não encontrado.")

        variavel = x.get((correspondente[0], posicao))

        if variavel is None:
            raise ValueError(
                "Uma aula fixada viola a disponibilidade do professor."
            )

        modelo.add(variavel == 1)

    # Preferência: manter as aulas de cada vínculo
    # distribuídas por mais dias, quando possível.
    penalidades = []

    for i, vinculo in enumerate(vinculos):
        for dia in DIAS:
            vars_dia = variaveis(i=i, dia=dia)

            if not vars_dia:
                continue

            excesso = modelo.new_int_var(
                0, len(vars_dia), f"excesso_{i}_{dia}"
            )

            modelo.add(excesso >= sum(vars_dia) - 1)
            penalidades.append(excesso)

    
    # OTIMIZAÇÃO: REDUZIR JANELAS DOS PROFESSORES

    penalidades_janelas = []

    for professor in professores:
        professor_id = professor["id"]

        for dia in DIAS:
            # Regular e contraturno são considerados
            # períodos separados.
            for periodo in ("regular", "contraturno"):

                slots = [
                    p for p in posicoes
                    if p.split(":")[0] == dia
                    and p.split(":")[1] == periodo
                ]

                if len(slots) < 3:
                    continue

                ocupados = []

                for posicao in slots:
                    ocupado = modelo.new_bool_var(
                        f"ocupado_{professor_id}_{posicao}"
                    )

                    modelo.add(
                        sum(variaveis(
                            professor=professor_id,
                            posicao=posicao
                        )) == ocupado
                    )

                    ocupados.append(ocupado)

                # Uma janela é uma posição vazia
                # com pelo menos uma aula antes e outra depois.
                for indice in range(1, len(slots) - 1):

                    anterior = modelo.new_bool_var(
                        f"antes_{professor_id}_{dia}_"
                        f"{periodo}_{indice}"
                    )

                    posterior = modelo.new_bool_var(
                        f"depois_{professor_id}_{dia}_"
                        f"{periodo}_{indice}"
                    )

                    janela = modelo.new_bool_var(
                        f"janela_{professor_id}_{dia}_"
                        f"{periodo}_{indice}"
                    )

                    modelo.add_max_equality(
                        anterior,
                        ocupados[:indice]
                    )

                    modelo.add_max_equality(
                        posterior,
                        ocupados[indice + 1:]
                    )

                    # Janela = anterior E posterior
                    #          E NÃO ocupado.
                    modelo.add(janela <= anterior)
                    modelo.add(janela <= posterior)
                    modelo.add(janela + ocupados[indice] <= 1)

                    modelo.add(
                        janela >= anterior + posterior
                        - ocupados[indice] - 1
                    )

                    penalidades_janelas.append(janela)

    # Janelas têm prioridade sobre a preferência
    # anterior de distribuir disciplinas.
    PESO_JANELAS = 100
    PESO_DISTRIBUICAO = 1

    modelo.minimize(
        PESO_JANELAS * sum(penalidades_janelas)
        + PESO_DISTRIBUICAO * sum(penalidades)
    )


    resolvedor = cp_model.CpSolver()
    resolvedor.parameters.max_time_in_seconds = 25.0
    resolvedor.parameters.num_search_workers = 4

    status = resolvedor.solve(modelo)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):

        if status == cp_model.INFEASIBLE:
            return {
                "sucesso": False,
                "situacao": "inviavel",
                "mensagem": (
                    "O algoritmo comprovou que não existe "
                    "uma solução com as restrições atuais."
                ),
                "diagnostico": [
                    {
                        "codigo": "CONFLITO_COMBINADO",
                        "titulo": "Restrições incompatíveis",
                        "detalhe": (
                            "As verificações individuais não "
                            "identificaram uma causa suficiente. "
                            "Entretanto, a combinação das regras "
                            "torna a grade impossível."
                        ),
                        "tipo": "possivel",
                        "sugestoes": [
                            "Revise as aulas geminadas obrigatórias.",
                            "Confira as indisponibilidades compartilhadas.",
                            "Revise os limites diários.",
                            "Verifique as aulas fixadas manualmente."
                        ]
                    }
                ]
            }


        return {
            "sucesso": False,
            "situacao": "limite_ou_erro",
            "mensagem": (
                "Não foi encontrada solução no tempo disponível. "
                "Isso não prova que o horário seja impossível."
            )
        }

    resultado = {}

    for (i, posicao), variavel in x.items():
        if resolvedor.value(variavel) == 1:
            vinculo = vinculos[i]

            chave = f"{vinculo['turmaId']}|{posicao}"

            resultado[chave] = {
                "professorId": vinculo["professorId"],
                "disciplina": vinculo["disciplina"]
            }

    return {
        "sucesso": True,
        "situacao": (
            "otima" if status == cp_model.OPTIMAL
            else "viavel"
        ),
        "totalAulas": len(resultado),
        "grade": resultado
    }
