#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo '错误：发布前工作区必须保持干净，请先提交或移除当前改动。' >&2
  git status --short >&2
  exit 1
fi

package_name="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.name)")"
package_version="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.version)")"
release_tag="v${package_version}"

if git rev-parse --verify --quiet "refs/tags/${release_tag}" >/dev/null; then
  echo "错误：本地标签 ${release_tag} 已存在。" >&2
  exit 1
fi

if npm view "${package_name}@${package_version}" version >/dev/null 2>&1; then
  echo "错误：${package_name}@${package_version} 已在 npm 发布，版本号不能重复使用。" >&2
  exit 1
fi

if ! npm whoami >/dev/null 2>&1; then
  echo '错误：尚未登录 npm，请先运行 npm login。' >&2
  exit 1
fi

echo "准备发布 ${package_name}@${package_version}"
pnpm typecheck
pnpm test
pnpm pack --dry-run
