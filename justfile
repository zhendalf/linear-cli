dev *args:
    bun src/main.ts {{ args }}

# runs the verify suite and prints the release steps (publish is via GitHub Release)
release:
    bun run codegen
    bun x tsc --noEmit
    bunx biome check .
    bun test
    bun run build

    @VERSION=$(node -p "require('./package.json').version") && \
      echo "Current version: $$VERSION"
    @echo "Bump version in package.json (+ plugin manifests), then:"
    @echo "  git commit -am 'chore: release v<version>'"
    @echo "  git push origin main"
    @echo "  gh release create v<version> --title v<version> --notes-file - --target main"
    @echo "(Publishing the GitHub Release triggers .github/workflows/release.yml)"

claude-remove-local:
  -claude plugin remove linear-cli@linear-cli
  -claude plugin marketplace remove linear-cli

claude-install-local:
  claude plugin marketplace add ./
  claude plugin install linear-cli@linear-cli

claude-install-github:
  claude plugin marketplace add zhendalf/linear-cli
  claude plugin install linear-cli@linear-cli
