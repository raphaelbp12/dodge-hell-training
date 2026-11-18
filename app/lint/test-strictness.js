// Oxlint JS plugin: rules that keep test assertions specific.
//
// - no-bare-to-throw: `toThrow()` with no argument passes when any error is
//   thrown, so deleting the check under test went unnoticed when a different
//   check threw instead (quality report 2026-11-18, item 2.2). Pass the error
//   class or a message/path pattern that identifies which check fired.
//   `.not.toThrow()` is exempt: it asserts that nothing threw.

const THROW_MATCHERS = new Set(["toThrow", "toThrowError"]);

/** True when `node` is `<expr>.not`. */
const isNot = (node) =>
  node?.type === "MemberExpression" &&
  node.property.type === "Identifier" &&
  node.property.name === "not";

const noBareToThrow = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require toThrow/toThrowError to name the expected error class or message.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.property.type !== "Identifier" ||
          !THROW_MATCHERS.has(callee.property.name) ||
          node.arguments.length > 0 ||
          isNot(callee.object)
        )
          return;
        context.report({
          node,
          message: `${callee.property.name}() with no argument passes on any error: pass the error class or a message pattern that identifies the check.`,
        });
      },
    };
  },
};

export default {
  meta: { name: "test-strictness" },
  rules: { "no-bare-to-throw": noBareToThrow },
};
