### Setup

#### local
npm install commander axios js-yaml
npm install --save-dev @types/node @types/js-yaml typescript ts-node


## execution

npx ts-node agtm-cli.ts upload --github https://github.com/aiagenta2z/ai-agent-marketplace
npx ts-node agtm-cli.ts upload --config ./agent.json
npx ts-node agtm-cli.ts upload --config ./agent.yaml


npm login
## compile
npx tsc


### 模拟

npm pack --dry-run


## install
npm publish --access public
npm unpublish @aiagenta2z/agtm@1.0.0 --force


## TypeScript OneKey MCP Router

npm install typescript @types/node ts-node dotenv --save-dev

## build 可能会报错，需要 install再 build
rm -rf ./dist
npm run build
npm publish --access public

## Output Package: https://www.npmjs.com/package/onekey_mcp_router,  This is no scoped package

npm i onekey_mcp_router

