import assert from "node:assert/strict";
import fs from "node:fs";

const expected = process.argv[2];
assert.ok(expected, "usage: node test/assert-pi-version.mjs VERSION");

for (const name of ["pi-ai", "pi-coding-agent"]) {
	const manifestUrl = new URL(
		`../node_modules/@earendil-works/${name}/package.json`,
		import.meta.url,
	);
	const manifest = JSON.parse(fs.readFileSync(manifestUrl, "utf8"));
	assert.equal(manifest.version, expected, `${name} version`);
	console.log(`${name} ${manifest.version}`);
}
