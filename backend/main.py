
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from solver import gerar_horarios

app = FastAPI(title="GradeMestre API")

# Configuração provisória para a fase de desenvolvimento.
# Antes de disponibilizar a API publicamente com autenticação,
# restringiremos as origens ao domínio do site.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

@app.get("/")
def inicio():
    return {
        "sistema": "GradeMestre",
        "status": "online"
    }

@app.post("/gerar")
def gerar(dados: dict):
    try:
        return gerar_horarios(dados)
    except ValueError as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro)
        )
