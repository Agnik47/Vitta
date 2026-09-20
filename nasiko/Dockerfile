# One image recipe for all four Vitta agents. AGENT picks which one this container runs
# (planner | discovery | evaluator | purchase); nasiko/deploy.sh stages the build context and sets it.
#
# The agents have no runtime dependencies — compiled output plus the manifest is all they need.
# Nasiko's contract (docs.nasiko.com/adlc/a2a-agents): serve /.well-known/agent-card.json and
# JSON-RPC `message/send` over HTTP. The port below is the one AgentCard.json advertises.
FROM node:22-slim
ARG AGENT=planner
ENV AGENT=${AGENT} HOST=0.0.0.0 PORT=8000 NODE_ENV=production
WORKDIR /app
COPY package.json ./package.json
COPY manifest.json ./manifest.json
COPY dist ./dist
EXPOSE 8000
USER node
CMD ["sh", "-c", "exec node dist/agents/serve.js \"$AGENT\""]
