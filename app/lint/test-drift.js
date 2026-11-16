// Oxlint JS plugin: rules that stop browser specs drifting from the source
// they assert against. Each rule answers a recorded CI failure that passed
// `npm run verify` locally and only broke in the Browser Tests job:
//
// - no-hardcoded-rules-version: specs pinned `rulesVersion` strings such as
//   "crystal-worm-child-swarm-paladin-v4"; bumping the version in
//   encounter.json broke every copy (fixed in 7b45835). Derive the value from
//   encounter.json instead.
// - typed-exact-expectation: exact `toEqual` object literals missed fields
//   added to the models (honeyContactSeconds in 7b45835, headingRadians in
//   ebc21db, eight red pushes). `satisfies <Type>` makes `tsc` report the
//   missing or extra field locally.
//
// JS plugins are alpha in oxlint and not covered by semver; the lockfile pins
// the oxlint version this plugin was written against.

/** `<id>-v<N>`, optionally with a `-drill-p<indices>` suffix and `-once`. */
const RULES_VERSION =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-v\d+(?:-drill-p\d+(?:-\d+)*(?:-once)?)?$/;
const EXACT_MATCHERS = new Set(["toEqual", "toStrictEqual"]);

const noHardcodedRulesVersion = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow rulesVersion literals; derive them from encounter.json.",
    },
  },
  create(context) {
    const check = (node, value) => {
      if (typeof value === "string" && RULES_VERSION.test(value))
        context.report({
          node,
          message: `Hardcoded rulesVersion "${value}": derive it from encounter.json so a version bump cannot leave this copy behind.`,
        });
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        // Only a template with no interpolation is a fixed string.
        if (node.expressions.length === 0)
          check(node, node.quasis[0].value.cooked);
      },
    };
  },
};

const typedExactExpectation = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `satisfies <Type>` on object literals passed to exact matchers.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.property.type !== "Identifier" ||
          !EXACT_MATCHERS.has(callee.property.name)
        )
          return;
        const [expected] = node.arguments;
        if (expected?.type === "ObjectExpression")
          context.report({
            node: expected,
            message: `Object literal in ${callee.property.name}() needs \`satisfies <Type>\` so tsc reports fields the model gains or drops.`,
          });
      },
    };
  },
};

export default {
  meta: { name: "test-drift" },
  rules: {
    "no-hardcoded-rules-version": noHardcodedRulesVersion,
    "typed-exact-expectation": typedExactExpectation,
  },
};
