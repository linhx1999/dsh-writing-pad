#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == '--help' ]]; then
  echo 'Usage: pnpm release'
  echo 'Checks, previews, publishes the package to npm, verifies it, and creates a local version tag.'
  exit 0
fi

if (( $# > 0 )); then
  echo '错误：发布脚本不接受参数。运行 pnpm release 即可。' >&2
  exit 1
fi

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
pnpm publish --dry-run

echo
read -r -p "输入 publish 确认发布 ${package_name}@${package_version}: " confirmation
if [[ "$confirmation" != 'publish' ]]; then
  echo '已取消发布。'
  exit 0
fi

pnpm publish --access public

published_version=''
for attempt in 1 2 3 4 5; do
  published_version="$(npm view "${package_name}@${package_version}" version 2>/dev/null || true)"
  if [[ "$published_version" == "$package_version" ]]; then
    break
  fi
  if (( attempt < 5 )); then sleep 2; fi
done

if [[ "$published_version" != "$package_version" ]]; then
  echo '错误：npm 发布命令已结束，但暂时无法验证版本；未创建 Git 标签，请稍后手动确认。' >&2
  exit 1
fi

git tag -a "$release_tag" -m "Release ${package_version}"

echo
echo "已发布 ${package_name}@${package_version}"
echo "已创建本地标签 ${release_tag}"
echo "确认无误后运行：git push origin ${release_tag}"
