
"""API do GradeMestre: V1 preservada; V2 em rotas próprias."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from solver import gerar_horarios

app = FastAPI(title="GradeMestre API")

# Configuração atual para desenvolvimento.
# Restringir as origens antes da disponibilização pública.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def inicio():
    return {
        "sistema": "GradeMestre",
        "status": "online"
    }


# ==========================================
# V1 — GERADOR ATUAL
# ==========================================

@app.post("/gerar")
def gerar(dados: dict):
    try:
        return gerar_horarios(dados)
    except ValueError as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro)
        ) from erro


# ==========================================
# V2 — MIGRAÇÃO DE CADASTROS
# ==========================================

@app.post("/v2/migrar")
def migrar_v2(requisicao: dict):
    from migracao import migrar_backup_v1

    backup = requisicao.get("backup")
    opcoes = requisicao.get("opcoes", {})

    if not isinstance(backup, dict):
        raise HTTPException(
            status_code=422,
            detail="Envie o backup V1 no campo 'backup'."
        )

    if not isinstance(opcoes, dict):
        raise HTTPException(
            status_code=422,
            detail="O campo 'opcoes' deve ser um objeto."
        )

    permitidas = {
        "turnos_turmas",
        "horarios",
        "turnos_adicionais_turmas",
        "turnos_bloqueios",
    }

    desconhecidas = set(opcoes) - permitidas

    if desconhecidas:
        raise HTTPException(
            status_code=422,
            detail=(
                "Opções desconhecidas: "
                + ", ".join(sorted(desconhecidas))
            )
        )

    try:
        return migrar_backup_v1(backup, **opcoes)
    except (ValueError, TypeError) as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro)
        ) from erro


# ==========================================
# V2 — VALIDAÇÃO DO CALENDÁRIO E CARGAS
# ==========================================

@app.post("/v2/validar")
def validar_v2(dados: dict):
    from calendario import expandir_agenda
    from migracao import carga_por_turma

    if dados.get("schemaVersion") != 2:
        raise HTTPException(
            status_code=422,
            detail="Informe schemaVersion=2."
        )

    escola = dados.get("escola")
    turmas = dados.get("turmas")
    professores = dados.get("professores")

    if not isinstance(escola, dict):
        raise HTTPException(
            status_code=422,
            detail="Escola V2 ausente."
        )

    if not isinstance(turmas, list) or not turmas:
        raise HTTPException(
            status_code=422,
            detail="Cadastre ao menos uma turma."
        )

    if not isinstance(professores, list) or not professores:
        raise HTTPException(
            status_code=422,
            detail="Cadastre ao menos um professor."
        )

    try:
        nomes = set()
        ids = set()
        resumo = []

        cargas = carga_por_turma(professores)

        for turma in turmas:
            nome = str(
                turma.get("nome", "")
            ).strip()

            tid = turma.get("id")
            chave = nome.casefold()

            if (
                not nome
                or not tid
                or chave in nomes
                or tid in ids
            ):
                raise ValueError(
                    "Turma com nome ou ID ausente/repetido."
                )

            nomes.add(chave)
            ids.add(tid)

            total = len(
                expandir_agenda(turma, escola)
            )

            cadastradas = cargas.get(chave, 0)

            if cadastradas != total:
                raise ValueError(
                    f"Turma {nome}: "
                    f"{cadastradas} aulas cadastradas, "
                    f"mas sua agenda exige {total}."
                )

            resumo.append({
                "turma": nome,
                "aulasAgenda": total,
                "aulasCadastradas": cadastradas
            })

        desconhecidas = set(cargas) - nomes

        if desconhecidas:
            raise ValueError(
                "Vínculos com turmas inexistentes: "
                + ", ".join(sorted(desconhecidas))
            )

        return {
            "valido": True,
            "tipoValidacao": "estrutura_e_cargas",
            "turmas": resumo,
            "totalAulas": sum(
                item["aulasAgenda"]
                for item in resumo
            ),
            "aviso": (
                "O calendário e as cargas conferem. "
                "Isso ainda não comprova a viabilidade "
                "dos horários; a geração V2 verificará "
                "as demais restrições."
            )
        }

    except (ValueError, TypeError, KeyError) as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro)
        ) from erro


# ==========================================
# V2 — NOVO GERADOR
# ==========================================

@app.post("/v2/gerar")
def gerar_v2(dados: dict):
    from solver_v2 import gerar_horarios_v2

    try:
        return gerar_horarios_v2(dados)
    except (ValueError, TypeError) as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro)
        ) from erro
