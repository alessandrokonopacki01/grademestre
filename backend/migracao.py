
"""GradeMestre: migra um backup V1 para os dados consumidos pelo solver V2.

Nao modifica localStorage, backups ou arquivos; a grade V1 nao e fixada.
O perfil de horarios usado por omissao e ILUSTRATIVO e deve ser confirmado.
"""
from copy import deepcopy
import json

from calendario import DIAS, TURNOS, expandir_agenda


HORARIOS_EXEMPLO = {
    "manha": [
        {"inicio": "07:00", "fim": "07:50"},
        {"inicio": "07:50", "fim": "08:40"},
        {"inicio": "08:40", "fim": "09:30"},
        {"inicio": "09:40", "fim": "10:30"},
        {"inicio": "10:30", "fim": "11:20"},
        {"inicio": "11:20", "fim": "12:10"},
    ],
    "tarde": [
        {"inicio": "12:30", "fim": "13:20"},
        {"inicio": "13:20", "fim": "14:10"},
        {"inicio": "14:10", "fim": "15:00"},
        {"inicio": "15:10", "fim": "16:00"},
        {"inicio": "16:00", "fim": "16:50"},
        {"inicio": "16:50", "fim": "17:40"},
    ],
    "noite": [],
}


def campo_backup(backup, chave, tipo):
    """Le valores do JSON exportado do localStorage (string ou objeto)."""
    if chave not in backup or backup[chave] is None:
        raise ValueError(f"O backup nao possui o campo {chave}.")
    valor = backup[chave]
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except json.JSONDecodeError as erro:
            raise ValueError(f"JSON invalido no campo {chave}.") from erro
    if not isinstance(valor, tipo):
        raise ValueError(f"Formato invalido no campo {chave}.")
    return deepcopy(valor)


def validar_turno(turno, contexto):
    if turno not in TURNOS:
        raise ValueError(f"{contexto}: turno {turno!r} invalido.")
    return turno


def obter_opcao(opcoes, item, padrao=None):
    if item.get("id") in opcoes:
        return opcoes[item["id"]]
    return opcoes.get(str(item.get("nome", "")), padrao)


def carga_por_turma(professores):
    """Conta aulas compartilhadas uma unica vez por grupo/turma."""
    cargas = {}
    grupos = {}
    for professor in professores:
        for v in professor.get("vinculos", []):
            turma = str(v.get("turma", "")).strip().casefold()
            carga = int(v.get("aulas", 0))
            grupo = str(v.get("grupoCompartilhado") or "").strip().casefold()
            if not turma or carga < 0:
                raise ValueError("Vinculo com turma ou carga invalida.")
            if grupo:
                chave = (turma, grupo)
                if chave in grupos:
                    if grupos[chave] != (
                        carga,
                        str(v.get("disciplina", "")).strip().casefold()
                    ):
                        raise ValueError(
                            f"Grupo compartilhado inconsistente: "
                            f"{grupo} ({turma})."
                        )
                    continue
                grupos[chave] = (
                    carga,
                    str(v.get("disciplina", "")).strip().casefold()
                )
            cargas[turma] = cargas.get(turma, 0) + carga
    return cargas


def migrar_backup_v1(
    backup,
    *,
    turnos_turmas=None,
    horarios=None,
    turnos_adicionais_turmas=None,
    turnos_bloqueios=None,
):
    """Retorna estrutura V2; nunca altera os dados de origem.

    turnos_turmas: {"6": "tarde", "7": "tarde"}
    turnos_adicionais_turmas: {"2": "manha"}
    turnos_bloqueios: {
        "Nome docente": {
            "regular": "tarde",
            "contraturno": "manha"
        }
    }
    Use essa opcao quando o legado nao permite descobrir o turno.
    horarios: perfil fisico da escola, contendo manha/tarde/noite.
    """
    if not isinstance(backup, dict):
        raise ValueError("O backup precisa ser um objeto JSON.")
    if backup.get("schemaVersion") == 2:
        raise ValueError(
            "Estes dados ja estao na V2; nao migre novamente."
        )

    config = campo_backup(
        backup, "grademestre_config", dict
    )
    turmas = campo_backup(
        backup, "grademestre_turmas", list
    )
    professores = campo_backup(
        backup, "grademestre_professores", list
    )

    modelo = str(config.get("modelo", "5"))
    if modelo not in ("5", "6"):
        raise ValueError(
            f"Modelo escolar V1 desconhecido: {modelo}."
        )

    turnos_turmas = turnos_turmas or {}
    extras = turnos_adicionais_turmas or {}
    turnos_bloqueios = turnos_bloqueios or {}

    perfil = deepcopy(
        HORARIOS_EXEMPLO if horarios is None else horarios
    )

    for turno in TURNOS:
        perfil.setdefault(turno, [])

    escola = {
        "nome": config.get("nome", "Escola sem nome"),
        "perfisHorario": {"padrao": perfil},
    }

    avisos = []

    if horarios is None:
        avisos.append(
            "Horarios de inicio e fim sao EXEMPLOS: "
            "confira os sinos da escola antes de testar "
            "conflitos reais ou publicar uma grade."
        )

    novos = []
    turnos_por_turma = {}
    extras_por_turma = {}

    for turma in turmas:
        nome = str(turma.get("nome", "")).strip()

        if (
            not nome
            or nome.casefold() in turnos_por_turma
        ):
            raise ValueError(
                "Turma sem nome ou com nome repetido."
            )

        turno = validar_turno(
            obter_opcao(
                turnos_turmas,
                turma,
                turma.get("turnoRegular", "manha")
            ),
            f"Turma {nome}",
        )

        carga = int(
            turma.get("aulasSemanais") or 30
        )

        if (
            (modelo == "6" and carga != 30)
            or (
                modelo == "5"
                and carga not in (25, 30)
            )
        ):
            raise ValueError(
                f"Turma {nome}: carga {carga} invalida "
                f"para o modelo {modelo}."
            )

        agenda = {
            dia: {
                turno: list(
                    range(1, int(modelo) + 1)
                )
            }
            for dia in DIAS
        }

        extra = None

        if modelo == "5" and carga == 30:
            dia_ct = (
                turma.get("diaContraturno")
                or config.get("contraturno")
            )

            if dia_ct not in DIAS:
                raise ValueError(
                    f"Turma {nome}: dia de contraturno "
                    f"invalido: {dia_ct!r}."
                )

            extra = obter_opcao(
                extras,
                turma,
                "tarde" if turno == "manha" else None
            )

            if extra is None:
                raise ValueError(
                    f"Turma {nome} estuda em {turno} "
                    "e possui contraturno: informe "
                    "explicitamente o turno adicional."
                )

            validar_turno(
                extra,
                f"Turno adicional da turma {nome}"
            )

            if extra == turno:
                raise ValueError(
                    f"Turma {nome}: adicional deve "
                    "ser em outro turno."
                )

            agenda[dia_ct][extra] = [
                1, 2, 3, 4, 5
            ]

        nova = deepcopy(turma)

        nova.update({
            "turnoRegular": turno,
            "perfilHorarioId": "padrao",
            "agenda": agenda,
            "aulasSemanais": carga,
        })

        if len(expandir_agenda(nova, escola)) != carga:
            raise ValueError(
                f"Turma {nome}: agenda difere "
                "da carga cadastrada."
            )

        novos.append(nova)

        turnos_por_turma[
            nome.casefold()
        ] = turno

        if extra:
            extras_por_turma[
                nome.casefold()
            ] = extra

    # Bloqueios legados precisam apontar
    # para turnos fisicos verdadeiros.

    extras_escola = set(
        extras_por_turma.values()
    )

    arquivados = 0

    for professor in professores:
        nome = str(
            professor.get("nome", "")
        ).strip()

        if not nome:
            raise ValueError(
                "Professor sem nome."
            )

        regulares = {
            turnos_por_turma[
                str(
                    v.get("turma", "")
                ).strip().casefold()
            ]
            for v in professor.get("vinculos", [])
            if str(
                v.get("turma", "")
            ).strip().casefold() in turnos_por_turma
        }

        op = turnos_bloqueios.get(
            professor.get("id"),
            turnos_bloqueios.get(nome, {})
        )

        if not isinstance(op, dict):
            raise ValueError(
                f"turnos_bloqueios de {nome} "
                "deve ser um objeto."
            )

        convertidos = []
        antigos_arquivados = []

        for bloqueio in professor.get(
            "indisponibilidades", []
        ):
            if not isinstance(bloqueio, str):
                raise ValueError(
                    f"Bloqueio legado nao textual "
                    f"de {nome}: {bloqueio!r}."
                )

            partes = bloqueio.split(":")

            if len(partes) != 3:
                raise ValueError(
                    f"Bloqueio V1 desconhecido "
                    f"de {nome}: {bloqueio}."
                )

            dia, tipo, ordem_texto = partes

            if (
                dia not in DIAS
                or tipo not in (
                    "regular", "contraturno"
                )
            ):
                raise ValueError(
                    f"Bloqueio V1 invalido "
                    f"de {nome}: {bloqueio}."
                )

            try:
                ordem = int(ordem_texto)
            except ValueError as erro:
                raise ValueError(
                    f"Aula bloqueada invalida "
                    f"de {nome}: {bloqueio}."
                ) from erro

            # Bloqueios fora do modelo atual
            # sao arquivados para revisao.

            if (
                ordem < 1
                or (
                    tipo == "regular"
                    and ordem > int(modelo)
                )
                or (
                    tipo == "contraturno"
                    and (
                        modelo == "6"
                        or ordem > 5
                    )
                )
            ):
                antigos_arquivados.append(
                    bloqueio
                )
                continue

            if tipo == "regular":
                if "regular" in op:
                    turno_bloqueio = op["regular"]

                elif len(regulares) == 1:
                    turno_bloqueio = next(
                        iter(regulares)
                    )

                elif not regulares:
                    raise ValueError(
                        f"Professor {nome}: informe "
                        "o turno dos bloqueios regulares."
                    )

                else:
                    raise ValueError(
                        f"Professor {nome} atua em "
                        "varios turnos regulares "
                        f"({', '.join(sorted(regulares))}). "
                        "Informe turnos_bloqueios para "
                        "nao converter bloqueios ambiguos."
                    )

            else:
                if "contraturno" in op:
                    turno_bloqueio = op["contraturno"]

                elif len(extras_escola) == 1:
                    turno_bloqueio = next(
                        iter(extras_escola)
                    )

                else:
                    raise ValueError(
                        f"Professor {nome}: informe "
                        "o turno dos bloqueios de "
                        "contraturno."
                    )

            validar_turno(
                turno_bloqueio,
                f"Bloqueio de {nome}"
            )

            if ordem > len(
                perfil[turno_bloqueio]
            ):
                raise ValueError(
                    f"Professor {nome}: {bloqueio} "
                    "corresponde a aula inexistente "
                    f"no turno {turno_bloqueio}."
                )

            convertido = (
                f"{dia}:padrao:"
                f"{turno_bloqueio}:{ordem}"
            )

            if convertido not in convertidos:
                convertidos.append(
                    convertido
                )

        professor[
            "indisponibilidades"
        ] = convertidos

        if antigos_arquivados:
            professor[
                "bloqueiosLegadosArquivados"
            ] = antigos_arquivados

            arquivados += len(
                antigos_arquivados
            )

    if arquivados:
        avisos.append(
            f"{arquivados} bloqueio(s) V1 fora "
            "da agenda atual foram ARQUIVADOS "
            "nos respectivos professores; "
            "revise antes de mudar a grade."
        )

    cargas = carga_por_turma(professores)
    divergencias = []

    for turma in novos:
        cadastradas = cargas.get(
            str(turma["nome"]).casefold(),
            0
        )

        if cadastradas != turma["aulasSemanais"]:
            divergencias.append(
                f"{turma['nome']}: "
                f"{cadastradas} aulas cadastradas / "
                f"{turma['aulasSemanais']} exigidas."
            )

    if divergencias:
        avisos.append(
            "Cargas divergentes: "
            + "; ".join(divergencias)
        )

    return {
        "schemaVersion": 2,
        "escola": escola,
        "turmas": novos,
        "professores": professores,
        "fixadas": {},
        "grade": {},
        "avisos": avisos,
        "resumo": {
            "professores": len(professores),
            "turmas": len(novos),
            "aulasPrevistas": sum(
                t["aulasSemanais"]
                for t in novos
            ),
            "bloqueiosArquivados": arquivados,
            "cargasConferidas": not divergencias,
        },
    }
