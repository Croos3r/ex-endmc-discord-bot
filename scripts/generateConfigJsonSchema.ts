import { writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import packageJson from "../package.json" with { type: "json" };
import { ConfigurationSchema } from "../src/configuration.service.js";

const version = process.argv[2] ?? packageJson.version ?? "latest";

console.log(`Generating configuration schema for version ${version}`);

const schema = zodToJsonSchema(ConfigurationSchema, `configuration-${version}`);
writeFileSync(`configuration.${version}.schema.json`, JSON.stringify(schema, null, 2));
