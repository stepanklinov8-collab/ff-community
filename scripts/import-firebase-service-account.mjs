import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Pass the path to the Firebase service-account JSON file.");
}

const credentials = JSON.parse(readFileSync(resolve(sourcePath), "utf8"));
for (const field of ["project_id", "client_email", "private_key"]) {
  if (typeof credentials[field] !== "string" || !credentials[field]) {
    throw new Error(`Firebase JSON is missing ${field}.`);
  }
}

const envPath = resolve(process.cwd(), ".env.local");
let env = readFileSync(envPath, "utf8");

function setEnvValue(key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env)
    ? env.replace(pattern, line)
    : `${env}${env.endsWith("\n") ? "" : "\n"}${line}\n`;
}

setEnvValue("FIREBASE_PROJECT_ID", credentials.project_id);
setEnvValue("FIREBASE_CLIENT_EMAIL", credentials.client_email);
setEnvValue("FIREBASE_PRIVATE_KEY", JSON.stringify(credentials.private_key.replace(/\r\n/g, "\n")));

writeFileSync(envPath, env, "utf8");
console.log("Firebase Admin credentials imported into .env.local.");
