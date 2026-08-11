// `node --import ./scripts/register-ts.mjs --test …` 로 불린다.
// 위 해석기를 로더로 등록하는 것 말고는 하는 일이 없다.
import { register } from "node:module";
register("./ts-resolve.mjs", import.meta.url);
