/**
 * MeritCyc Cloud Functions
 *
 * Architecture:
 *   platform_admin (Lumora) — creates companies, no companyId
 *   super_admin (company owner) — created BY platform_admin, has companyId
 *
 * Rules enforced:
 *   #1  All writes go through Cloud Functions
 *   #3  Every action writes to auditLogs
 *   #5  Company isolation via companyId in custom claims
 *   #10 Structured error responses
 */

const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const firestore = admin.firestore();

// =============================================================================
// Helper: write audit log entry (blueprint rule #3)
// =============================================================================

async function writeAuditLog({
  companyId,
  action,
  actorUid,
  actorEmail,
  actorRole,
  targetType,
  targetId,
  before = null,
  after = null,
  metadata = null,
}) {
  await firestore.collection("auditLogs").add({
    companyId: companyId || "platform",
    action,
    actorUid,
    actorEmail,
    actorRole,
    targetType,
    targetId,
    ...(before && { before }),
    ...(after && { after }),
    ...(metadata && { metadata }),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// =============================================================================
// Helper: verify caller is platform_admin
// =============================================================================

async function requirePlatformAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // Check custom claims
  const token = request.auth.token;
  if (token.role === "platform_admin") return;

  // Fallback: check Firestore (for legacy users)
  const userDoc = await firestore
    .collection("users")
    .doc(request.auth.uid)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "User not found.");
  }

  const role = userDoc.data().role;
  if (role !== "platform_admin" && role !== "Super Admin") {
    throw new HttpsError(
      "permission-denied",
      "Only platform admins can perform this action.",
    );
  }
}

// =============================================================================
// createCompanyWithAdmin
// Called by platform_admin to register a new company + its super_admin
// =============================================================================

exports.createCompanyWithAdmin = onCall(async (request) => {
  await requirePlatformAdmin(request);

  const {
    companyName,
    address,
    mobileNumber,
    adminName,
    adminEmail,
    adminPassword,
  } = request.data;

  // Validation
  if (
    !adminEmail ||
    !adminPassword ||
    !adminName ||
    !companyName ||
    !address ||
    !mobileNumber
  ) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  if (adminPassword.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 6 characters.",
    );
  }

  try {
    // 1. Create company document first to get companyId
    const companyRef = await firestore.collection("companies").add({
      name: companyName,
      email: adminEmail,
      address,
      mobileNumber,
      plan: "trial",
      status: "active",
      employeeCount: 1,
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const companyId = companyRef.id;

    // 2. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });

    // 3. Set custom claims: super_admin scoped to this company
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "super_admin",
      companyId,
      approved: true,
    });

    // 4. Create user document with companyId
    await firestore.collection("users").doc(userRecord.uid).set({
      email: adminEmail,
      name: adminName,
      role: "super_admin",
      companyId,
      approved: true,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Link company back to creator
    await companyRef.update({ createdBy: userRecord.uid });

    // 6. Audit log
    await writeAuditLog({
      companyId,
      action: "company_created",
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || "",
      actorRole: "platform_admin",
      targetType: "company",
      targetId: companyId,
      after: { companyName, adminEmail, plan: "trial" },
    });

    return {
      success: true,
      companyId,
      uid: userRecord.uid,
      message: `Company "${companyName}" created with super admin ${adminEmail}`,
    };
  } catch (error) {
    logger.error("Error in createCompanyWithAdmin:", error);
    throw new HttpsError(
      "internal",
      error.message || "An error occurred while creating the company.",
    );
  }
});

// =============================================================================
// toggleCompanyStatus
// =============================================================================

exports.toggleCompanyStatus = onCall(async (request) => {
  await requirePlatformAdmin(request);

  const { companyId, currentStatus } = request.data;

  if (!companyId || !currentStatus) {
    throw new HttpsError(
      "invalid-argument",
      "Missing companyId or currentStatus.",
    );
  }

  try {
    const newStatus = currentStatus === "active" ? "inactive" : "active";

    await firestore.collection("companies").doc(companyId).update({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      companyId,
      action: "company_status_changed",
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || "",
      actorRole: "platform_admin",
      targetType: "company",
      targetId: companyId,
      before: { status: currentStatus },
      after: { status: newStatus },
    });

    return { success: true, newStatus };
  } catch (error) {
    logger.error("Error in toggleCompanyStatus:", error);
    throw new HttpsError("internal", error.message);
  }
});

// =============================================================================
// Invites
// =============================================================================

const invites = require("./src/https/invites");

exports.sendEmployeeInvite = invites.sendEmployeeInvite;
exports.bulkImportEmployees = invites.bulkImportEmployees;
exports.getInvitePreview = invites.getInvitePreview;
exports.acceptInvite = invites.acceptInvite;
exports.resendInvite = invites.resendInvite;
exports.revokeInvite = invites.revokeInvite;

// =============================================================================
// deleteCompany — soft delete with 30-day grace period
// =============================================================================

exports.deleteCompany = onCall(async (request) => {
  await requirePlatformAdmin(request);

  const { companyId } = request.data;

  if (!companyId) {
    throw new HttpsError("invalid-argument", "Missing companyId.");
  }

  try {
    await firestore
      .collection("companies")
      .doc(companyId)
      .update({
        status: "suspended",
        deletionScheduledAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await writeAuditLog({
      companyId,
      action: "company_deleted",
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || "",
      actorRole: "platform_admin",
      targetType: "company",
      targetId: companyId,
      metadata: { gracePeriodDays: 30 },
    });

    return {
      success: true,
      message: "Company scheduled for deletion in 30 days.",
    };
  } catch (error) {
    logger.error("Error in deleteCompany:", error);
    throw new HttpsError("internal", error.message);
  }
});
