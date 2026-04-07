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
// Registrations
// =============================================================================

const registrations = require("./src/https/registrations");

exports.approveRegistration = registrations.approveRegistration;
exports.rejectRegistration = registrations.rejectRegistration;
exports.requestMoreInfo = registrations.requestMoreInfo;
exports.bulkApprove = registrations.bulkApprove;
exports.bulkReject = registrations.bulkReject;
exports.pendingApprovalReminder = registrations.pendingApprovalReminder;

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

// =============================================================================
// Self-Registration helpers (Feature 1.3 / 1.4)
// =============================================================================

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Returns true when the identifier has exceeded the rate limit window.
 * Uses a Firestore transaction so concurrent requests are safe.
 */
async function isRateLimited(identifier) {
  const ref = firestore.collection("_rateLimits").doc(identifier);
  try {
    return await firestore.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW_MS;
      const attempts = doc.exists
        ? (doc.data().attempts || []).filter((ts) => ts > windowStart)
        : [];

      if (attempts.length >= RATE_LIMIT_MAX) return true;

      attempts.push(now);
      t.set(ref, { attempts, updatedAt: now });
      return false;
    });
  } catch (e) {
    logger.warn("Rate-limit check failed (allowing request):", e);
    return false;
  }
}

// =============================================================================
// validateCompanyCode — public, no auth required
// Input:  { code: string }
// Output: { success: true, companyId: string, companyName: string }
// =============================================================================

exports.validateCompanyCode = onCall(async (request) => {
  // Per-IP rate limiting
  const ip =
    (request.rawRequest && request.rawRequest.ip) || "unknown";
  const limited = await isRateLimited(`validate:${ip}`);
  if (limited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in a few minutes.",
    );
  }

  const { code } = request.data;
  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "Company code is required.");
  }

  const normalized = code.toUpperCase().trim();
  if (!/^MC-[A-Z0-9]{6}$/.test(normalized)) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid company code format. Expected MC-XXXXXX.",
    );
  }

  try {
    const snapshot = await firestore
      .collection("companies")
      .where("selfRegCode", "==", normalized)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new HttpsError(
        "not-found",
        "Invalid or inactive company code.",
      );
    }

    const companyDoc = snapshot.docs[0];
    return {
      success: true,
      companyId: companyDoc.id,
      companyName: companyDoc.data().name,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("validateCompanyCode error:", error);
    throw new HttpsError("internal", "Failed to validate company code.");
  }
});

// =============================================================================
// submitSelfRegistration — public, no auth required
// Input:  { companyCode, firstName, lastName, email, jobTitle?, department? }
// Output: { success: true, registrationId: string }
// =============================================================================

exports.submitSelfRegistration = onCall(async (request) => {
  const ip =
    (request.rawRequest && request.rawRequest.ip) || "unknown";
  const limited = await isRateLimited(`register:${ip}`);
  if (limited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in a few minutes.",
    );
  }

  const { companyCode, firstName, lastName, email, jobTitle, department } =
    request.data;

  if (!companyCode || !firstName || !lastName || !email) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const normalizedCode = companyCode.toUpperCase().trim();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Verify company is still active
    const snapshot = await firestore
      .collection("companies")
      .where("selfRegCode", "==", normalizedCode)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new HttpsError("not-found", "Invalid or inactive company code.");
    }

    const companyDoc = snapshot.docs[0];
    const companyId = companyDoc.id;

    // Block duplicate pending registrations for the same email + company
    const existing = await firestore
      .collection("selfRegistrations")
      .where("email", "==", normalizedEmail)
      .where("companyId", "==", companyId)
      .where("status", "in", ["pending_otp", "pending_approval"])
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new HttpsError(
        "already-exists",
        "A registration for this email is already in progress.",
      );
    }

    // Generate a 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    const regRef = await firestore.collection("selfRegistrations").add({
      companyId,
      companyCode: normalizedCode,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      jobTitle: (jobTitle || "").trim(),
      department: (department || "").trim(),
      otp,
      otpExpiry,
      status: "pending_otp",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // TODO: send OTP via transactional email (SendGrid / Resend)
    logger.info(`[DEV] OTP for ${normalizedEmail}: ${otp} (reg: ${regRef.id})`);

    return { success: true, registrationId: regRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("submitSelfRegistration error:", error);
    throw new HttpsError("internal", "Registration failed. Please try again.");
  }
});

// =============================================================================
// verifyRegistrationOTP — public, no auth required
// Input:  { registrationId: string, otp: string }
// Output: { success: true }
// =============================================================================

exports.verifyRegistrationOTP = onCall(async (request) => {
  const ip =
    (request.rawRequest && request.rawRequest.ip) || "unknown";
  const limited = await isRateLimited(`otp:${ip}`);
  if (limited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in a few minutes.",
    );
  }

  const { registrationId, otp } = request.data;
  if (!registrationId || !otp) {
    throw new HttpsError(
      "invalid-argument",
      "Missing registrationId or OTP.",
    );
  }

  try {
    const regDoc = await firestore
      .collection("selfRegistrations")
      .doc(registrationId)
      .get();

    if (!regDoc.exists) {
      throw new HttpsError("not-found", "Registration not found.");
    }

    const reg = regDoc.data();

    if (reg.status !== "pending_otp") {
      throw new HttpsError(
        "failed-precondition",
        "This registration is not awaiting OTP verification.",
      );
    }

    if (Date.now() > reg.otpExpiry) {
      throw new HttpsError(
        "deadline-exceeded",
        "OTP has expired. Please start over.",
      );
    }

    if (reg.otp !== otp.trim()) {
      throw new HttpsError("invalid-argument", "Incorrect OTP.");
    }

    // OTP valid — mark verified and create a pending-approval record for HR
    await regDoc.ref.update({
      status: "pending_approval",
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await firestore.collection("pendingUsers").add({
      companyId: reg.companyId,
      registrationId: regDoc.id,
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      jobTitle: reg.jobTitle,
      department: reg.department,
      status: "pending_approval",
      source: "self_registration",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      companyId: reg.companyId,
      action: "self_registration_submitted",
      actorUid: "anonymous",
      actorEmail: reg.email,
      actorRole: "applicant",
      targetType: "pendingUser",
      targetId: regDoc.id,
      metadata: { firstName: reg.firstName, lastName: reg.lastName },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("verifyRegistrationOTP error:", error);
    throw new HttpsError("internal", "OTP verification failed.");
  }
});
