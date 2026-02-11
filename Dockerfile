# ---- build stage ----
FROM debian:trixie-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Drop devDependencies before copying to runtime stage
# --ignore-scripts: build is done, skip postinstall (nuxt prepare) which
# would fail loading dev-only modules like @nuxt/eslint
RUN pnpm prune --prod --ignore-scripts \
    && pnpm rebuild better-sqlite3

# ---- runtime stage ----
FROM debian:trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    git \
    ripgrep \
    python3 \
    jq \
    zip \
    unzip \
    p7zip-full \
    file \
    sed \
    gawk \
    grep \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://github.com/cli/cli/releases/download/v2.86.0/gh_2.86.0_linux_amd64.tar.gz \
    | tar xzf - --strip-components=2 -C /usr/local/bin gh_2.86.0_linux_amd64/bin/gh

# Claude Code CLI (npm global install)
RUN npm install -g @anthropic-ai/claude-code

# OpenCode CLI (npm global install)
RUN npm install -g opencode-ai@latest

# Gemini CLI (npm global install)
RUN npm install -g @google/gemini-cli

# GitHub Copilot CLI (npm global install)
RUN npm install -g @github/copilot

WORKDIR /app

# Copy built app from build stage
# .output contains the Nitro server bundle
# node_modules is needed at runtime because claude-code-acp is resolved
# dynamically via createRequire (not bundled by Nitro)
COPY --from=build /app/.output .output
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json .

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
