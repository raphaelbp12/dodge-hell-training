// Oxlint JS plugin: keeps ambient entropy and wall-clock time out of the
// simulation core (plan V22 A02; seed determinism G13, and the project rule
// against a second simulation clock). Everything the core needs comes from the
// seeded random source or the fixed step, so these calls are reported:
//
//   Math.random(), Date.now(), new Date() with no arguments,
//   performance.now(), crypto.getRandomValues(), crypto.randomUUID()
//
// A legitimate use keeps an inline `oxlint-disable-next-line` comment that
// states its reason and decision ID.
//
// JS plugins are alpha in oxlint and not covered by semver; the lockfile pins
// the oxlint version this plugin was written against.

const FORBIDDEN_CALLS = new Map([
  ["Math", new Set(["random"])],
  ["Date", new Set(["now"])],
  ["performance", new Set(["now"])],
  ["crypto", new Set(["getRandomValues", "randomUUID"])],
]);

const noAmbientEntropy = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ambient entropy and wall-clock reads in the simulation core.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.object.type !== "Identifier" ||
          callee.property.type !== "Identifier"
        )
          return;
        const methods = FORBIDDEN_CALLS.get(callee.object.name);
        if (methods?.has(callee.property.name))
          context.report({
            node,
            message: `${callee.object.name}.${callee.property.name}() reads ambient entropy or time. Use the seeded random source or the fixed simulation step (G13).`,
          });
      },
      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          node.arguments.length === 0
        )
          context.report({
            node,
            message:
              "new Date() with no arguments reads the wall clock. Pass an explicit timestamp or use the fixed simulation step (G13).",
          });
      },
    };
  },
};

export default {
  meta: { name: "determinism" },
  rules: {
    "no-ambient-entropy": noAmbientEntropy,
  },
};
