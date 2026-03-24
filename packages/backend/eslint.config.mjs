import tseslint from "typescript-eslint";

const MUTATION_MESSAGES = {
  adminDeleteActivity:
    "Route admin activity deletes through `internal.mutations.activities.removeInternal` instead of reimplementing lifecycle writes here.",
  adminLogActivityForUser:
    "Route admin activity creation through `internal.mutations.activities.logForUserInternal` instead of reimplementing lifecycle writes here.",
};

const RESTRICTED_CALLS = {
  adminDeleteActivity: new Set([
    "patchActivity",
    "deleteActivity",
    "applyParticipationScoreDeltaAndRecomputeStreak",
    "applyCategoryPointsDelta",
    "applyWeeklyCategoryPointsDeltaFromDate",
  ]),
  adminLogActivityForUser: new Set([
    "insertActivity",
    "calculateFinalActivityScore",
    "applyParticipationScoreDeltaAndRecomputeStreak",
    "applyCategoryPointsDelta",
    "applyWeeklyCategoryPointsDeltaFromDate",
  ]),
};

function getPropertyName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return null;
}

function getIdentifierName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  return null;
}

function isCtxDbInsertIntoActivities(node) {
  if (node.type !== "CallExpression") return false;
  if (node.callee.type !== "MemberExpression" || node.callee.computed) return false;

  const insertName = getIdentifierName(node.callee.property);
  if (insertName !== "insert") return false;

  const dbMember = node.callee.object;
  if (
    dbMember.type !== "MemberExpression" ||
    dbMember.computed ||
    getIdentifierName(dbMember.property) !== "db" ||
    getIdentifierName(dbMember.object) !== "ctx"
  ) {
    return false;
  }

  return node.arguments[0]?.type === "Literal" && node.arguments[0].value === "activities";
}

function getEnclosingAdminMutationName(node) {
  let current = node;

  while (current) {
    if (
      (current.type === "ArrowFunctionExpression" ||
        current.type === "FunctionExpression") &&
      current.parent?.type === "Property" &&
      getPropertyName(current.parent.key) === "handler"
    ) {
      const objectExpression = current.parent.parent;
      const callExpression = objectExpression?.parent;
      const declarator = callExpression?.parent;

      if (
        objectExpression?.type === "ObjectExpression" &&
        callExpression?.type === "CallExpression" &&
        declarator?.type === "VariableDeclarator" &&
        declarator.id.type === "Identifier"
      ) {
        return declarator.id.name;
      }
    }

    current = current.parent;
  }

  return null;
}

const noAdminActivityLifecycleDriftRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent admin activity create/delete mutations from bypassing the canonical activity lifecycle codepaths.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const mutationName = getEnclosingAdminMutationName(node);
        if (
          mutationName !== "adminDeleteActivity" &&
          mutationName !== "adminLogActivityForUser"
        ) {
          return;
        }

        if (
          node.callee.type === "Identifier" &&
          RESTRICTED_CALLS[mutationName].has(node.callee.name)
        ) {
          context.report({
            node,
            message: MUTATION_MESSAGES[mutationName],
          });
          return;
        }

        if (
          mutationName === "adminLogActivityForUser" &&
          isCtxDbInsertIntoActivities(node)
        ) {
          context.report({
            node,
            message: MUTATION_MESSAGES[mutationName],
          });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ["node_modules/**", "_generated/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  {
    files: ["mutations/admin.ts"],
    plugins: {
      architecture: {
        rules: {
          "no-admin-activity-lifecycle-drift": noAdminActivityLifecycleDriftRule,
        },
      },
    },
    rules: {
      "architecture/no-admin-activity-lifecycle-drift": "error",
    },
  },
);
