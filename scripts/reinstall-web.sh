#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

package_name="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.name)")"
package_version="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.version)")"
tarball="./${package_name}-${package_version}.tgz"

pnpm pack
pnpm dlx @deepseek-ai/dsh@latest plugin --profile web remove "$package_name"
pnpm dlx @deepseek-ai/dsh@latest plugin --profile web add "$tarball"
exec pnpm dlx @deepseek-ai/dsh@latest web
