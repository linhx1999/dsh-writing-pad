#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${npm_config_dry_run:-false}" == 'true' ]]; then
  echo '发布预演完成，跳过 npm 版本验证和 Git 标签。'
  exit 0
fi

package_name="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.name)")"
package_version="$(node --input-type=module -e "import pkg from './package.json' with { type: 'json' }; process.stdout.write(pkg.version)")"
release_tag="v${package_version}"

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
