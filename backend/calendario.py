
"""GradeMestre V2 - calendário escolar unificado."""

DIAS = ("segunda", "terca", "quarta", "quinta", "sexta")
TURNOS = ("manha", "tarde", "noite")


class ErroCalendario(ValueError):
    """Configuração de horário ou agenda inválida."""


def minutos(hora):
    """Converte HH:MM em minutos."""
    try:
        partes = str(hora).split(":")

        if len(partes) != 2:
            raise ValueError

        h, m = (int(x) for x in partes)

        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError

        return 60 * h + m

    except (TypeError, ValueError) as erro:
        raise ErroCalendario(
            f"Horário inválido: {hora!r}. Use HH:MM."
        ) from erro


def intervalos_do_perfil(escola, perfil_id="padrao"):
    """Lê os horários físicos de cada turno."""

    perfis = escola.get("perfisHorario", {})
    perfil = perfis.get(perfil_id)

    if not isinstance(perfil, dict):
        raise ErroCalendario(
            f"Perfil de horário inexistente: {perfil_id}."
        )

    resultado = {}

    for turno in TURNOS:
        aulas = perfil.get(turno, [])

        if not isinstance(aulas, list):
            raise ErroCalendario(
                f"O turno {turno} deve ser uma lista."
            )

        periodos = []
        fim_anterior = None

        for indice, aula in enumerate(aulas, 1):
            if not isinstance(aula, dict):
                raise ErroCalendario(
                    f"Aula {indice} de {turno} inválida."
                )

            inicio = minutos(aula.get("inicio"))
            fim = minutos(aula.get("fim"))

            if fim <= inicio:
                raise ErroCalendario(
                    f"Aula {indice} de {turno} "
                    "termina antes de começar."
                )

            if (
                fim_anterior is not None
                and inicio < fim_anterior
            ):
                raise ErroCalendario(
                    f"Aulas sobrepostas ou fora "
                    f"de ordem em {turno}."
                )

            periodos.append({
                "ordem": indice,
                "inicio": aula["inicio"],
                "fim": aula["fim"],
                "inicioMin": inicio,
                "fimMin": fim
            })

            fim_anterior = fim

        resultado[turno] = periodos

    return resultado


def horarios_conflitam(a, b):
    """Detecta conflito pelo horário real."""

    return (
        a["dia"] == b["dia"]
        and a["inicioMin"] < b["fimMin"]
        and b["inicioMin"] < a["fimMin"]
    )


def montar_agenda(
    turno_regular="manha",
    aulas_por_dia=5,
    dias=None,
    adicionais=None
):
    """
    Monta a agenda semanal de uma turma.

    Exemplo:
    adicionais = {
        "terca": {
            "tarde": [1, 2, 3, 4, 5]
        }
    }
    """

    if turno_regular not in TURNOS:
        raise ErroCalendario(
            f"Turno inválido: {turno_regular}."
        )

    if (
        type(aulas_por_dia) is not int
        or aulas_por_dia < 1
    ):
        raise ErroCalendario(
            "A quantidade diária deve ser positiva."
        )

    escolhidos = list(
        DIAS if dias is None else dias
    )

    if len(escolhidos) != len(set(escolhidos)):
        raise ErroCalendario(
            "Dia repetido na agenda."
        )

    if any(dia not in DIAS for dia in escolhidos):
        raise ErroCalendario(
            "A agenda possui um dia inválido."
        )

    agenda = {
        dia: {
            turno_regular: list(
                range(1, aulas_por_dia + 1)
            )
        }
        for dia in escolhidos
    }

    for dia, turnos in (adicionais or {}).items():

        if (
            dia not in DIAS
            or not isinstance(turnos, dict)
        ):
            raise ErroCalendario(
                f"Adicionais inválidos: {dia}."
            )

        agenda.setdefault(dia, {})

        for turno, ordens in turnos.items():

            if turno not in TURNOS:
                raise ErroCalendario(
                    f"Turno adicional inválido: {turno}."
                )

            existentes = agenda[dia].setdefault(
                turno, []
            )

            existentes.extend(list(ordens))

    return agenda


def expandir_agenda(turma, escola):
    """
    Converte a agenda de uma turma em
    horários físicos utilizáveis pelo solver.
    """

    perfil_id = turma.get(
        "perfilHorarioId", "padrao"
    )

    periodos = intervalos_do_perfil(
        escola, perfil_id
    )

    agenda = turma.get("agenda")

    if not isinstance(agenda, dict) or not agenda:
        raise ErroCalendario(
            f"Turma {turma.get('nome', '?')} "
            "sem agenda V2."
        )

    slots = []
    ids = set()

    for dia, turnos in agenda.items():

        if (
            dia not in DIAS
            or not isinstance(turnos, dict)
        ):
            raise ErroCalendario(
                f"Dia inválido: {dia}."
            )

        for turno, ordens in turnos.items():

            if (
                turno not in TURNOS
                or not isinstance(ordens, list)
            ):
                raise ErroCalendario(
                    f"Turno inválido: {turno}."
                )

            for ordem in ordens:

                if (
                    type(ordem) is not int
                    or not 1 <= ordem <= len(periodos[turno])
                ):
                    raise ErroCalendario(
                        f"Aula {ordem!r} inexistente "
                        f"em {dia}/{turno}."
                    )

                periodo = periodos[turno][ordem - 1]

                identificador = (
                    f"{dia}:{perfil_id}:{turno}:{ordem}"
                )

                if identificador in ids:
                    raise ErroCalendario(
                        f"Aula repetida: {identificador}."
                    )

                ids.add(identificador)

                slots.append({
                    "id": identificador,
                    "dia": dia,
                    "turno": turno,
                    "perfilHorarioId": perfil_id,
                    "ordem": ordem,
                    "inicio": periodo["inicio"],
                    "fim": periodo["fim"],
                    "inicioMin": periodo["inicioMin"],
                    "fimMin": periodo["fimMin"]
                })

    slots.sort(
        key=lambda s: (
            DIAS.index(s["dia"]),
            s["inicioMin"],
            s["fimMin"]
        )
    )

    # Impede duas aulas da mesma turma
    # no mesmo intervalo físico.

    for anterior, atual in zip(slots, slots[1:]):

        if horarios_conflitam(anterior, atual):
            raise ErroCalendario(
                f"Sobreposição na turma "
                f"{turma.get('nome', '?')}: "
                f"{anterior['id']} e {atual['id']}."
            )

    return slots


def total_aulas(turma, escola):
    """Calcula a carga semanal real da turma."""

    return len(
        expandir_agenda(turma, escola)
    )
