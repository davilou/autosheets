#!/usr/bin/env bash
set -euo pipefail

# AutoSheets - Deploy de Produção (Ubuntu)
# Este script automatiza: limpar/reclonar o repo, preparar .env.production,
# ajustar domínio e senhas no docker-compose, subir a stack com Traefik (HTTPS) e aplicar prisma db push.
# 
# Requisitos: executar como root (ou com sudo) em um servidor Ubuntu com acesso à Internet.
# Uso (interativo):
#   bash scripts/deploy-prod.sh
# Uso (não interativo; defina variáveis antes):
#   DOMAIN=meu.dominio.com \
#   LETSENCRYPT_EMAIL=meu-email@dominio.com \
#   POSTGRES_PASSWORD='senhaPostgresForte' \
#   REDIS_PASSWORD='senhaRedisForte' \
#   JWT_SECRET='segredoJWT' \
#   NEXTAUTH_SECRET='segredoNextAuth' \
#   REPO_URL='https://github.com/davilou/autosheets' \
#   APP_DIR='/opt/autosheets' \
#   bash scripts/deploy-prod.sh

REPO_URL="${REPO_URL:-https://github.com/davilou/autosheets}"
APP_DIR="${APP_DIR:-/opt/autosheets}"
DOMAIN="${DOMAIN:-autosheets.loudigital.shop}"
COMPOSE_FILE="docker-compose.prod.yml"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

ensure_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "[ERRO] Execute este script como root ou usando sudo." >&2
    exit 1;
  fi
}

ensure_deps() {
  echo "[INFO] Verificando dependências (docker, docker compose, git)"
  if ! need_cmd docker; then
    echo "[INFO] Instalando Docker e plugin Compose..."
    apt-get update -y
    apt-get install -y docker.io docker-compose-plugin
    systemctl enable --now docker
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "[ERRO] Docker Compose plugin não encontrado. Verifique a instalação (docker compose)." >&2
    exit 1
  fi
  if ! need_cmd git; then
    echo "[INFO] Instalando git..."
    apt-get update -y && apt-get install -y git
  fi
}

confirm_or_default() {
  local var_name=$1
  local default_value=$2
  local prompt_text=$3
  read -r -p "$prompt_text [$default_value]: " input || true
  if [ -z "${input:-}" ]; then
    eval "$var_name=$default_value"
  else
    eval "$var_name=$input"
  fi
}

prompt_secret() {
  local var_name=$1
  local prompt_text=$2
  local val="${!var_name:-}"
  if [ -z "$val" ]; then
    read -r -s -p "$prompt_text: " val || true
    echo
    eval "$var_name=$val"
  fi
}

gen_secret() {
  if need_cmd openssl; then
    openssl rand -hex 32
  else
    # Fallback simples
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64 || true
  fi
}

stop_and_clean_old() {
  if [ -d "$APP_DIR" ]; then
    echo "[INFO] Diretório existente encontrado em $APP_DIR"
    if [ -f "$APP_DIR/$COMPOSE_FILE" ]; then
      echo "[INFO] Derrubando stack antiga (se existir)..."
      (cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" down --remove-orphans || true)
    fi
    echo "[INFO] Removendo diretório $APP_DIR..."
    rm -rf "$APP_DIR"
  fi
}

clone_repo() {
  echo "[INFO] Clonando repositório: $REPO_URL -> $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
}

prepare_env() {
  cd "$APP_DIR"
  if [ ! -f .env.production ]; then
    echo "[INFO] Criando .env.production a partir de .env.production.example"
    cp .env.production.example .env.production

    # Coletar variáveis necessárias (permite usar envs pré-definidos)
    confirm_or_default DOMAIN "$DOMAIN" "Informe o domínio (DNS apontado para este servidor)"
    confirm_or_default LETSENCRYPT_EMAIL "${LETSENCRYPT_EMAIL:-seu-email@example.com}" "Informe o e-mail para Let's Encrypt"
    prompt_secret POSTGRES_PASSWORD "Defina a senha do Postgres (forte)"
    prompt_secret REDIS_PASSWORD "Defina a senha do Redis (forte)"

    if [ -z "${JWT_SECRET:-}" ]; then
      echo "[INFO] Gerando JWT_SECRET automaticamente (caso não fornecido)"
      JWT_SECRET="$(gen_secret)"
    fi
    if [ -z "${NEXTAUTH_SECRET:-}" ]; then
      echo "[INFO] Gerando NEXTAUTH_SECRET automaticamente (caso não fornecido)"
      NEXTAUTH_SECRET="$(gen_secret)"
    fi

    # Exportar para permitir interpolação no docker-compose (quando aplicável)
    export DOMAIN LETSENCRYPT_EMAIL POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET NEXTAUTH_SECRET

    # Atualizações no .env.production
    sed -i -E "s|^LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL|" .env.production || true
    sed -i -E "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" .env.production || true
    sed -i -E "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" .env.production || true
    sed -i -E "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env.production || true
    sed -i -E "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASSWORD|" .env.production || true
    sed -i -E "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.production || true
    sed -i -E "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://autosheets:$POSTGRES_PASSWORD@postgres:5432/autosheets|" .env.production || true
    sed -i -E "s|^TELEGRAM_WEBHOOK_URL=.*|TELEGRAM_WEBHOOK_URL=https://$DOMAIN/api/telegram/webhook|" .env.production || true

    echo "[AVISO] Revise .env.production e substitua quaisquer valores de exemplo/placeholder e tokens sensíveis antes do deploy."
  else
    echo "[INFO] .env.production já existe. Pulando criação."
  fi
}

adjust_compose() {
  cd "$APP_DIR"
  if [ -f "$COMPOSE_FILE" ]; then
    echo "[INFO] Ajustando domínio e segredos no $COMPOSE_FILE"
    # Substitui o domínio na regra Host(`...`)
    sed -i -E "s|Host\(\`[^\`]*\`\)|Host(\`$DOMAIN\`)|g" "$COMPOSE_FILE" || true

    # Ajustar Postgres password para usar o valor definido
    if grep -qE "POSTGRES_PASSWORD:\s" "$COMPOSE_FILE"; then
      sed -i -E "s|POSTGRES_PASSWORD:\s*.*|POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}|" "$COMPOSE_FILE"
    fi

    # Ajustar Redis requirepass para usar o valor definido
    if grep -qE "redis-server --requirepass" "$COMPOSE_FILE"; then
      sed -i -E "s|redis-server --requirepass\s+[^ ]+\s+--appendonly yes|redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes|" "$COMPOSE_FILE"
    fi
  fi
}

review_and_confirm() {
  echo "\nResumo de configuração:"
  echo "  Domínio:              $DOMAIN"
  echo "  Let's Encrypt e-mail: ${LETSENCRYPT_EMAIL:-N/D}"
  echo "  Diretório do app:     $APP_DIR"
  echo "  Compose file:         $APP_DIR/$COMPOSE_FILE"
  echo "  .env.production:      $APP_DIR/.env.production"
  echo "\nATENÇÃO: Certifique-se de que .env.production não contenha segredos reais comprometidos em VCS e que todos os placeholders foram substituídos."
  read -r -p "Prosseguir com o deploy agora? [y/N]: " ok || true
  if [ "${ok:-}" != "y" ] && [ "${ok:-}" != "Y" ]; then
    echo "[INFO] Deploy abortado pelo usuário."
    exit 0
  fi
}

bring_up_stack() {
  cd "$APP_DIR"
  echo "[INFO] Subindo stack de produção (Traefik + App + Nginx + Postgres + Redis)"
  docker compose -f "$COMPOSE_FILE" up -d --build
}

wait_for_health() {
  local svc_name=$1
  local timeout=${2:-180}
  echo "[INFO] Aguardando saúde do serviço $svc_name (timeout: ${timeout}s)..."
  local start_ts=$(date +%s)
  while true; do
    local status
    status=$(docker inspect --format='{{json .State.Health}}' "$svc_name" 2>/dev/null || echo null)
    if echo "$status" | grep -q '"Status":"healthy"'; then
      echo "[OK] Serviço $svc_name saudável."
      break
    fi
    local now=$(date +%s)
    if [ $((now - start_ts)) -ge $timeout ]; then
      echo "[AVISO] Timeout aguardando saúde do serviço $svc_name. Continuando mesmo assim."
      break
    fi
    sleep 5
  done
}

apply_prisma_push() {
  cd "$APP_DIR"
  echo "[INFO] Aplicando Prisma db push no container da aplicação"
  docker compose -f "$COMPOSE_FILE" exec -T autosheets npx prisma db push || {
    echo "[ERRO] Falha ao executar prisma db push." >&2
    exit 1
  }
}

main() {
  ensure_root
  ensure_deps
  stop_and_clean_old
  clone_repo
  prepare_env
  adjust_compose
  review_and_confirm
  bring_up_stack
  # Aguardar serviço principal (opcional)
  wait_for_health "autosheets_app" 180 || true
  apply_prisma_push

  echo
  echo "============================================================"
  echo "Deploy concluído!"
  echo "Domínio: https://$DOMAIN"
  echo "Traefik irá emitir os certificados Let's Encrypt automaticamente."
  echo "Comandos úteis:" 
  echo "  docker compose -f $APP_DIR/$COMPOSE_FILE ps"
  echo "  docker logs -f autosheets_traefik"
  echo "  docker logs -f autosheets_nginx"
  echo "  docker logs -f autosheets_app"
  echo "============================================================"
}

main "$@"