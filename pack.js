import swc from "@swc/core";
import { writeFile } from "node:fs"
 
const sources = await swc.bundle({
    mode: "production",
    entry: "src/foxel_blockbench.ts",
    options: {
        minify: true
    }
});

await writeFile("foxel_blockbench.js", `(function() {${sources["foxel_blockbench.ts"].code}})();`, () => {});
