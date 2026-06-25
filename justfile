dev *args:
    bun src/main.ts {{ args }}

# tags the newest release in the changelog
tag:
    bun run codegen
    bun x tsc --noEmit
    bunx biome check .
    bun test

    @VERSION=$(node -p "require('./package.json').version") && \
      echo "Current version: $$VERSION"
    @echo "Bump version in package.json, then commit and tag manually:"
    @echo "  git commit -m 'chore: Release linear-cli version <version>'"
    @echo "  git tag v<version>"
    @echo "  git push origin main --tags"

claude-remove-local:
  -claude plugin remove linear-cli@linear-cli
  -claude plugin marketplace remove linear-cli

claude-install-local:
  claude plugin marketplace add ./
  claude plugin install linear-cli@linear-cli

claude-install-github:
  claude plugin marketplace add zhendalf/linear-cli
  claude plugin install linear-cli@linear-cli
