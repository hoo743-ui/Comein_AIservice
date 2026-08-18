// 시험을 돌릴 때만 쓰는 아주 작은 해석기.
//
// 소스는 번들러 규칙(`./intent` — 확장자 없음)으로 적혀 있고, Next 는 그걸 그대로 읽는다.
// 반면 Node 의 ESM 은 확장자를 요구한다. 그렇다고 소스에 `.ts` 를 박으면 Next 빌드가 깨진다
// (실제로 깨졌다). 그래서 어긋나는 자리를 여기 15줄로 메운다 — 새 의존성 없이.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

/** tsconfig 의 `@/*` → `src/*`. 소스가 쓰는 별칭을 시험에서도 같은 뜻으로 읽는다. */
const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

export function resolve(specifier, context, next) {
  const alias = specifier.startsWith("@/") ? resolvePath(SRC, specifier.slice(2)) : null;
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const bare = !/\.[cm]?[jt]sx?$/.test(specifier);

  if (alias) {
    for (const candidate of bare ? [`${alias}.ts`, `${alias}/index.ts`] : [alias]) {
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }
  }
  if (relative && bare && context.parentURL?.startsWith("file:")) {
    const base = dirname(fileURLToPath(context.parentURL));
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      const full = resolvePath(base, candidate);
      if (existsSync(full)) return next(pathToFileURL(full).href, context);
    }
  }
  return next(specifier, context);
}
