// node --import ./scripts/_register.mjs scripts/<something>.mjs
import { register } from "node:module";
register("./_next-resolve.mjs", import.meta.url);
