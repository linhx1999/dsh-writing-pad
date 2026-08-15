#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

package_name="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.name)")"
package_version="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.version)")"
tarball="./${package_name}-${package_version}.tgz"

pnpm pack
dsh plugin --profile web remove "$package_name"
dsh plugin --profile web add "$tarball"
exec dsh web
