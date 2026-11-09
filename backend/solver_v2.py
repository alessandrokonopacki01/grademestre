
"""GradeMestre V2: gerador com horarios fisicos e agendas por turma.

Motor independente da V1. Nao substituir solver.py antes da integracao.
Requer calendario.py e ortools (ja usada pelo backend atual).
"""
from collections import defaultdict
from ortools.sat.python import cp_model
from calendario import DIAS, TURNOS, expandir_agenda, horarios_conflitam, intervalos_do_perfil, minutos


def normalizar(valor):
    return " ".join(str(valor or "").strip().casefold().split())


def inteiro(valor, campo, minimo=0):
    if isinstance(valor, bool):
        raise ValueError(f"{campo}: informe um numero inteiro.")
    try:
        n = int(valor)
    except (ValueError, TypeError) as erro:
        raise ValueError(f"{campo}: informe um numero inteiro.") from erro
    if n < minimo:
        raise ValueError(f"{campo}: valor minimo {minimo}.")
    return n


def normalizar_bloqueios(professor, escola):
    """Aceita IDs fisicos V2 ou intervalos reais; proibe codigos V1 ambiguos."""
    resultado = []
    for bruto in professor.get("indisponibilidades", []):
        if isinstance(bruto, str):
            partes = bruto.split(":")
            if len(partes) == 4:
                dia, perfil_id, turno, ordem = partes
            elif len(partes) == 3 and partes[1] in TURNOS:
                dia, turno, ordem = partes
                perfil_id = "padrao"
            else:
                raise ValueError(
                    f"Bloqueio antigo ou invalido de {professor['nome']}: {bruto}. "
                    "Converta indisponibilidades para horarios V2."
                )
            if dia not in DIAS or turno not in TURNOS:
                raise ValueError(f"Bloqueio invalido: {bruto}.")
            periodos = intervalos_do_perfil(escola, perfil_id)[turno]
            ordem = inteiro(ordem, f"Aula bloqueada ({bruto})", 1)
            if ordem > len(periodos):
                raise ValueError(f"Aula bloqueada inexistente: {bruto}.")
            aula = periodos[ordem - 1]
            resultado.append({"dia": dia, "inicioMin": aula["inicioMin"], "fimMin": aula["fimMin"]})
        elif isinstance(bruto, dict):
            dia = bruto.get("dia")
            if dia not in DIAS:
                raise ValueError(f"Dia de bloqueio invalido: {dia}.")
            inicio = minutos(bruto.get("inicio"))
            fim = minutos(bruto.get("fim"))
            if fim <= inicio:
                raise ValueError(f"Bloqueio com intervalo invalido: {bruto}.")
            resultado.append({"dia": dia, "inicioMin": inicio, "fimMin": fim})
        else:
            raise ValueError(f"Bloqueio de {professor['nome']} com formato invalido.")
    return resultado


def gerar_horarios_v2(dados):
    """Gera aulas nas agendas V2, bloqueando choques pelo horario fisico."""
    if dados.get("schemaVersion") != 2:
        raise ValueError("O solver V2 exige schemaVersion=2.")

    escola = dados.get("escola")
    turmas = dados.get("turmas")
    professores = dados.get("professores")
    fixadas = dados.get("fixadas", {})
    if not isinstance(escola, dict):
        raise ValueError("Configuracao da escola V2 ausente.")
    if not isinstance(turmas, list) or not turmas:
        raise ValueError("Cadastre pelo menos uma turma.")
    if not isinstance(professores, list) or not professores:
        raise ValueError("Cadastre pelo menos um professor.")
    if not isinstance(fixadas, dict):
        raise ValueError("Aulas fixadas devem formar um objeto.")

    por_turma_id = {}
    por_turma_nome = {}
    slots_turma = {}
    por_slot = {}
    for turma in turmas:
        tid = turma.get("id")
        nome = normalizar(turma.get("nome"))
        if not tid or not nome or tid in por_turma_id or nome in por_turma_nome:
            raise ValueError("Turmas com ID ou nome ausente/repetido.")
        por_turma_id[tid] = turma
        por_turma_nome[nome] = tid
        lista = expandir_agenda(turma, escola)
        slots_turma[tid] = lista
        por_slot[tid] = {s["id"]: s for s in lista}

    por_prof_id = {}
    bloqueios = {}
    for professor in professores:
        pid = professor.get("id")
        if not pid or pid in por_prof_id:
            raise ValueError("Professor com ID ausente ou repetido.")
        if not str(professor.get("nome", "")).strip():
            raise ValueError("Professor sem nome.")
        inteiro(professor.get("maxDia"), f"Limite diario de {professor['nome']}", 1)
        por_prof_id[pid] = professor
        bloqueios[pid] = normalizar_bloqueios(professor, escola)

    individuais = []
    chaves = set()
    for p in professores:
        for v in p.get("vinculos", []):
            tid = por_turma_nome.get(normalizar(v.get("turma")))
            if tid is None:
                raise ValueError(f"Turma de {p['nome']} nao cadastrada: {v.get('turma')}.")
            nome = str(v.get("disciplina", "")).strip()
            if not nome:
                raise ValueError(f"Disciplina ausente em {p['nome']}.")
            chave = (p["id"], tid, normalizar(nome))
            if chave in chaves:
                raise ValueError(f"Vinculo repetido: {p['nome']}, {nome}.")
            chaves.add(chave)
            aulas = inteiro(v.get("aulas"), f"Aulas de {nome}", 1)
            max_dia = inteiro(v.get("maxDia"), f"Limite diario de {nome}", 1)
            geminadas = v.get("geminadas", "livre") or "livre"
            if geminadas not in ("livre", "obrigatoria", "preferencial"):
                raise ValueError(f"Tipo de geminadas invalido: {nome}.")
            pares = inteiro(v.get("paresGeminados", 0), f"Pares de {nome}")
            if 2 * pares > aulas:
                raise ValueError(f"Pares geminados excedem as aulas de {nome}.")
            if geminadas == "livre":
                pares = 0
            elif pares and min(max_dia, int(p["maxDia"])) < 2:
                raise ValueError(f"Limite diario impede geminadas de {nome}.")
            if geminadas == "obrigatoria" and pares == 0:
                raise ValueError(f"Informe pares obrigatorios de {nome}.")
            individuais.append({
                "professorId": p["id"], "turmaId": tid, "disciplina": nome,
                "aulas": aulas, "maxDia": max_dia,
                "geminadas": geminadas, "paresGeminados": pares,
                "grupoCompartilhado": str(v.get("grupoCompartilhado") or "").strip()
            })

    agrupados = defaultdict(list)
    for v in individuais:
        codigo = normalizar(v["grupoCompartilhado"])
        chave = (("grupo", v["turmaId"], codigo) if codigo
                 else ("simples", v["professorId"], v["turmaId"], normalizar(v["disciplina"])))
        agrupados[chave].append(v)

    vinculos = []
    cargas = defaultdict(int)
    for membros in agrupados.values():
        base = membros[0]
        participantes = [m["professorId"] for m in membros]
        if len(set(participantes)) != len(participantes):
            raise ValueError("Professor repetido no grupo compartilhado.")
        if base["grupoCompartilhado"] and len(participantes) < 2:
            raise ValueError(f"Grupo {base['grupoCompartilhado']} incompleto.")
        for m in membros[1:]:
            campos = ("aulas", "geminadas", "paresGeminados")
            if (any(m[c] != base[c] for c in campos)
                    or normalizar(m["disciplina"]) != normalizar(base["disciplina"])):
                raise ValueError(f"Grupo {base['grupoCompartilhado']} inconsistente.")
        vinculos.append({
            **base,
            "professoresIds": participantes,
            "maxDia": min(m["maxDia"] for m in membros)
        })
        cargas[base["turmaId"]] += base["aulas"]

    for tid, turma in por_turma_id.items():
        esperado = len(slots_turma[tid])
        if cargas[tid] != esperado:
            raise ValueError(
                f"Turma {turma['nome']}: {cargas[tid]} aulas cadastradas; "
                f"agenda exige {esperado}."
            )

    model = cp_model.CpModel()
    x = {}
    por_vinculo = defaultdict(list)
    por_turma_posicao = defaultdict(list)
    por_professor = defaultdict(list)
    por_professor_dia = defaultdict(list)
    por_vinculo_dia = defaultdict(list)
    por_professor_dia_turno = defaultdict(lambda: defaultdict(list))
    intervalos_professor = defaultdict(list)

    for i, v in enumerate(vinculos):
        for slot in slots_turma[v["turmaId"]]:
            if any(
                horarios_conflitam(slot, b)
                for pid in v["professoresIds"]
                for b in bloqueios[pid]
            ):
                continue
            var = model.NewBoolVar(f"a_{i}_{slot['id']}")
            x[(i, slot["id"])] = var
            por_vinculo[i].append(var)
            por_turma_posicao[(v["turmaId"], slot["id"])].append(var)
            por_vinculo_dia[(i, slot["dia"])].append(var)

            inicio = DIAS.index(slot["dia"]) * 1440 + slot["inicioMin"]
            fim = DIAS.index(slot["dia"]) * 1440 + slot["fimMin"]
            for pid in v["professoresIds"]:
                por_professor[pid].append(var)
                por_professor_dia[(pid, slot["dia"])].append(var)
                por_professor_dia_turno[(pid, slot["dia"], slot["turno"])][
                    (slot["inicioMin"], slot["fimMin"])
                ].append(var)
                intervalo = model.NewOptionalIntervalVar(
                    inicio, fim - inicio, fim, var,
                    f"p_{pid}_{i}_{slot['id']}"
                )
                intervalos_professor[pid].append(intervalo)

    # Todas as aulas da disciplina e todas as posicoes de cada turma.
    for i, v in enumerate(vinculos):
        model.Add(sum(por_vinculo[i]) == v["aulas"])
        for dia in DIAS:
            model.Add(sum(por_vinculo_dia[(i, dia)]) <= v["maxDia"])
    for tid, slots in slots_turma.items():
        for slot in slots:
            model.Add(sum(por_turma_posicao[(tid, slot["id"])]) == 1)

    # O mesmo professor nao pode lecionar em intervalos sobrepostos,
    # mesmo quando turmas usam perfis ou turnos diferentes.
    for pid, professor in por_prof_id.items():
        model.AddNoOverlap(intervalos_professor[pid])
        for dia in DIAS:
            model.Add(
                sum(por_professor_dia[(pid, dia)]) <= int(professor["maxDia"])
            )

    preferencias = []
    for i, v in enumerate(vinculos):
        exigidos = v["paresGeminados"]
        if v["geminadas"] == "livre" or exigidos == 0:
            continue
        pares = []
        usando = defaultdict(list)
        grupos_turnos = defaultdict(list)
        for slot in slots_turma[v["turmaId"]]:
            grupos_turnos[(slot["dia"], slot["turno"], slot["perfilHorarioId"])].append(slot)
        for grupo, slots in grupos_turnos.items():
            slots.sort(key=lambda s: s["ordem"])
            for a, b in zip(slots, slots[1:]):
                if b["ordem"] != a["ordem"] + 1:
                    continue
                va, vb = x.get((i, a["id"])), x.get((i, b["id"]))
                if va is None or vb is None:
                    continue
                par = model.NewBoolVar(f"dupla_{i}_{a['id']}")
                model.Add(par <= va)
                model.Add(par <= vb)
                pares.append(par)
                usando[a["id"]].append(par)
                usando[b["id"]].append(par)
        for relacionados in usando.values():
            model.Add(sum(relacionados) <= 1)
        if v["geminadas"] == "obrigatoria":
            model.Add(sum(pares) == exigidos)
        else:
            model.Add(sum(pares) <= exigidos)
            preferencias.extend(pares)

    for chave, aula in fixadas.items():
        if not isinstance(aula, dict) or "|" not in chave:
            raise ValueError("Aula fixada com formato invalido.")
        tid, sid = chave.split("|", 1)
        if tid not in por_slot or sid not in por_slot[tid]:
            raise ValueError(f"Aula fixada fora da agenda: {chave}.")
        ids = aula.get("professoresIds")
        ids = set(ids) if isinstance(ids, list) and ids else None
        candidatos = []
        for i, v in enumerate(vinculos):
            if v["turmaId"] != tid or normalizar(v["disciplina"]) != normalizar(aula.get("disciplina")):
                continue
            if ids is not None:
                if set(v["professoresIds"]) != ids:
                    continue
            elif aula.get("professorId") not in v["professoresIds"]:
                continue
            candidatos.append(i)
        if len(candidatos) != 1 or (candidatos[0], sid) not in x:
            raise ValueError(f"Aula fixada invalida ou indisponivel: {chave}.")
        model.Add(x[(candidatos[0], sid)] == 1)

    # Evitar janelas dentro de cada turno e distribuir uma disciplina
    # por varios dias, respeitando geminadas obrigatorias.
    custos = []
    for i, v in enumerate(vinculos):
        for dia in DIAS:
            vs = por_vinculo_dia[(i, dia)]
            if vs:
                excesso = model.NewIntVar(0, len(vs), f"excesso_{i}_{dia}")
                model.Add(excesso >= sum(vs) - 1)
                custos.append(excesso)

    janelas = []
    for (pid, dia, turno), por_horario in por_professor_dia_turno.items():
        horarios = sorted(por_horario)
        if len(horarios) < 3:
            continue
        ocupados = []
        for j, horario in enumerate(horarios):
            ocupa = model.NewBoolVar(f"ocupado_{pid}_{dia}_{turno}_{j}")
            model.AddMaxEquality(ocupa, por_horario[horario])
            ocupados.append(ocupa)
        for j in range(1, len(ocupados) - 1):
            antes = model.NewBoolVar(f"antes_{pid}_{dia}_{turno}_{j}")
            depois = model.NewBoolVar(f"depois_{pid}_{dia}_{turno}_{j}")
            lacuna = model.NewBoolVar(f"janela_{pid}_{dia}_{turno}_{j}")
            model.AddMaxEquality(antes, ocupados[:j])
            model.AddMaxEquality(depois, ocupados[j+1:])
            model.Add(lacuna <= antes)
            model.Add(lacuna <= depois)
            model.Add(lacuna + ocupados[j] <= 1)
            model.Add(lacuna >= antes + depois - ocupados[j] - 1)
            janelas.append(lacuna)

    model.Minimize(
        100 * sum(janelas) + sum(custos) - 10 * sum(preferencias)
    )
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 25.0
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)
    if status not in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        if status == cp_model.INFEASIBLE:
            return {
                "sucesso": False, "situacao": "inviavel",
                "mensagem": "As restricoes combinadas impedem a geracao da grade V2.",
                "diagnostico": [{
                    "codigo": "CONFLITO_COMBINADO",
                    "titulo": "Restricoes incompativeis",
                    "detalhe": "Nao existe solucao que atenda todas as regras simultaneamente.",
                    "tipo": "comprovado",
                    "sugestoes": ["Confira indisponibilidades, limites, geminadas e aulas fixadas."]
                }]
            }
        return {
            "sucesso": False, "situacao": "limite_ou_erro",
            "mensagem": "Nao foi encontrada solucao no tempo disponivel."
        }

    grade = {}
    for (i, sid), var in x.items():
        if solver.Value(var):
            v = vinculos[i]
            grade[f"{v['turmaId']}|{sid}"] = {
                "professorId": v["professorId"],
                "professoresIds": v["professoresIds"],
                "disciplina": v["disciplina"],
                "grupoCompartilhado": v["grupoCompartilhado"]
            }
    return {
        "sucesso": True,
        "schemaVersion": 2,
        "situacao": "otima" if status == cp_model.OPTIMAL else "viavel",
        "totalAulas": len(grade),
        "grade": grade
    }
