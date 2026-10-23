import test from "node:test";
import assert from "node:assert/strict";
import { dictionaries, translateMessage } from "../lib/ui-language";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

test("every UI message has Bosnian, German and Spanish translations", () => {
  const keys = new Set(
    Object.values(dictionaries).flatMap((dictionary) =>
      Object.keys(dictionary),
    ),
  );
  for (const key of keys)
    for (const language of ["bs", "de", "es"] as const) {
      assert.ok(dictionaries[language][key]?.trim(), `${language}: ${key}`);
      const parameters = key.match(/\{\w+\}/g) || [];
      assert.deepEqual(
        dictionaries[language][key].match(/\{\w+\}/g) || [],
        parameters,
        `Parameters: ${language}: ${key}`,
      );
    }
});

test("dynamic UI messages preserve counts and names", () => {
  assert.equal(
    translateMessage("FY2027 performance overview", "bs"),
    "Pregled rezultata za FY2027",
  );
  assert.equal(translateMessage("23 unread", "es"), "23 sin leer");
  assert.equal(translateMessage("OVERDUE 2d", "de"), "2 TAGE ÜBERFÄLLIG");
  assert.equal(
    translateMessage("Assigned: Ana Müller", "bs"),
    "Dodijeljeno: Ana Müller",
  );
  assert.equal(translateMessage("  Saving…  ", "de"), "  Wird gespeichert…  ");
  assert.equal(translateMessage("ESO-2026-00123", "es"), "ESO-2026-00123");
  assert.equal(translateMessage("Open report action", "bs"), "OTVORI");
  assert.equal(translateMessage("Open", "bs"), "Otvoreno");
});

test("static interface copy has translations, excluding identifiers and product names", () => {
  const unchanged = new Set([
    "ID",
    "ESO",
    "ESO HUNT",
    "ESO #",
    "FY",
    "• FY",
    "• ID",
    "Starter",
    "Professional",
    "Business",
    "Enterprise",
  ]);
  const files = [
    ...readdirSync("components")
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => `components/${file}`),
    "app/owner/page.tsx",
    "app/register/page.tsx",
  ];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) {
        const text = node.text
          .trim()
          .replace(/\s+/g, " ")
          .replaceAll("&amp;", "&")
          .replaceAll("&apos;", "'");
        let parent: ts.Node | undefined = node.parent,
          protectedText = false;
        while (parent) {
          if (
            ts.isJsxElement(parent) &&
            parent.openingElement.attributes.properties.some(
              (attribute) =>
                ts.isJsxAttribute(attribute) &&
                attribute.name.getText(source) === "data-no-translate",
            )
          )
            protectedText = true;
          parent = parent.parent;
        }
        if (
          !protectedText &&
          /[A-Za-z]{2}/.test(text) &&
          !unchanged.has(text)
        ) {
          for (const language of ["bs", "de", "es"] as const)
            assert.ok(
              dictionaries[language][text],
              `${file}: ${language}: ${text}`,
            );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
