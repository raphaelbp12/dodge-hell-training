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
// - no-clock-step-in-poll: stepping the fake clock inside `expect.poll` bounds
//   a simulated wait by wall time, so a slow CI runner gave up before the
//   first hit landed ("real hit feedback stays readable", two red runs).
//   Step a bounded number of simulated frames instead (`stepUntil`).
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

const CLOCK_STEPS = new Set(["runFor", "fastForward"]);

const isMember = (node, property) =>
  node?.type === "MemberExpression" &&
  node.property.type === "Identifier" &&
  node.property.name === property;

/** `expect.poll(...)`. */
const isPoll = (node) => isMember(node.callee, "poll");

/** `<anything>.clock.runFor(...)` or `.clock.fastForward(...)`. */
const isClockStep = (node) =>
  node.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  node.callee.property.type === "Identifier" &&
  CLOCK_STEPS.has(node.callee.property.name) &&
  isMember(node.callee.object, "clock");

/** Visits every descendant node of `node`, skipping parent links. */
function walk(node, visit) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const [key, child] of Object.entries(node))
    if (key !== "parent") walk(child, visit);
}

const noClockStepInPoll = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow stepping the fake clock inside expect.poll; bound simulated waits by frames.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isPoll(node)) return;
        walk(node.arguments[0], (inner) => {
          if (isClockStep(inner))
            context.report({
              node: inner,
              message:
                "Fake-clock step inside expect.poll: the poll's wall-time timeout bounds simulated time. Step a bounded number of frames with stepUntil instead.",
            });
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
    "no-clock-step-in-poll": noClockStepInPoll,
  },
};
