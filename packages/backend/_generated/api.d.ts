/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_addMarch2026Categories from "../actions/addMarch2026Categories.js";
import type * as actions_backfillCategoryPoints from "../actions/backfillCategoryPoints.js";
import type * as actions_cleanup from "../actions/cleanup.js";
import type * as actions_clear from "../actions/clear.js";
import type * as actions_createChallengeFromConfig from "../actions/createChallengeFromConfig.js";
import type * as actions_fix2025ActivityTypes from "../actions/fix2025ActivityTypes.js";
import type * as actions_fixContributesToStreak from "../actions/fixContributesToStreak.js";
import type * as actions_payments from "../actions/payments.js";
import type * as actions_rescoreStravaActivities from "../actions/rescoreStravaActivities.js";
import type * as actions_seed from "../actions/seed.js";
import type * as actions_setMarch2026ActivityOrder from "../actions/setMarch2026ActivityOrder.js";
import type * as actions_setMarch2026FinalDays from "../actions/setMarch2026FinalDays.js";
import type * as actions_setup2026ActivityTypes from "../actions/setup2026ActivityTypes.js";
import type * as actions_setup2026Challenges from "../actions/setup2026Challenges.js";
import type * as actions_strava from "../actions/strava.js";
import type * as http from "../http.js";
import type * as httpApi from "../httpApi.js";
import type * as index from "../index.js";
import type * as lib_achievementCriteria from "../lib/achievementCriteria.js";
import type * as lib_achievements from "../lib/achievements.js";
import type * as lib_activityFilters from "../lib/activityFilters.js";
import type * as lib_activityPointsAggregate from "../lib/activityPointsAggregate.js";
import type * as lib_activityWrites from "../lib/activityWrites.js";
import type * as lib_apiKey from "../lib/apiKey.js";
import type * as lib_categoryPoints from "../lib/categoryPoints.js";
import type * as lib_challengePoints from "../lib/challengePoints.js";
import type * as lib_dateOnly from "../lib/dateOnly.js";
import type * as lib_defaultEmailPlan from "../lib/defaultEmailPlan.js";
import type * as lib_emailTemplate from "../lib/emailTemplate.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_latencyMonitoring from "../lib/latencyMonitoring.js";
import type * as lib_mentions from "../lib/mentions.js";
import type * as lib_participationScoring from "../lib/participationScoring.js";
import type * as lib_payments from "../lib/payments.js";
import type * as lib_resend from "../lib/resend.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_strava from "../lib/strava.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as lib_weeks from "../lib/weeks.js";
import type * as migrations from "../migrations.js";
import type * as mutations_achievements from "../mutations/achievements.js";
import type * as mutations_activities from "../mutations/activities.js";
import type * as mutations_activityTypes from "../mutations/activityTypes.js";
import type * as mutations_admin from "../mutations/admin.js";
import type * as mutations_apiKeys from "../mutations/apiKeys.js";
import type * as mutations_apiMutations from "../mutations/apiMutations.js";
import type * as mutations_backfillCategoryPoints from "../mutations/backfillCategoryPoints.js";
import type * as mutations_categories from "../mutations/categories.js";
import type * as mutations_challengeInvites from "../mutations/challengeInvites.js";
import type * as mutations_challenges from "../mutations/challenges.js";
import type * as mutations_cleanup from "../mutations/cleanup.js";
import type * as mutations_clear from "../mutations/clear.js";
import type * as mutations_comments from "../mutations/comments.js";
import type * as mutations_emailSequences from "../mutations/emailSequences.js";
import type * as mutations_fixStreak from "../mutations/fixStreak.js";
import type * as mutations_follows from "../mutations/follows.js";
import type * as mutations_forumPosts from "../mutations/forumPosts.js";
import type * as mutations_integrationMappings from "../mutations/integrationMappings.js";
import type * as mutations_integrations from "../mutations/integrations.js";
import type * as mutations_likes from "../mutations/likes.js";
import type * as mutations_miniGames from "../mutations/miniGames.js";
import type * as mutations_participations from "../mutations/participations.js";
import type * as mutations_paymentConfig from "../mutations/paymentConfig.js";
import type * as mutations_payments from "../mutations/payments.js";
import type * as mutations_rescoreStrava from "../mutations/rescoreStrava.js";
import type * as mutations_stravaWebhook from "../mutations/stravaWebhook.js";
import type * as mutations_templates from "../mutations/templates.js";
import type * as mutations_users from "../mutations/users.js";
import type * as mutations_webhookPayloads from "../mutations/webhookPayloads.js";
import type * as queries_achievements from "../queries/achievements.js";
import type * as queries_activities from "../queries/activities.js";
import type * as queries_activityTypes from "../queries/activityTypes.js";
import type * as queries_admin from "../queries/admin.js";
import type * as queries_apiKeys from "../queries/apiKeys.js";
import type * as queries_backfillCategoryPoints from "../queries/backfillCategoryPoints.js";
import type * as queries_categories from "../queries/categories.js";
import type * as queries_challengeInvites from "../queries/challengeInvites.js";
import type * as queries_challenges from "../queries/challenges.js";
import type * as queries_comments from "../queries/comments.js";
import type * as queries_emailSequences from "../queries/emailSequences.js";
import type * as queries_follows from "../queries/follows.js";
import type * as queries_forumPosts from "../queries/forumPosts.js";
import type * as queries_integrationMappings from "../queries/integrationMappings.js";
import type * as queries_integrations from "../queries/integrations.js";
import type * as queries_memberships from "../queries/memberships.js";
import type * as queries_miniGames from "../queries/miniGames.js";
import type * as queries_notifications from "../queries/notifications.js";
import type * as queries_participations from "../queries/participations.js";
import type * as queries_paymentConfig from "../queries/paymentConfig.js";
import type * as queries_paymentConfigInternal from "../queries/paymentConfigInternal.js";
import type * as queries_templates from "../queries/templates.js";
import type * as queries_users from "../queries/users.js";
import type * as queries_workspaces from "../queries/workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/addMarch2026Categories": typeof actions_addMarch2026Categories;
  "actions/backfillCategoryPoints": typeof actions_backfillCategoryPoints;
  "actions/cleanup": typeof actions_cleanup;
  "actions/clear": typeof actions_clear;
  "actions/createChallengeFromConfig": typeof actions_createChallengeFromConfig;
  "actions/fix2025ActivityTypes": typeof actions_fix2025ActivityTypes;
  "actions/fixContributesToStreak": typeof actions_fixContributesToStreak;
  "actions/payments": typeof actions_payments;
  "actions/rescoreStravaActivities": typeof actions_rescoreStravaActivities;
  "actions/seed": typeof actions_seed;
  "actions/setMarch2026ActivityOrder": typeof actions_setMarch2026ActivityOrder;
  "actions/setMarch2026FinalDays": typeof actions_setMarch2026FinalDays;
  "actions/setup2026ActivityTypes": typeof actions_setup2026ActivityTypes;
  "actions/setup2026Challenges": typeof actions_setup2026Challenges;
  "actions/strava": typeof actions_strava;
  http: typeof http;
  httpApi: typeof httpApi;
  index: typeof index;
  "lib/achievementCriteria": typeof lib_achievementCriteria;
  "lib/achievements": typeof lib_achievements;
  "lib/activityFilters": typeof lib_activityFilters;
  "lib/activityPointsAggregate": typeof lib_activityPointsAggregate;
  "lib/activityWrites": typeof lib_activityWrites;
  "lib/apiKey": typeof lib_apiKey;
  "lib/categoryPoints": typeof lib_categoryPoints;
  "lib/challengePoints": typeof lib_challengePoints;
  "lib/dateOnly": typeof lib_dateOnly;
  "lib/defaultEmailPlan": typeof lib_defaultEmailPlan;
  "lib/emailTemplate": typeof lib_emailTemplate;
  "lib/ids": typeof lib_ids;
  "lib/latencyMonitoring": typeof lib_latencyMonitoring;
  "lib/mentions": typeof lib_mentions;
  "lib/participationScoring": typeof lib_participationScoring;
  "lib/payments": typeof lib_payments;
  "lib/resend": typeof lib_resend;
  "lib/scoring": typeof lib_scoring;
  "lib/strava": typeof lib_strava;
  "lib/stripe": typeof lib_stripe;
  "lib/weeks": typeof lib_weeks;
  migrations: typeof migrations;
  "mutations/achievements": typeof mutations_achievements;
  "mutations/activities": typeof mutations_activities;
  "mutations/activityTypes": typeof mutations_activityTypes;
  "mutations/admin": typeof mutations_admin;
  "mutations/apiKeys": typeof mutations_apiKeys;
  "mutations/apiMutations": typeof mutations_apiMutations;
  "mutations/backfillCategoryPoints": typeof mutations_backfillCategoryPoints;
  "mutations/categories": typeof mutations_categories;
  "mutations/challengeInvites": typeof mutations_challengeInvites;
  "mutations/challenges": typeof mutations_challenges;
  "mutations/cleanup": typeof mutations_cleanup;
  "mutations/clear": typeof mutations_clear;
  "mutations/comments": typeof mutations_comments;
  "mutations/emailSequences": typeof mutations_emailSequences;
  "mutations/fixStreak": typeof mutations_fixStreak;
  "mutations/follows": typeof mutations_follows;
  "mutations/forumPosts": typeof mutations_forumPosts;
  "mutations/integrationMappings": typeof mutations_integrationMappings;
  "mutations/integrations": typeof mutations_integrations;
  "mutations/likes": typeof mutations_likes;
  "mutations/miniGames": typeof mutations_miniGames;
  "mutations/participations": typeof mutations_participations;
  "mutations/paymentConfig": typeof mutations_paymentConfig;
  "mutations/payments": typeof mutations_payments;
  "mutations/rescoreStrava": typeof mutations_rescoreStrava;
  "mutations/stravaWebhook": typeof mutations_stravaWebhook;
  "mutations/templates": typeof mutations_templates;
  "mutations/users": typeof mutations_users;
  "mutations/webhookPayloads": typeof mutations_webhookPayloads;
  "queries/achievements": typeof queries_achievements;
  "queries/activities": typeof queries_activities;
  "queries/activityTypes": typeof queries_activityTypes;
  "queries/admin": typeof queries_admin;
  "queries/apiKeys": typeof queries_apiKeys;
  "queries/backfillCategoryPoints": typeof queries_backfillCategoryPoints;
  "queries/categories": typeof queries_categories;
  "queries/challengeInvites": typeof queries_challengeInvites;
  "queries/challenges": typeof queries_challenges;
  "queries/comments": typeof queries_comments;
  "queries/emailSequences": typeof queries_emailSequences;
  "queries/follows": typeof queries_follows;
  "queries/forumPosts": typeof queries_forumPosts;
  "queries/integrationMappings": typeof queries_integrationMappings;
  "queries/integrations": typeof queries_integrations;
  "queries/memberships": typeof queries_memberships;
  "queries/miniGames": typeof queries_miniGames;
  "queries/notifications": typeof queries_notifications;
  "queries/participations": typeof queries_participations;
  "queries/paymentConfig": typeof queries_paymentConfig;
  "queries/paymentConfigInternal": typeof queries_paymentConfigInternal;
  "queries/templates": typeof queries_templates;
  "queries/users": typeof queries_users;
  "queries/workspaces": typeof queries_workspaces;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
          oneBatchOnly?: boolean;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
  activityPointsAggregate: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any
      >;
    };
  };
};
