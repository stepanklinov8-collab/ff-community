import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const normalized = value => value.split(sep).join("/");
export function inspectImports(file, content, root = process.cwd()) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const issues = [];
  const from = normalized(relative(resolve(root, "src"), file));
  const owner = from.match(/^modules\/([^/]+)\//)?.[1];
  const client = source.statements.some(node => ts.isExpressionStatement(node) && node.expression.text === "use client");
  function inspect(specifier) {
    const name = specifier.text;
    if (typeof name !== "string") return;
    const path = name.startsWith("@/") ? name.slice(2) : name.startsWith(".") ? normalized(relative(resolve(root, "src"), resolve(dirname(file), name))) : null;
    const target = path?.match(/^modules\/([^/]+)\/(.+)$/);
    if (target && target[1] !== owner && !/^public(?:\.[cm]?[jt]sx?)?$/.test(target[2])) issues.push("Other modules must use the public entry point: " + name);
    if (owner && path && !target && !/^(platform\/|components\/ui\/|components\/LanguageProvider$|i18n\/)/.test(path)) issues.push("Module may only use platform/UI services: " + name);
    if (owner && /\.css$/.test(name) && !/\.module\.css$/.test(name)) issues.push("Module styles must be scoped: " + name);
    if (owner && /^(@supabase\/|firebase-admin|pg$)/.test(name)) issues.push("Use guarded platform database services: " + name);
    if (client && (path && /(^|\/)(server[^/]*|database)(\.|$)/.test(path) || name === "server-only")) issues.push("Client must not import a server service: " + name);
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) inspect(node.moduleSpecifier);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
      if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) inspect(node.arguments[0]);
      else if (owner) issues.push("Module imports must have a static path");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return issues;
}
export function checkBoundaries(root = process.cwd()) {
  const failures = [];
  function walk(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.[jt]sx?$/.test(file)) for (const message of inspectImports(file, readFileSync(file, "utf8"), root)) failures.push(normalized(relative(root, file)) + ": " + message);
    }
  }
  walk(resolve(root, "src"));
  if (failures.length) throw new Error(failures.join("\n"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkBoundaries();
  console.log("PASS: module boundaries");
}
