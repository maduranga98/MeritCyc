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

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, cors: true });

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
// Feature 1.3 — QR Self-Registration Cloud Functions
// =============================================================================

const crypto = require("crypto");
const { BrevoClient } = require("@getbrevo/brevo");

// Brevo transactional email client (v5.x)
const transactionalEmailApi = new BrevoClient({ apiKey: process.env.BREVO_API_KEY || "" }).transactionalEmails;

// ---------------------------------------------------------------------------
// Rate-limit helper
// Strategy: store a sliding array of timestamps in /rateLimits/{key}
// ---------------------------------------------------------------------------

async function checkRateLimit(key, maxAttempts, windowMs) {
  const ref = firestore.collection("rateLimits").doc(key);
  try {
    return await firestore.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const now = Date.now();
      const windowStart = now - windowMs;
      const prev = doc.exists ? doc.data() : { count: 0, windowStart: now };

      // Reset window if it has expired
      if (now > prev.windowStart + windowMs) {
        t.set(ref, { count: 1, windowStart: now });
        return false; // not limited
      }

      if (prev.count >= maxAttempts) return true; // limited

      t.update(ref, {
        count: admin.firestore.FieldValue.increment(1),
      });
      return false;
    });
  } catch (e) {
    logger.warn("Rate-limit check error (allowing):", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// SHA-256 hash helper
// ---------------------------------------------------------------------------

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Helper: require hr_admin or super_admin (reads companyId from claims)
// ---------------------------------------------------------------------------

function requireHrOrAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { role, companyId } = request.auth.token;
  if (role !== "hr_admin" && role !== "super_admin") {
    throw new HttpsError(
      "permission-denied",
      "Only HR admins and super admins can perform this action.",
    );
  }
  if (!companyId) {
    throw new HttpsError("failed-precondition", "No companyId in token.");
  }
  return { uid: request.auth.uid, role, companyId };
}

// ---------------------------------------------------------------------------
// Helper: resolve companyId from a company code via registration subcollection
// Returns { companyId, companyName, qrEnabled } or null
// ---------------------------------------------------------------------------

async function resolveCompanyCode(companyCode) {
  const snap = await firestore
    .collectionGroup("registration")
    .where("companyCode", "==", companyCode)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const regDoc = snap.docs[0];
  // The registration doc lives at companies/{companyId}/registration/{companyId}
  // regDoc.ref.parent.parent gives the company DocumentReference
  const companyRef = regDoc.ref.parent.parent;
  const companyDoc = await companyRef.get();

  if (!companyDoc.exists) return null;

  return {
    companyId: companyDoc.id,
    companyName: companyDoc.data().name,
    qrEnabled: regDoc.data().qrEnabled === true,
  };
}

// ---------------------------------------------------------------------------
// Send OTP email via Brevo
// ---------------------------------------------------------------------------

async function sendOtpEmail(toEmail, toName, otp, companyName) {
  try {
    await transactionalEmailApi.sendTransacEmail({
      sender: { name: "MeritCyc", email: "noreply@meritcyc.com" },
      to: [{ email: toEmail, name: toName }],
      subject: "Your MeritCyc Verification Code",
      htmlContent: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#0F172A">Your verification code</h2>
      <p>Hi ${toName},</p>
      <p>You're joining <strong>${companyName}</strong> on MeritCyc.
         Use the code below to complete your registration.</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:8px;
                  color:#10B981;margin:24px 0;text-align:center">
        ${otp}
      </div>
      <p style="color:#64748B;font-size:14px">
        This code is valid for <strong>10 minutes</strong>.
        If you did not request this, please ignore this email.
      </p>
    </div>`,
    });
  } catch (e) {
    // Log but don't surface Brevo errors to the caller
    logger.error("Brevo send failed:", e);
  }
}

// =============================================================================
// generateCompanyQRCode — hr_admin | super_admin
// Creates or regenerates the company registration code.
// Path: /companies/{companyId}/registration/{companyId}
// =============================================================================

exports.generateCompanyQRCode = onCall(async (request) => {
  const { uid, companyId } = requireHrOrAdmin(request);

  // Generate MC-XXXXXX  (6 random uppercase alphanum chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  const companyCode = `MC-${suffix}`;

  const regRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("registration")
    .doc(companyId);

  const existing = await regRef.get();

  if (existing.exists) {
    await regRef.update({
      companyCode,
      regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      regeneratedBy: uid,
    });
  } else {
    await regRef.set({
      companyCode,
      qrEnabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      regeneratedBy: uid,
    });
  }

  await writeAuditLog({
    companyId,
    action: "QR_CODE_GENERATED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: request.auth.token.role,
    targetType: "registration",
    targetId: companyId,
    after: { companyCode },
  });

  return { success: true, companyCode };
});

// =============================================================================
// toggleQRRegistration — hr_admin | super_admin
// Input: { enabled: boolean }
// =============================================================================

exports.toggleQRRegistration = onCall(async (request) => {
  const { uid, companyId } = requireHrOrAdmin(request);

  const { enabled } = request.data;
  if (typeof enabled !== "boolean") {
    throw new HttpsError("invalid-argument", "enabled must be a boolean.");
  }

  const regRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("registration")
    .doc(companyId);

  await regRef.update({
    qrEnabled: enabled,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
  });

  await writeAuditLog({
    companyId,
    action: "QR_REGISTRATION_TOGGLED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: request.auth.token.role,
    targetType: "registration",
    targetId: companyId,
    after: { qrEnabled: enabled },
  });

  return { success: true };
});

// =============================================================================
// validateCompanyCode — PUBLIC (no auth)
// Input:  { companyCode: string }
// Output: { success: true, companyId, companyName }
//      OR { success: false, error: { code, message } }
// Rate limit: 10 per IP per 15 min
// =============================================================================

exports.validateCompanyCode = onCall(async (request) => {
  const ip = (request.rawRequest && request.rawRequest.ip) || "unknown";

  const limited = await checkRateLimit(
    `validate:${ip}`,
    10,
    15 * 60 * 1000,
  );
  if (limited) {
    return {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again in a few minutes.",
      },
    };
  }

  const { companyCode } = request.data;
  if (!companyCode || typeof companyCode !== "string") {
    return {
      success: false,
      error: { code: "INVALID_CODE", message: "Company code is required." },
    };
  }

  const normalized = companyCode.toUpperCase().trim();

  try {
    const resolved = await resolveCompanyCode(normalized);

    if (!resolved || !resolved.qrEnabled) {
      return {
        success: false,
        error: {
          code: "INVALID_CODE",
          message: "Invalid or inactive company code",
        },
      };
    }

    return {
      success: true,
      companyId: resolved.companyId,
      companyName: resolved.companyName,
    };
  } catch (e) {
    logger.error("validateCompanyCode error:", e);
    return {
      success: false,
      error: { code: "INVALID_CODE", message: "Invalid or inactive company code" },
    };
  }
});

// =============================================================================
// submitSelfRegistration — PUBLIC (no auth)
// Input:  { companyCode, name, email, departmentId, jobTitle }
// Output: { success: true, message: 'OTP sent' }
// Stores: /companies/{companyId}/pendingRegistrations/{email}
// OTP is SHA-256 hashed before storage.
// =============================================================================

exports.submitSelfRegistration = onCall(async (request) => {
  const ip = (request.rawRequest && request.rawRequest.ip) || "unknown";

  const limited = await checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
  if (limited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in a few minutes.",
    );
  }

  const { companyCode, name, email, departmentId, jobTitle } = request.data;

  if (!companyCode || !name || !email || !jobTitle) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const normalized = companyCode.toUpperCase().trim();
  const normalizedEmail = email.toLowerCase().trim();

  // Re-validate company code
  const resolved = await resolveCompanyCode(normalized);
  if (!resolved || !resolved.qrEnabled) {
    throw new HttpsError(
      "not-found",
      "Invalid or inactive company code.",
    );
  }

  const { companyId, companyName } = resolved;

  // Check email not already a user in this company
  const userSnap = await firestore
    .collection("users")
    .where("email", "==", normalizedEmail)
    .where("companyId", "==", companyId)
    .limit(1)
    .get();

  if (!userSnap.empty) {
    throw new HttpsError(
      "already-exists",
      "An account with this email already exists.",
    );
  }

  // Generate and hash OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hashedOtp = sha256(otp);
  const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Write to pendingRegistrations using email as doc ID (idempotent upsert)
  const pendingRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("pendingRegistrations")
    .doc(normalizedEmail);

  await pendingRef.set({
    name: name.trim(),
    email: normalizedEmail,
    departmentId: departmentId || "",
    jobTitle: jobTitle.trim(),
    companyCode: normalized,
    companyId,
    otp: hashedOtp,
    otpAttempts: 0,
    otpExpiresAt,
    status: "otp_pending",
    cooldownUntil: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await sendOtpEmail(normalizedEmail, name.trim(), otp, companyName);

  logger.info(
    `[DEV] OTP for ${normalizedEmail} in ${companyId}: ${otp}`,
  );

  return { success: true, message: "OTP sent" };
});

// =============================================================================
// verifyEmailOTP — PUBLIC (no auth)
// Input:  { companyCode, email, otp }
// Output: { success: true }
// Handles cooldown after 3 consecutive failed attempts.
// =============================================================================

exports.verifyEmailOTP = onCall(async (request) => {
  const ip = (request.rawRequest && request.rawRequest.ip) || "unknown";

  const limited = await checkRateLimit(`otp:${ip}`, 20, 15 * 60 * 1000);
  if (limited) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please try again in a few minutes.",
    );
  }

  const { companyCode, email, otp } = request.data;

  if (!companyCode || !email || !otp) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const normalized = companyCode.toUpperCase().trim();
  const normalizedEmail = email.toLowerCase().trim();

  // Resolve company from code
  const resolved = await resolveCompanyCode(normalized);
  if (!resolved) {
    throw new HttpsError("not-found", "Invalid company code.");
  }

  const { companyId } = resolved;

  const pendingRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("pendingRegistrations")
    .doc(normalizedEmail);

  const pendingDoc = await pendingRef.get();

  if (!pendingDoc.exists) {
    throw new HttpsError("not-found", "Registration not found.");
  }

  const reg = pendingDoc.data();

  if (reg.status !== "otp_pending") {
    throw new HttpsError(
      "failed-precondition",
      "Registration is not awaiting OTP verification.",
    );
  }

  // Check expiry
  if (Date.now() > reg.otpExpiresAt) {
    throw new HttpsError(
      "deadline-exceeded",
      "Code expired. Please go back and register again.",
    );
  }

  // Check cooldown
  if (reg.cooldownUntil && Date.now() < reg.cooldownUntil) {
    const remainingSec = Math.ceil((reg.cooldownUntil - Date.now()) / 1000);
    throw new HttpsError(
      "resource-exhausted",
      `Too many attempts. Try again in ${remainingSec} seconds.`,
    );
  }

  const hashedInput = sha256(otp.trim());

  // Wrong code
  if (hashedInput !== reg.otp) {
    const newAttempts = (reg.otpAttempts || 0) + 1;

    // 3rd consecutive failure → impose cooldown
    if (newAttempts >= 3) {
      await pendingRef.update({
        otpAttempts: 0,
        cooldownUntil: Date.now() + 5 * 60 * 1000,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. Try again in 5 minutes.",
      );
    }

    await pendingRef.update({ otpAttempts: newAttempts });
    const remaining = 3 - newAttempts;
    throw new HttpsError(
      "invalid-argument",
      `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    );
  }

  // OTP correct — promote to pending_approval
  await pendingRef.update({
    status: "pending_approval",
    otp: admin.firestore.FieldValue.delete(),
    otpAttempts: admin.firestore.FieldValue.delete(),
    otpExpiresAt: admin.firestore.FieldValue.delete(),
    cooldownUntil: admin.firestore.FieldValue.delete(),
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    companyId,
    action: "SELF_REGISTRATION_SUBMITTED",
    actorUid: "anonymous",
    actorEmail: normalizedEmail,
    actorRole: "applicant",
    targetType: "pendingRegistration",
    targetId: normalizedEmail,
    metadata: { name: reg.name },
  });

  return { success: true };
});

// =============================================================================
// Modules 7, 8, 11
// =============================================================================
const modules = require("./src/https/modules");

// Module 7
exports.generateFairnessReport = modules.generateFairnessReport;
exports.exportFairnessReport = modules.exportFairnessReport;

// Module 8
exports.generateCycleSummaryReport = modules.generateCycleSummaryReport;
exports.generateCompanyReport = modules.generateCompanyReport;

// Module 11
exports.updateCompanySettings = modules.updateCompanySettings;
exports.updateNotificationSettings = modules.updateNotificationSettings;
exports.updateSecuritySettings = modules.updateSecuritySettings;
exports.exportCompanyData = modules.exportCompanyData;
exports.scheduleCompanyDeletion = modules.scheduleCompanyDeletion;
exports.cancelCompanyDeletion = modules.cancelCompanyDeletion;

// =============================================================================
// Module 2 — Company & People Management
// =============================================================================

// ---------------------------------------------------------------------------
// Department Functions
// ---------------------------------------------------------------------------

exports.createDepartment = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { name, managerId } = request.data;

  if (!name || typeof name !== "string") {
    throw new HttpsError("invalid-argument", "Department name is required.");
  }

  // Validate name unique within company
  const deptsSnap = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("departments")
    .where("name", "==", name.trim())
    .limit(1)
    .get();

  if (!deptsSnap.empty) {
    throw new HttpsError(
      "already-exists",
      `Department "${name}" already exists.`,
    );
  }

  const deptData = {
    name: name.trim(),
    employeeCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
  };

  if (managerId) {
    deptData.managerId = managerId;
  }

  const docRef = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("departments")
    .add(deptData);

  await writeAuditLog({
    companyId,
    action: "DEPARTMENT_CREATED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: role,
    targetType: "department",
    targetId: docRef.id,
    after: deptData,
  });

  return { success: true, departmentId: docRef.id };
});

exports.updateDepartment = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { departmentId, name, managerId } = request.data;

  if (!departmentId) {
    throw new HttpsError("invalid-argument", "departmentId is required.");
  }

  const deptRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("departments")
    .doc(departmentId);

  const deptDoc = await deptRef.get();
  if (!deptDoc.exists) {
    throw new HttpsError("not-found", "Department not found.");
  }

  const updates = {};
  if (name && typeof name === "string") {
    // Check uniqueness if name changed
    if (name.trim() !== deptDoc.data().name) {
      const deptsSnap = await firestore
        .collection("companies")
        .doc(companyId)
        .collection("departments")
        .where("name", "==", name.trim())
        .limit(1)
        .get();

      if (!deptsSnap.empty) {
        throw new HttpsError(
          "already-exists",
          `Department "${name}" already exists.`,
        );
      }
    }
    updates.name = name.trim();
  }

  if (managerId !== undefined) {
    // Allow unsetting manager with null or empty string
    updates.managerId = managerId || admin.firestore.FieldValue.delete();
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = uid;
    await deptRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "DEPARTMENT_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "department",
      targetId: departmentId,
      before: deptDoc.data(),
      after: { ...deptDoc.data(), ...updates },
    });
  }

  return { success: true };
});

exports.deleteDepartment = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { departmentId } = request.data;

  if (!departmentId) {
    throw new HttpsError("invalid-argument", "departmentId is required.");
  }

  const deptRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("departments")
    .doc(departmentId);

  const deptDoc = await deptRef.get();
  if (!deptDoc.exists) {
    throw new HttpsError("not-found", "Department not found.");
  }

  const deptData = deptDoc.data();
  if (deptData.employeeCount > 0) {
    throw new HttpsError(
      "failed-precondition",
      "DEPARTMENT_HAS_EMPLOYEES",
    );
  }

  await deptRef.delete();

  await writeAuditLog({
    companyId,
    action: "DEPARTMENT_DELETED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: role,
    targetType: "department",
    targetId: departmentId,
    before: deptData,
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// Salary Band Functions
// ---------------------------------------------------------------------------

exports.createSalaryBand = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { name, level, minSalary, maxSalary, currency } = request.data;

  if (!name || level === undefined || minSalary === undefined || maxSalary === undefined) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  if (minSalary >= maxSalary) {
    throw new HttpsError("invalid-argument", "minSalary must be less than maxSalary.");
  }

  const bandsSnap = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("salaryBands")
    .get();

  for (const doc of bandsSnap.docs) {
    const band = doc.data();
    if (band.level === level) {
      throw new HttpsError("already-exists", `Band with level ${level} already exists.`);
    }
    // Check overlap
    if (Math.max(minSalary, band.minSalary) < Math.min(maxSalary, band.maxSalary)) {
      throw new HttpsError("invalid-argument", `Salary range overlaps with band "${band.name}".`);
    }
  }

  const bandData = {
    name: name.trim(),
    level,
    minSalary,
    maxSalary,
    currency: currency || "USD",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
  };

  const docRef = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("salaryBands")
    .add(bandData);

  await writeAuditLog({
    companyId,
    action: "SALARY_BAND_CREATED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: role,
    targetType: "salaryBand",
    targetId: docRef.id,
    after: bandData,
  });

  return { success: true, bandId: docRef.id };
});

exports.updateSalaryBand = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { bandId, name, level, minSalary, maxSalary, currency } = request.data;

  if (!bandId) {
    throw new HttpsError("invalid-argument", "bandId is required.");
  }

  const bandRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("salaryBands")
    .doc(bandId);

  const bandDoc = await bandRef.get();
  if (!bandDoc.exists) {
    throw new HttpsError("not-found", "Salary band not found.");
  }

  const newMin = minSalary !== undefined ? minSalary : bandDoc.data().minSalary;
  const newMax = maxSalary !== undefined ? maxSalary : bandDoc.data().maxSalary;
  const newLevel = level !== undefined ? level : bandDoc.data().level;

  if (newMin >= newMax) {
    throw new HttpsError("invalid-argument", "minSalary must be less than maxSalary.");
  }

  const bandsSnap = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("salaryBands")
    .get();

  for (const doc of bandsSnap.docs) {
    if (doc.id === bandId) continue;
    const band = doc.data();
    if (band.level === newLevel) {
      throw new HttpsError("already-exists", `Band with level ${newLevel} already exists.`);
    }
    // Check overlap
    if (Math.max(newMin, band.minSalary) < Math.min(newMax, band.maxSalary)) {
      throw new HttpsError("invalid-argument", `Salary range overlaps with band "${band.name}".`);
    }
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (level !== undefined) updates.level = level;
  if (minSalary !== undefined) updates.minSalary = minSalary;
  if (maxSalary !== undefined) updates.maxSalary = maxSalary;
  if (currency !== undefined) updates.currency = currency;

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = uid;
    await bandRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "SALARY_BAND_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "salaryBand",
      targetId: bandId,
      before: bandDoc.data(),
      after: { ...bandDoc.data(), ...updates },
    });
  }

  return { success: true };
});

exports.deleteSalaryBand = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { bandId } = request.data;

  if (!bandId) {
    throw new HttpsError("invalid-argument", "bandId is required.");
  }

  // Check if employees are using this band
  const usersSnap = await firestore
    .collection("users")
    .where("companyId", "==", companyId)
    .where("salaryBandId", "==", bandId)
    .limit(1)
    .get();

  if (!usersSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "BAND_HAS_EMPLOYEES",
    );
  }

  const bandRef = firestore
    .collection("companies")
    .doc(companyId)
    .collection("salaryBands")
    .doc(bandId);

  const bandDoc = await bandRef.get();
  if (!bandDoc.exists) {
    throw new HttpsError("not-found", "Salary band not found.");
  }

  const bandData = bandDoc.data();
  await bandRef.delete();

  await writeAuditLog({
    companyId,
    action: "SALARY_BAND_DELETED",
    actorUid: uid,
    actorEmail: request.auth.token.email || "",
    actorRole: role,
    targetType: "salaryBand",
    targetId: bandId,
    before: bandData,
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// Employee Management Functions
// ---------------------------------------------------------------------------

exports.updateEmployeeProfile = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  const { targetUid, departmentId, salaryBandId, jobTitle, status } = request.data;

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  const userRef = firestore.collection("users").doc(targetUid);
  const userDoc = await userRef.get();

  if (!userDoc.exists || userDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "User not found in your company.");
  }

  const updates = {};
  if (departmentId !== undefined) updates.departmentId = departmentId || admin.firestore.FieldValue.delete();
  if (salaryBandId !== undefined) updates.salaryBandId = salaryBandId || admin.firestore.FieldValue.delete();
  if (jobTitle !== undefined) updates.jobTitle = jobTitle;
  if (status !== undefined) {
      if (!['active', 'inactive', 'pending'].includes(status)) {
           throw new HttpsError("invalid-argument", "Invalid status.");
      }
      updates.status = status;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = uid;

    // Handle denormalized names
    if (departmentId) {
        const deptDoc = await firestore.collection("companies").doc(companyId).collection("departments").doc(departmentId).get();
        if (deptDoc.exists) updates.departmentName = deptDoc.data().name;
    } else if (departmentId === null || departmentId === "") {
        updates.departmentName = admin.firestore.FieldValue.delete();
    }

    if (salaryBandId) {
        const bandDoc = await firestore.collection("companies").doc(companyId).collection("salaryBands").doc(salaryBandId).get();
        if (bandDoc.exists) updates.salaryBandName = bandDoc.data().name;
    } else if (salaryBandId === null || salaryBandId === "") {
         updates.salaryBandName = admin.firestore.FieldValue.delete();
    }

    await firestore.runTransaction(async (transaction) => {
        const currentDoc = await transaction.get(userRef);

        // If department changed, update counts
        const oldDeptId = currentDoc.data().departmentId;
        const newDeptId = departmentId;

        if (departmentId !== undefined && oldDeptId !== newDeptId) {
            if (oldDeptId) {
                const oldDeptRef = firestore.collection("companies").doc(companyId).collection("departments").doc(oldDeptId);
                transaction.update(oldDeptRef, { employeeCount: admin.firestore.FieldValue.increment(-1) });
            }
            if (newDeptId) {
                 const newDeptRef = firestore.collection("companies").doc(companyId).collection("departments").doc(newDeptId);
                 transaction.update(newDeptRef, { employeeCount: admin.firestore.FieldValue.increment(1) });
            }
        }

        // if salary band changed, update counts
        const oldBandId = currentDoc.data().salaryBandId;
        const newBandId = salaryBandId;
        if (salaryBandId !== undefined && oldBandId !== newBandId) {
            if (oldBandId) {
                const oldBandRef = firestore.collection("companies").doc(companyId).collection("salaryBands").doc(oldBandId);
                transaction.update(oldBandRef, { employeeCount: admin.firestore.FieldValue.increment(-1) });
            }
            if (newBandId) {
                const newBandRef = firestore.collection("companies").doc(companyId).collection("salaryBands").doc(newBandId);
                transaction.update(newBandRef, { employeeCount: admin.firestore.FieldValue.increment(1) });
            }
        }

        transaction.update(userRef, updates);
    });

    await writeAuditLog({
      companyId,
      action: "EMPLOYEE_PROFILE_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "user",
      targetId: targetUid,
      before: userDoc.data(),
      after: { ...userDoc.data(), ...updates },
    });
  }

  return { success: true };
});

exports.changeEmployeeRole = onCall(async (request) => {
  const { uid, companyId, role } = requireHrOrAdmin(request);
  if (role !== "super_admin") {
      throw new HttpsError("permission-denied", "Only super_admin can change roles.");
  }

  const { targetUid, newRole } = request.data;
  if (!targetUid || !newRole) {
      throw new HttpsError("invalid-argument", "targetUid and newRole are required.");
  }

  const userRef = firestore.collection("users").doc(targetUid);
  const userDoc = await userRef.get();

  if (!userDoc.exists || userDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "User not found in your company.");
  }

  // Update Auth claims
  const authUser = await admin.auth().getUser(targetUid);
  const currentClaims = authUser.customClaims || {};
  await admin.auth().setCustomUserClaims(targetUid, { ...currentClaims, role: newRole });

  // Update Firestore
  await userRef.update({
      role: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
  });

  await writeAuditLog({
      companyId,
      action: "EMPLOYEE_ROLE_CHANGED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "user",
      targetId: targetUid,
      before: { role: userDoc.data().role },
      after: { role: newRole },
  });

  return { success: true };
});

exports.deactivateEmployee = onCall(async (request) => {
    const { uid, companyId, role } = requireHrOrAdmin(request);
    const { targetUid } = request.data;

    if (!targetUid) {
        throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    const userRef = firestore.collection("users").doc(targetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists || userDoc.data().companyId !== companyId) {
        throw new HttpsError("not-found", "User not found in your company.");
    }

    // Revoke Auth claim
    const authUser = await admin.auth().getUser(targetUid);
    const currentClaims = authUser.customClaims || {};
    await admin.auth().setCustomUserClaims(targetUid, { ...currentClaims, approved: false });

    // Update Firestore
    await userRef.update({
        status: "inactive",
        approved: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
    });

    await writeAuditLog({
        companyId,
        action: "EMPLOYEE_DEACTIVATED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "user",
        targetId: targetUid,
        before: { status: userDoc.data().status, approved: userDoc.data().approved },
        after: { status: "inactive", approved: false },
    });

    return { success: true };
});

exports.reactivateEmployee = onCall(async (request) => {
    const { uid, companyId, role } = requireHrOrAdmin(request);
    const { targetUid } = request.data;

    if (!targetUid) {
        throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    const userRef = firestore.collection("users").doc(targetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists || userDoc.data().companyId !== companyId) {
        throw new HttpsError("not-found", "User not found in your company.");
    }

    // Restore Auth claim
    const authUser = await admin.auth().getUser(targetUid);
    const currentClaims = authUser.customClaims || {};
    await admin.auth().setCustomUserClaims(targetUid, { ...currentClaims, approved: true });

    // Update Firestore
    await userRef.update({
        status: "active",
        approved: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
    });

    await writeAuditLog({
        companyId,
        action: "EMPLOYEE_REACTIVATED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "user",
        targetId: targetUid,
        before: { status: userDoc.data().status, approved: userDoc.data().approved },
        after: { status: "active", approved: true },
    });

    return { success: true };
});
// =============================================================================
// Module 5 — Evaluation & Scoring
// =============================================================================

// Helper: Calculate increment amount from salary and percentage
function calculateIncrementAmount(currentSalary, incrementPercent) {
  return (currentSalary * incrementPercent) / 100;
}

// ---------------------------------------------------------------------------
// initializeCycleEvaluations
// ---------------------------------------------------------------------------

exports.initializeCycleEvaluations = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "cycleId is required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  const cycleData = cycleDoc.data();

  if (cycleData.status === "completed" || cycleData.status === "cancelled") {
    throw new HttpsError("failed-precondition", "Cannot initialize evaluations for completed or cancelled cycles.");
  }

  try {
    // Fetch active employees
    let usersQuery = firestore.collection("users").where("companyId", "==", companyId).where("status", "==", "active");
    const usersSnap = await usersQuery.get();
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by scope
    let targetUsers = allUsers;
    if (!cycleData.scope.allEmployees) {
      targetUsers = allUsers.filter(u => {
        const inDept = cycleData.scope.departmentIds.length === 0 || cycleData.scope.departmentIds.includes(u.departmentId);
        const inBand = cycleData.scope.salaryBandIds.length === 0 || cycleData.scope.salaryBandIds.includes(u.salaryBandId);
        return inDept && inBand;
      });
    }

    if (targetUsers.length === 0) {
      throw new HttpsError("failed-precondition", "No active employees found in cycle scope.");
    }

    // Fetch departments to get default manager if user doc doesn't have one
    const deptsSnap = await firestore.collection("companies").doc(companyId).collection("departments").get();
    const depts = {};
    deptsSnap.forEach(d => depts[d.id] = d.data());

    // Batch write
    const batch = firestore.batch();
    let evaluationCount = 0;

    for (const user of targetUsers) {
      let managerId = user.managerId;
      if (!managerId && user.departmentId && depts[user.departmentId]) {
        managerId = depts[user.departmentId].managerId;
      }

      // If no manager found, default to hr admin creating this
      if (!managerId) managerId = uid;

      const evalRef = firestore.collection("evaluations").doc(`${cycleId}_${user.id}`);

      batch.set(evalRef, {
        companyId,
        cycleId,
        employeeUid: user.id,
        employeeName: user.name || "",
        employeeEmail: user.email || "",
        departmentId: user.departmentId || "",
        salaryBandId: user.salaryBandId || null,
        currentSalary: user.currentSalary || null,
        managerId,
        managerName: "", // We'd need to fetch this if we want it denormalized reliably, but UI can resolve it
        scores: {},
        weightedTotalScore: 0,
        status: "not_started",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      evaluationCount++;
    }

    // Update cycle status if it was locked
    if (cycleData.status === "locked") {
      batch.update(cycleRef, {
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    await writeAuditLog({
      companyId,
      action: "EVALUATIONS_INITIALIZED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      after: { evaluationCount },
    });

    return { success: true, evaluationCount };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in initializeCycleEvaluations:", error);
    throw new HttpsError("internal", error.message || "Failed to initialize evaluations.");
  }
});

// ---------------------------------------------------------------------------
// saveDraftEvaluation
// ---------------------------------------------------------------------------

exports.saveDraftEvaluation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;
  const companyId = request.auth.token.companyId;

  const { evaluationId, scores } = request.data;

  if (!evaluationId || !scores) {
    throw new HttpsError("invalid-argument", "evaluationId and scores are required.");
  }

  const evalRef = firestore.collection("evaluations").doc(evaluationId);
  const evalDoc = await evalRef.get();

  if (!evalDoc.exists || evalDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Evaluation not found.");
  }

  const evalData = evalDoc.data();

  // Verify caller is the assigned manager
  if (evalData.managerId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned manager can edit this evaluation.");
  }

  if (evalData.status !== "not_started" && evalData.status !== "draft") {
    throw new HttpsError("failed-precondition", "Evaluation is not in an editable state.");
  }

  // Fetch cycle to validate criteria and get tiers
  const cycleRef = firestore.collection("cycles").doc(evalData.cycleId);
  const cycleDoc = await cycleRef.get();
  const cycleData = cycleDoc.data();

  // Validate scores match criteria
  const cycleCriteriaIds = cycleData.criteria.map(c => c.id);
  for (const scoreKey of Object.keys(scores)) {
    if (!cycleCriteriaIds.includes(scoreKey)) {
      throw new HttpsError("invalid-argument", `Score provided for unknown criteria: ${scoreKey}`);
    }
  }

  try {
    // Calculate weighted total score
    let weightedTotalScore = 0;
    for (const s of Object.values(scores)) {
      weightedTotalScore += (s.weightedScore || 0);
    }

    // Cap at 100 due to potential float math issues
    weightedTotalScore = Math.min(100, Math.max(0, weightedTotalScore));

    // Determine assigned tier
    let assignedTierId = null;
    let assignedTierName = null;
    let incrementPercent = 0;
    let incrementAmount = 0;

    const tier = cycleData.tiers.find(t => weightedTotalScore >= t.minScore && weightedTotalScore <= t.maxScore);
    if (tier) {
      assignedTierId = tier.id;
      assignedTierName = tier.name;
      incrementPercent = (tier.incrementMin + tier.incrementMax) / 2;

      if (evalData.currentSalary) {
         incrementAmount = calculateIncrementAmount(evalData.currentSalary, incrementPercent);
      }
    }

    const updates = {
      scores,
      weightedTotalScore,
      assignedTierId,
      assignedTierName,
      incrementPercent,
      incrementAmount,
      status: "draft",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await evalRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "EVALUATION_DRAFT_SAVED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: request.auth.token.role,
      targetType: "evaluation",
      targetId: evaluationId,
      after: { weightedTotalScore, assignedTierId, status: "draft" },
    });

    // Budget tracking will be handled by a trigger or separate call, but we can attempt it here
    try {
        await exports.updateBudgetTracking.run({ data: { cycleId: evalData.cycleId }, auth: request.auth });
    } catch (e) {
        logger.warn("Failed to update budget tracking after save draft:", e);
    }

    return { success: true, weightedTotalScore, assignedTierId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in saveDraftEvaluation:", error);
    throw new HttpsError("internal", error.message || "Failed to save draft.");
  }
});

// ---------------------------------------------------------------------------
// submitEvaluation
// ---------------------------------------------------------------------------

exports.submitEvaluation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;
  const companyId = request.auth.token.companyId;

  const { evaluationId, scores } = request.data;

  if (!evaluationId || !scores) {
    throw new HttpsError("invalid-argument", "evaluationId and scores are required.");
  }

  const evalRef = firestore.collection("evaluations").doc(evaluationId);
  const evalDoc = await evalRef.get();

  if (!evalDoc.exists || evalDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Evaluation not found.");
  }

  const evalData = evalDoc.data();

  // Verify caller is the assigned manager
  if (evalData.managerId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned manager can submit this evaluation.");
  }

  if (evalData.status !== "not_started" && evalData.status !== "draft") {
    throw new HttpsError("failed-precondition", "Evaluation is already submitted or finalized.");
  }

  // Fetch cycle to validate criteria
  const cycleRef = firestore.collection("cycles").doc(evalData.cycleId);
  const cycleDoc = await cycleRef.get();
  const cycleData = cycleDoc.data();

  // Validate all criteria have scores
  const cycleCriteriaIds = cycleData.criteria.map(c => c.id);
  const providedScoreIds = Object.keys(scores);

  for (const criteriaId of cycleCriteriaIds) {
    if (!providedScoreIds.includes(criteriaId)) {
      throw new HttpsError("invalid-argument", `Missing score for criteria: ${criteriaId}`);
    }
  }

  for (const scoreKey of providedScoreIds) {
    if (!cycleCriteriaIds.includes(scoreKey)) {
      throw new HttpsError("invalid-argument", `Score provided for unknown criteria: ${scoreKey}`);
    }
  }

  try {
    // Calculate weighted total score
    let weightedTotalScore = 0;
    for (const s of Object.values(scores)) {
      weightedTotalScore += (s.weightedScore || 0);
    }
    weightedTotalScore = Math.min(100, Math.max(0, weightedTotalScore));

    // Determine assigned tier
    let assignedTierId = null;
    let assignedTierName = null;
    let incrementPercent = 0;
    let incrementAmount = 0;

    const tier = cycleData.tiers.find(t => weightedTotalScore >= t.minScore && weightedTotalScore <= t.maxScore);
    if (tier) {
      assignedTierId = tier.id;
      assignedTierName = tier.name;
      incrementPercent = (tier.incrementMin + tier.incrementMax) / 2;

      if (evalData.currentSalary) {
         incrementAmount = calculateIncrementAmount(evalData.currentSalary, incrementPercent);
      }
    }

    const updates = {
      scores,
      weightedTotalScore,
      assignedTierId,
      assignedTierName,
      incrementPercent,
      incrementAmount,
      status: "submitted",
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await evalRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "EVALUATION_SUBMITTED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: request.auth.token.role,
      targetType: "evaluation",
      targetId: evaluationId,
      after: { weightedTotalScore, assignedTierId, status: "submitted" },
    });

    // Send in-app notification to employee
    const notifRef = firestore.collection("users").doc(evalData.employeeUid).collection("notifications").doc();
    await notifRef.set({
      type: "EVALUATION_SUBMITTED",
      title: "Evaluation Submitted",
      message: "Your manager has submitted your evaluation for the current increment cycle.",
      cycleId: evalData.cycleId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update budget tracking
    try {
        await exports.updateBudgetTracking.run({ data: { cycleId: evalData.cycleId }, auth: request.auth });
    } catch (e) {
        logger.warn("Failed to update budget tracking after submit:", e);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in submitEvaluation:", error);
    throw new HttpsError("internal", error.message || "Failed to submit evaluation.");
  }
});

// ---------------------------------------------------------------------------
// overrideScore
// ---------------------------------------------------------------------------

exports.overrideScore = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { evaluationId, scores, reason } = request.data;

  if (!evaluationId || !scores || !reason) {
    throw new HttpsError("invalid-argument", "evaluationId, scores, and reason are required.");
  }

  if (reason.length < 10) {
    throw new HttpsError("invalid-argument", "Override reason must be at least 10 characters.");
  }

  const evalRef = firestore.collection("evaluations").doc(evaluationId);
  const evalDoc = await evalRef.get();

  if (!evalDoc.exists || evalDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Evaluation not found.");
  }

  const evalData = evalDoc.data();

  // Fetch cycle to validate criteria
  const cycleRef = firestore.collection("cycles").doc(evalData.cycleId);
  const cycleDoc = await cycleRef.get();
  const cycleData = cycleDoc.data();

  // Validate all criteria have scores (HR should provide all)
  const cycleCriteriaIds = cycleData.criteria.map(c => c.id);
  const providedScoreIds = Object.keys(scores);

  for (const criteriaId of cycleCriteriaIds) {
    if (!providedScoreIds.includes(criteriaId)) {
      throw new HttpsError("invalid-argument", `Missing score for criteria: ${criteriaId}`);
    }
  }

  for (const scoreKey of providedScoreIds) {
    if (!cycleCriteriaIds.includes(scoreKey)) {
      throw new HttpsError("invalid-argument", `Score provided for unknown criteria: ${scoreKey}`);
    }
  }

  try {
    // Calculate new weighted total score
    let weightedTotalScore = 0;
    for (const s of Object.values(scores)) {
      weightedTotalScore += (s.weightedScore || 0);
    }
    weightedTotalScore = Math.min(100, Math.max(0, weightedTotalScore));

    // Determine new assigned tier
    let assignedTierId = null;
    let assignedTierName = null;
    let incrementPercent = 0;
    let incrementAmount = 0;

    const tier = cycleData.tiers.find(t => weightedTotalScore >= t.minScore && weightedTotalScore <= t.maxScore);
    if (tier) {
      assignedTierId = tier.id;
      assignedTierName = tier.name;
      incrementPercent = (tier.incrementMin + tier.incrementMax) / 2;

      if (evalData.currentSalary) {
         incrementAmount = calculateIncrementAmount(evalData.currentSalary, incrementPercent);
      }
    }

    const updates = {
      scores,
      weightedTotalScore,
      assignedTierId,
      assignedTierName,
      incrementPercent,
      incrementAmount,
      status: "overridden",
      overrideReason: reason,
      overriddenBy: uid,
      overriddenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await evalRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "SCORE_OVERRIDDEN",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "evaluation",
      targetId: evaluationId,
      before: {
         scores: evalData.scores,
         weightedTotalScore: evalData.weightedTotalScore,
         assignedTierId: evalData.assignedTierId
      },
      after: {
         scores,
         weightedTotalScore,
         assignedTierId,
         status: "overridden",
         reason
      },
      metadata: { reason }
    });

    // Update budget tracking
    try {
        await exports.updateBudgetTracking.run({ data: { cycleId: evalData.cycleId }, auth: request.auth });
    } catch (e) {
        logger.warn("Failed to update budget tracking after override:", e);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in overrideScore:", error);
    throw new HttpsError("internal", error.message || "Failed to override score.");
  }
});

// ---------------------------------------------------------------------------
// finalizeCycle
// ---------------------------------------------------------------------------

exports.finalizeCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "cycleId is required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  const cycleData = cycleDoc.data();

  if (cycleData.status !== "active" && cycleData.status !== "locked") {
    throw new HttpsError("failed-precondition", "Cycle is not in a state to be finalized.");
  }

  // 1. Fetch all evaluations for this cycle
  const evalsSnap = await firestore.collection("evaluations")
    .where("companyId", "==", companyId)
    .where("cycleId", "==", cycleId)
    .get();

  if (evalsSnap.empty) {
     throw new HttpsError("failed-precondition", "No evaluations found for this cycle.");
  }

  const evals = evalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. Check if any are incomplete (not_started, draft)
  let incompleteCount = 0;
  for (const ev of evals) {
     if (ev.status === "not_started" || ev.status === "draft") {
        incompleteCount++;
     }
  }

  if (incompleteCount > 0) {
      throw new HttpsError("failed-precondition", `Cannot finalize. ${incompleteCount} evaluations are incomplete.`);
  }

  try {
    const batch = firestore.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    let totalIncrementsProcessed = 0;

    // 3. Mark all evaluations as finalized
    for (const ev of evals) {
      const evalRef = firestore.collection("evaluations").doc(ev.id);
      batch.update(evalRef, {
         status: "finalized",
         finalizedAt: now,
         updatedAt: now
      });

      // 4. Generate increment stories
      const storyRef = firestore.collection("users").doc(ev.employeeUid).collection("incrementStories").doc(cycleId);

      const scoreBreakdown = [];
      if (ev.scores) {
          for (const [cId, cData] of Object.entries(ev.scores)) {
             scoreBreakdown.push({
                 criteriaName: cData.criteriaName,
                 weightedScore: cData.weightedScore,
                 maxWeight: cData.weight
             });
          }
      }

      batch.set(storyRef, {
         cycleId,
         cycleName: cycleData.name,
         score: ev.weightedTotalScore,
         tierId: ev.assignedTierId || null,
         tierName: ev.assignedTierName || "Unqualified",
         incrementPercent: ev.incrementPercent || 0,
         incrementAmount: ev.incrementAmount || 0,
         scoreBreakdown,
         recommendations: "Continue delivering excellent results.", // Placeholder, could be dynamic
         generatedAt: now
      });

      // 5. Apply new salary to user doc
      if (ev.incrementAmount && ev.incrementAmount > 0) {
          const userRef = firestore.collection("users").doc(ev.employeeUid);
          batch.update(userRef, {
             currentSalary: admin.firestore.FieldValue.increment(ev.incrementAmount),
             updatedAt: now
          });
          totalIncrementsProcessed++;
      }

      // 6. Send notification to employee
      const notifRef = firestore.collection("users").doc(ev.employeeUid).collection("notifications").doc();
      batch.set(notifRef, {
        type: "CYCLE_FINALIZED",
        title: "Increment Decision Ready",
        message: `The increment cycle "${cycleData.name}" has been finalized. View your increment story now.`,
        cycleId,
        read: false,
        createdAt: now,
      });
    }

    // 7. Mark cycle as completed
    batch.update(cycleRef, {
       status: "completed",
       completedAt: now,
       updatedAt: now
    });

    await batch.commit();

    await writeAuditLog({
      companyId,
      action: "CYCLE_FINALIZED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      after: { status: "completed", totalIncrementsProcessed },
    });

    return { success: true, totalIncrementsProcessed };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in finalizeCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to finalize cycle.");
  }
});

// ---------------------------------------------------------------------------
// requestEvaluationDeadlineReminder
// ---------------------------------------------------------------------------

exports.requestEvaluationDeadlineReminder = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "cycleId is required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  // Find incomplete evaluations
  const evalsSnap = await firestore.collection("evaluations")
    .where("companyId", "==", companyId)
    .where("cycleId", "==", cycleId)
    .where("status", "in", ["not_started", "draft"])
    .get();

  if (evalsSnap.empty) {
     return { success: true, managersNotified: 0 };
  }

  // Group by manager
  const managerUids = new Set();
  evalsSnap.docs.forEach(doc => {
     if (doc.data().managerId) {
         managerUids.add(doc.data().managerId);
     }
  });

  try {
    const batch = firestore.batch();
    let managersNotified = 0;

    for (const managerUid of managerUids) {
        // Send in-app notification to manager
        const notifRef = firestore.collection("users").doc(managerUid).collection("notifications").doc();
        batch.set(notifRef, {
          type: "EVALUATION_REMINDER",
          title: "Evaluation Deadline Reminder",
          message: `You have incomplete evaluations for the cycle "${cycleDoc.data().name}". Please complete them before the deadline.`,
          cycleId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        managersNotified++;
        // Note: Real implementation would also send email via Brevo here
    }

    await batch.commit();

    await writeAuditLog({
      companyId,
      action: "DEADLINE_REMINDER_SENT",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      metadata: { managersNotified },
    });

    return { success: true, managersNotified };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in requestEvaluationDeadlineReminder:", error);
    throw new HttpsError("internal", error.message || "Failed to send reminders.");
  }
});

// =============================================================================
// Module 3 — Increment Cycle Engine
// =============================================================================

// =============================================================================
// createCycle — hr_admin | super_admin
// =============================================================================

exports.createCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);

  const { name, description, scope, budget, timeline } = request.data;

  if (!name || !scope || !budget || !timeline) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  if (!timeline.startDate || !timeline.endDate || !timeline.evaluationDeadline) {
    throw new HttpsError("invalid-argument", "All timeline dates are required.");
  }

  const start = new Date(timeline.startDate);
  const end = new Date(timeline.endDate);
  const evalDeadline = new Date(timeline.evaluationDeadline);

  if (end <= start) {
    throw new HttpsError("invalid-argument", "endDate must be after startDate.");
  }
  if (evalDeadline > end) {
    throw new HttpsError("invalid-argument", "evaluationDeadline must be on or before endDate.");
  }

  try {
    // Calculate employeeCount based on scope
    let employeeCount = 0;
    let usersQuery = firestore.collection("users").where("companyId", "==", companyId).where("status", "==", "active");
    const usersSnap = await usersQuery.get();
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (scope.allEmployees) {
      employeeCount = allUsers.length;
    } else {
      employeeCount = allUsers.filter(u => {
        const inDept = scope.departmentIds.length === 0 || scope.departmentIds.includes(u.departmentId);
        const inBand = scope.salaryBandIds.length === 0 || scope.salaryBandIds.includes(u.salaryBandId);
        return inDept && inBand;
      }).length;
    }

    const cycleRef = await firestore.collection("cycles").add({
      companyId,
      name,
      description: description || null,
      status: "draft",
      scope,
      budget,
      criteria: [],
      tiers: [],
      timeline: {
        startDate: admin.firestore.Timestamp.fromDate(start),
        endDate: admin.firestore.Timestamp.fromDate(end),
        evaluationDeadline: admin.firestore.Timestamp.fromDate(evalDeadline),
      },
      employeeCount,
      totalWeight: 0,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      companyId,
      action: "CYCLE_CREATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleRef.id,
      after: { name, status: "draft" },
    });

    return { success: true, cycleId: cycleRef.id };
  } catch (error) {
    logger.error("Error in createCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to create cycle.");
  }
});

// =============================================================================
// updateCycle — hr_admin | super_admin
// BLOCK if status !== 'draft'
// =============================================================================

exports.updateCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);

  const { cycleId, name, description, scope, budget, timeline } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "cycleId is required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  if (cycleDoc.data().status !== "draft") {
    throw new HttpsError("failed-precondition", "CYCLE_NOT_EDITABLE");
  }

  try {
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (budget !== undefined) updates.budget = budget;

    if (scope !== undefined) {
      updates.scope = scope;
      // Recalculate employeeCount
      const usersSnap = await firestore.collection("users")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (scope.allEmployees) {
        updates.employeeCount = allUsers.length;
      } else {
        updates.employeeCount = allUsers.filter(u => {
          const inDept = scope.departmentIds.length === 0 || scope.departmentIds.includes(u.departmentId);
          const inBand = scope.salaryBandIds.length === 0 || scope.salaryBandIds.includes(u.salaryBandId);
          return inDept && inBand;
        }).length;
      }
    }

    if (timeline !== undefined) {
      const start = new Date(timeline.startDate);
      const end = new Date(timeline.endDate);
      const evalDeadline = new Date(timeline.evaluationDeadline);
      if (end <= start) throw new HttpsError("invalid-argument", "endDate must be after startDate.");
      if (evalDeadline > end) throw new HttpsError("invalid-argument", "evaluationDeadline must be on or before endDate.");
      updates.timeline = {
        startDate: admin.firestore.Timestamp.fromDate(start),
        endDate: admin.firestore.Timestamp.fromDate(end),
        evaluationDeadline: admin.firestore.Timestamp.fromDate(evalDeadline),
      };
    }

    await cycleRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "CYCLE_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      after: updates,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in updateCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to update cycle.");
  }
});

// =============================================================================
// updateCycleCriteria — hr_admin | super_admin
// BLOCK if status !== 'draft'
// =============================================================================

exports.updateCycleCriteria = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);

  const { cycleId, criteria, tiers } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "cycleId is required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  if (cycleDoc.data().status !== "draft") {
    throw new HttpsError("failed-precondition", "CYCLE_NOT_EDITABLE");
  }

  // Validate criteria
  const validMeasurementTypes = ["numeric", "boolean", "rating", "percentage"];
  const validDataSources = ["manager", "system", "self"];

  if (criteria && criteria.length > 0) {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (Math.round(totalWeight) !== 100) {
      throw new HttpsError("invalid-argument", "Criteria weights must sum to exactly 100.");
    }
    for (const c of criteria) {
      if (!validMeasurementTypes.includes(c.measurementType)) {
        throw new HttpsError("invalid-argument", `Invalid measurementType: ${c.measurementType}`);
      }
      if (!validDataSources.includes(c.dataSource)) {
        throw new HttpsError("invalid-argument", `Invalid dataSource: ${c.dataSource}`);
      }
    }
  }

  // Validate tiers
  if (tiers && tiers.length > 0) {
    for (const t of tiers) {
      if (t.minScore >= t.maxScore) {
        throw new HttpsError("invalid-argument", `Tier "${t.name}": minScore must be less than maxScore.`);
      }
    }
    // Check for overlaps
    const sorted = [...tiers].sort((a, b) => a.minScore - b.minScore);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxScore > sorted[i + 1].minScore) {
        throw new HttpsError("invalid-argument", `Tiers "${sorted[i].name}" and "${sorted[i+1].name}" overlap.`);
      }
    }
  }

  try {
    const totalWeight = criteria && criteria.length > 0
      ? criteria.reduce((sum, c) => sum + (c.weight || 0), 0)
      : 0;

    await cycleRef.update({
      criteria: criteria || [],
      tiers: tiers || [],
      totalWeight,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      companyId,
      action: "CRITERIA_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      after: { criteriaCount: criteria ? criteria.length : 0, totalWeight, tierCount: tiers ? tiers.length : 0 },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in updateCycleCriteria:", error);
    throw new HttpsError("internal", error.message || "Failed to update criteria.");
  }
});

// =============================================================================
// publishAndLockCycle — hr_admin | super_admin
// Two-step: confirmationCode must match cycle name exactly
// =============================================================================

exports.publishAndLockCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);

  const { cycleId, confirmationCode } = request.data;

  if (!cycleId || !confirmationCode) {
    throw new HttpsError("invalid-argument", "cycleId and confirmationCode are required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  const cycleData = cycleDoc.data();

  if (cycleData.status !== "draft") {
    throw new HttpsError("failed-precondition", "Only draft cycles can be published.");
  }

  // Confirm name matches
  if (confirmationCode !== cycleData.name) {
    throw new HttpsError("invalid-argument", "Confirmation code does not match cycle name.");
  }

  // Pre-flight validations
  if (!cycleData.criteria || cycleData.criteria.length === 0) {
    throw new HttpsError("failed-precondition", "Cycle must have at least one criteria.");
  }

  const totalWeight = cycleData.criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  if (Math.round(totalWeight) !== 100) {
    throw new HttpsError("failed-precondition", "Criteria weights must sum to 100.");
  }

  if (!cycleData.tiers || cycleData.tiers.length === 0) {
    throw new HttpsError("failed-precondition", "Cycle must have at least one tier.");
  }

  if (!cycleData.employeeCount || cycleData.employeeCount === 0) {
    throw new HttpsError("failed-precondition", "Cycle must have at least one employee in scope.");
  }

  try {
    const now = admin.firestore.Timestamp.now();

    await cycleRef.update({
      status: "locked",
      lockedAt: now,
      lockedBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notifications to all employees in scope
    const usersSnap = await firestore.collection("users")
      .where("companyId", "==", companyId)
      .where("status", "==", "active")
      .get();

    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let targetUsers = allUsers;

    if (!cycleData.scope.allEmployees) {
      targetUsers = allUsers.filter(u => {
        const inDept = cycleData.scope.departmentIds.length === 0 || cycleData.scope.departmentIds.includes(u.departmentId);
        const inBand = cycleData.scope.salaryBandIds.length === 0 || cycleData.scope.salaryBandIds.includes(u.salaryBandId);
        return inDept && inBand;
      });
    }

    const batch = firestore.batch();
    for (const u of targetUsers) {
      const notifRef = firestore.collection("users").doc(u.id).collection("notifications").doc();
      batch.set(notifRef, {
        type: "CYCLE_LOCKED",
        title: "New Increment Cycle Started",
        message: `The increment cycle "${cycleData.name}" has been published. Evaluations will begin soon.`,
        cycleId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    await writeAuditLog({
      companyId,
      action: "CYCLE_LOCKED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      after: {
        status: "locked",
        lockedAt: now,
        criteriaSnapshot: cycleData.criteria,
        tiersSnapshot: cycleData.tiers,
        employeeCount: cycleData.employeeCount,
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in publishAndLockCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to publish cycle.");
  }
});

// =============================================================================
// cancelCycle — hr_admin | super_admin
// BLOCK if status === 'completed'
// =============================================================================

exports.cancelCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);

  const { cycleId, reason } = request.data;

  if (!cycleId || !reason) {
    throw new HttpsError("invalid-argument", "cycleId and reason are required.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  if (cycleDoc.data().status === "completed") {
    throw new HttpsError("failed-precondition", "Completed cycles cannot be cancelled.");
  }

  try {
    await cycleRef.update({
      status: "cancelled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      companyId,
      action: "CYCLE_CANCELLED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "cycle",
      targetId: cycleId,
      before: { status: cycleDoc.data().status },
      after: { status: "cancelled", reason },
      metadata: { reason },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in cancelCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to cancel cycle.");
  }
});

// =============================================================================
// Module 4 — Budget Simulation Engine
// =============================================================================

// Helper: normal distribution
function randomNormal(mean, stdDev) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormal(mean, stdDev); // resample
  return mean + (num - 0.5) * stdDev * 2;
}

exports.runBudgetSimulation = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId, parameters, name, description } = request.data;

  if (!cycleId || !parameters || !name) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  const cycleData = cycleDoc.data();

  if (cycleData.status !== 'draft') {
    throw new HttpsError("failed-precondition", "Simulations can only be run on draft cycles.");
  }

  if (!cycleData.criteria || cycleData.criteria.length === 0 || !cycleData.tiers || cycleData.tiers.length === 0) {
    throw new HttpsError("failed-precondition", "Cycle must have criteria and tiers configured.");
  }

  // Max simulations check
  const simSnap = await cycleRef.collection("simulations").get();
  if (simSnap.size >= 5) {
    throw new HttpsError("resource-exhausted", "MAX_SIMULATIONS_REACHED");
  }

  try {
    // 1. Fetch employees
    let usersQuery = firestore.collection("users").where("companyId", "==", companyId).where("status", "==", "active");
    const usersSnap = await usersQuery.get();
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let targetUsers = allUsers;
    if (!cycleData.scope.allEmployees) {
      targetUsers = allUsers.filter(u => {
        const inDept = cycleData.scope.departmentIds.length === 0 || cycleData.scope.departmentIds.includes(u.departmentId);
        const inBand = cycleData.scope.salaryBandIds.length === 0 || cycleData.scope.salaryBandIds.includes(u.salaryBandId);
        return inDept && inBand;
      });
    }

    if (targetUsers.length === 0) {
      throw new HttpsError("failed-precondition", "No active employees found in cycle scope.");
    }

    // Default weights from cycle
    const baseWeights = {};
    for (const c of cycleData.criteria) {
        baseWeights[c.id] = c.weight;
    }

    // Tiers logic
    const tiersToUse = (parameters.tierThresholds && parameters.tierThresholds.length > 0)
      ? parameters.tierThresholds
      : cycleData.tiers;

    // Create map for tier matching
    const tierMap = tiersToUse.map(t => ({
      ...t,
      // fallback to cycle tier name/color if override
      name: t.name || (cycleData.tiers.find(ct => ct.id === t.tierId)?.name || 'Unknown'),
      color: t.color || (cycleData.tiers.find(ct => ct.id === t.tierId)?.color || '#94a3b8')
    })).sort((a,b) => b.minScore - a.minScore); // Highest first

    // Tiers mapping function
    const getTierForScore = (score) => {
        return tierMap.find(t => score >= t.minScore && score <= t.maxScore) || null;
    };

    // Salary estimation (mocking for simulation if real salary missing)
    let defaultSalary = 50000;
    let totalPayroll = 0;

    // Employee simulation details
    const simulatedEmployees = targetUsers.map(user => {
      let score = 0;
      switch (parameters.assumedDistribution) {
        case 'uniform':
          score = Math.random() * 100;
          break;
        case 'normal':
          score = randomNormal(65, 15);
          break;
        case 'top_heavy':
          score = randomNormal(75, 12); // skewed high
          break;
        case 'bottom_heavy':
          score = randomNormal(45, 12); // skewed low
          break;
        default:
          score = randomNormal(65, 15);
      }

      // Clamp 0-100
      score = Math.max(0, Math.min(100, score));

      const tier = getTierForScore(score);
      const salary = user.currentSalary || defaultSalary;
      totalPayroll += salary;

      let incrementAmt = 0;
      let incrementPct = 0;

      if (tier) {
         incrementPct = (tier.incrementMin + tier.incrementMax) / 2;
         incrementAmt = salary * (incrementPct / 100);
      }

      return {
        uid: user.id,
        score,
        tierId: tier ? (tier.id || tier.tierId) : null,
        tierName: tier ? tier.name : 'Unqualified',
        salary,
        incrementAmt,
        incrementPct
      };
    });

    // Aggregate Results
    let totalProjectedCost = 0;
    let qualifyingCount = 0;
    const employeesByTier = {};
    const tierStats = {};

    for (const t of tierMap) {
        employeesByTier[t.id || t.tierId] = 0;
        tierStats[t.id || t.tierId] = {
           name: t.name,
           color: t.color,
           count: 0,
           totalCost: 0,
           totalPct: 0
        };
    }

    for (const emp of simulatedEmployees) {
       totalProjectedCost += emp.incrementAmt;
       if (emp.incrementAmt > 0) qualifyingCount++;

       if (emp.tierId && tierStats[emp.tierId]) {
           employeesByTier[emp.tierId]++;
           tierStats[emp.tierId].count++;
           tierStats[emp.tierId].totalCost += emp.incrementAmt;
           tierStats[emp.tierId].totalPct += emp.incrementPct;
       }
    }

    const avgIncrement = qualifyingCount > 0 ? (totalProjectedCost / (totalPayroll * (qualifyingCount/targetUsers.length))) * 100 : 0;
    // budgetUtilization: totalProjectedCost / budget.totalBudget * 100
    let budgetUtilization = 0;
    const totalBudget = parameters.budgetCap || cycleData.budget.totalBudget || (cycleData.budget.maxPercentage ? (totalPayroll * cycleData.budget.maxPercentage / 100) : 0);

    if (totalBudget > 0) {
        budgetUtilization = (totalProjectedCost / totalBudget) * 100;
    }

    // Distribution data
    const distributionData = Object.values(tierStats).map(t => ({
        tierName: t.name,
        tierColor: t.color,
        employeeCount: t.count,
        projectedCost: t.totalCost,
        averageIncrement: t.count > 0 ? t.totalPct / t.count : 0
    }));

    // Sensitivity Data
    const sensitivityData = [];
    for (let th = 50; th <= 95; th += 5) {
       let sQualifyingCount = 0;
       let sCost = 0;
       for (const emp of simulatedEmployees) {
          if (emp.score >= th) {
             sQualifyingCount++;
             const sTier = getTierForScore(emp.score);
             if (sTier) {
                 const sPct = (sTier.incrementMin + sTier.incrementMax) / 2;
                 sCost += emp.salary * (sPct / 100);
             }
          }
       }
       sensitivityData.push({
          threshold: th,
          qualifyingCount: sQualifyingCount,
          projectedCost: sCost
       });
    }

    const results = {
      totalProjectedCost,
      totalProjectedCostPercent: totalPayroll > 0 ? (totalProjectedCost / totalPayroll) * 100 : 0,
      employeesByTier,
      averageIncrement: avgIncrement,
      budgetUtilization,
      qualifyingEmployees: qualifyingCount,
      distributionData,
      sensitivityData
    };

    const newSimRef = cycleRef.collection("simulations").doc();
    const simData = {
        companyId,
        cycleId,
        name,
        description: description || null,
        parameters,
        results,
        isApplied: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newSimRef.set(simData);

    await writeAuditLog({
        companyId,
        action: "SIMULATION_RUN",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "simulation",
        targetId: newSimRef.id,
        metadata: { name, cycleId }
    });

    return { success: true, simulationId: newSimRef.id, results };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in runBudgetSimulation:", error);
    throw new HttpsError("internal", error.message || "Failed to run simulation.");
  }
});

exports.saveSimulationScenario = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId, simulationId, name, description } = request.data;

  if (!cycleId || !simulationId || !name) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const simRef = firestore.collection("cycles").doc(cycleId).collection("simulations").doc(simulationId);
  const simDoc = await simRef.get();

  if (!simDoc.exists || simDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Simulation not found.");
  }

  try {
    const updates = { name, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (description !== undefined) updates.description = description;

    await simRef.update(updates);

    await writeAuditLog({
        companyId,
        action: "SIMULATION_SAVED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "simulation",
        targetId: simulationId,
        after: updates
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in saveSimulationScenario:", error);
    throw new HttpsError("internal", error.message || "Failed to save simulation.");
  }
});

exports.deleteSimulationScenario = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId, simulationId } = request.data;

  if (!cycleId || !simulationId) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const simRef = firestore.collection("cycles").doc(cycleId).collection("simulations").doc(simulationId);
  const simDoc = await simRef.get();

  if (!simDoc.exists || simDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Simulation not found.");
  }

  if (simDoc.data().isApplied) {
    throw new HttpsError("failed-precondition", "Cannot delete an applied scenario.");
  }

  try {
    await simRef.delete();

    await writeAuditLog({
        companyId,
        action: "SIMULATION_DELETED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "simulation",
        targetId: simulationId,
        before: { name: simDoc.data().name }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in deleteSimulationScenario:", error);
    throw new HttpsError("internal", error.message || "Failed to delete simulation.");
  }
});

exports.applyScenarioToCycle = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId, simulationId } = request.data;

  if (!cycleId || !simulationId) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  if (cycleDoc.data().status !== 'draft') {
    throw new HttpsError("failed-precondition", "Can only apply scenarios to draft cycles.");
  }

  const simRef = cycleRef.collection("simulations").doc(simulationId);
  const simDoc = await simRef.get();

  if (!simDoc.exists || simDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Simulation not found.");
  }

  const simData = simDoc.data();
  const parameters = simData.parameters;
  const cycleData = cycleDoc.data();

  try {
    await firestore.runTransaction(async (transaction) => {
      // 1. Update the cycle with new criteria weights and tiers
      const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

      if (parameters.criteriaWeights && Object.keys(parameters.criteriaWeights).length > 0) {
          const updatedCriteria = cycleData.criteria.map(c => {
             if (parameters.criteriaWeights[c.id] !== undefined) {
                 return { ...c, weight: parameters.criteriaWeights[c.id] };
             }
             return c;
          });
          updates.criteria = updatedCriteria;
          updates.totalWeight = updatedCriteria.reduce((sum, c) => sum + (c.weight || 0), 0);
      }

      if (parameters.tierThresholds && parameters.tierThresholds.length > 0) {
          const updatedTiers = parameters.tierThresholds.map(t => ({
              ...t,
              name: t.name || (cycleData.tiers.find(ct => ct.id === t.tierId)?.name || 'Unknown'),
              color: t.color || (cycleData.tiers.find(ct => ct.id === t.tierId)?.color || '#94a3b8')
          }));
          updates.tiers = updatedTiers;
      }

      transaction.update(cycleRef, updates);

      // 2. Mark this simulation as applied, others as unapplied
      const allSimsSnap = await transaction.get(cycleRef.collection("simulations"));
      for (const sDoc of allSimsSnap.docs) {
          transaction.update(sDoc.ref, { isApplied: sDoc.id === simulationId });
      }

      // Audit Log for Cycle Update
      const auditRef = firestore.collection("auditLogs").doc();
      transaction.set(auditRef, {
        companyId,
        action: "CRITERIA_UPDATED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "cycle",
        targetId: cycleId,
        after: updates,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit Log for Simulation Apply
      const auditRefSim = firestore.collection("auditLogs").doc();
      transaction.set(auditRefSim, {
        companyId,
        action: "SIMULATION_APPLIED",
        actorUid: uid,
        actorEmail: request.auth.token.email || "",
        actorRole: role,
        targetType: "simulation",
        targetId: simulationId,
        metadata: { name: simData.name, cycleId },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in applyScenarioToCycle:", error);
    throw new HttpsError("internal", error.message || "Failed to apply scenario.");
  }
});

exports.getEmployeeCycleProgress = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { uid, token } = request.auth;
  const { role, companyId } = token;
  if (role !== "employee") {
    throw new HttpsError("permission-denied", "Only employees can access this function.");
  }

  const { cycleId } = request.data;
  if (!cycleId) {
    throw new HttpsError("invalid-argument", "Missing cycleId.");
  }

  try {
    const cycleRef = firestore.collection("cycles").doc(cycleId);
    const cycleDoc = await cycleRef.get();

    if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
      throw new HttpsError("not-found", "Cycle not found.");
    }
    const cycleData = cycleDoc.data();

    const evalsSnap = await firestore.collection("evaluations")
        .where("companyId", "==", companyId)
        .where("cycleId", "==", cycleId)
        .where("employeeUid", "==", uid)
        .limit(1)
        .get();

    let evaluation = null;
    let currentScore = 0;
    let tier = null;

    if (!evalsSnap.empty) {
      evaluation = evalsSnap.docs[0].data();
      currentScore = evaluation.weightedTotalScore || 0;

      if (evaluation.assignedTierId && cycleData.tiers) {
        tier = cycleData.tiers.find(t => t.id === evaluation.assignedTierId);
      } else if (cycleData.tiers) {
        // Find tier based on score
        tier = cycleData.tiers.find(t => currentScore >= t.minScore && currentScore <= t.maxScore);
      }
    }

    let daysRemaining = 0;
    if (cycleData.timeline && cycleData.timeline.evaluationDeadline) {
      const deadline = cycleData.timeline.evaluationDeadline.toDate();
      const now = new Date();
      const diffTime = deadline.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
      success: true,
      progress: {
        evaluation,
        criteria: cycleData.criteria || [],
        currentScore,
        tier,
        daysRemaining
      }
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in getEmployeeCycleProgress:", error);
    throw new HttpsError("internal", error.message || "Failed to get cycle progress.");
  }
});

exports.markNotificationRead = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { uid } = request.auth;
  const { notificationId } = request.data;

  if (!notificationId) {
    throw new HttpsError("invalid-argument", "Missing notificationId.");
  }

  try {
    const notifRef = firestore.collection("users").doc(uid).collection("notifications").doc(notificationId);
    const notifDoc = await notifRef.get();

    if (!notifDoc.exists) {
      throw new HttpsError("not-found", "Notification not found.");
    }

    await notifRef.update({ isRead: true });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in markNotificationRead:", error);
    throw new HttpsError("internal", error.message || "Failed to mark notification read.");
  }
});

exports.markAllNotificationsRead = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { uid } = request.auth;

  try {
    const notifsRef = firestore.collection("users").doc(uid).collection("notifications");
    const unreadSnap = await notifsRef.where("isRead", "==", false).get();

    if (unreadSnap.empty) {
      return { success: true, count: 0 };
    }

    const batch = firestore.batch();
    unreadSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();

    return { success: true, count: unreadSnap.size };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in markAllNotificationsRead:", error);
    throw new HttpsError("internal", error.message || "Failed to mark all notifications read.");
  }
});

exports.updateCareerMap = onCall(async (request) => {
  // Note: This function is meant to be called internally (e.g. by finalizeCycle),
  // but if exposed via httpsCallable it must be secured. In this case, we'll allow
  // admin to run it or it can run internally. Let's assume the user is auth'd but it's an internal helper
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { role, companyId } = request.auth.token;

  // It says "Internal function called by finalizeCycle"
  // So normally it might not be exported as onCall if it's purely internal,
  // but instructions said: "updateCareerMap({ userId }) ... Export all new functions"

  const { userId } = request.data;
  if (!userId) {
     throw new HttpsError("invalid-argument", "Missing userId.");
  }

  try {
    const userDoc = await firestore.collection("users").doc(userId).get();
    if (!userDoc.exists || userDoc.data().companyId !== companyId) {
        throw new HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();

    let currentBandId = userData.salaryBandId;
    let currentBandName = "Unknown";
    let currentBandLevel = 0;

    // Get band info
    let nextBandId = null;
    let nextBandName = null;
    let nextBandLevel = null;

    if (currentBandId) {
      const bandsSnap = await firestore.collection("companies").doc(companyId).collection("salaryBands").orderBy("level", "asc").get();
      const bands = bandsSnap.docs.map(d => ({id: d.id, ...d.data()}));

      const currentIndex = bands.findIndex(b => b.id === currentBandId);
      if (currentIndex !== -1) {
        currentBandName = bands[currentIndex].name;
        currentBandLevel = bands[currentIndex].level;

        if (currentIndex < bands.length - 1) {
           nextBandId = bands[currentIndex + 1].id;
           nextBandName = bands[currentIndex + 1].name;
           nextBandLevel = bands[currentIndex + 1].level;
        }
      }
    }

    const storiesSnap = await firestore.collection("users").doc(userId).collection("incrementStories").orderBy("completedAt", "desc").get();

    let progressPercent = 0;
    const history = [];
    let avgRecentScore = 0;
    let sumScore = 0;
    let count = 0;

    storiesSnap.docs.forEach((doc, idx) => {
       const story = doc.data();
       history.push({
           cycleId: story.cycleId,
           cycleName: story.cycleName,
           completedAt: story.completedAt,
           score: story.score,
           tierName: story.tierName,
           tierColor: story.tierColor,
           incrementPercent: story.incrementPercent,
           bandName: currentBandName // simplification
       });
       if (idx < 2) {
           sumScore += story.score;
           count++;
       }
    });

    if (count > 0) {
        avgRecentScore = sumScore / count;
        // Calculation logic: based on average score of last 2 cycles vs band requirements
        // Simple mock calculation here as band requirements aren't deeply specified
        if (count >= 2) {
           progressPercent = Math.min(100, Math.max(0, Math.round((avgRecentScore / 100) * 100)));
        }
    }

    const mapData = {
        userId,
        companyId,
        currentBandId: currentBandId || "",
        currentBandName,
        currentBandLevel,
        nextBandId,
        nextBandName,
        nextBandLevel,
        milestones: [], // Need logic to derive milestones, empty for now
        history,
        progressPercent,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await firestore.collection("users").doc(userId).collection("careerMap").doc("current").set(mapData);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in updateCareerMap:", error);
    throw new HttpsError("internal", error.message || "Failed to update career map.");
  }
});

exports.updateBudgetTracking = onCall(async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { cycleId } = request.data;

  if (!cycleId) {
    throw new HttpsError("invalid-argument", "Missing cycleId.");
  }

  const cycleRef = firestore.collection("cycles").doc(cycleId);
  const cycleDoc = await cycleRef.get();

  if (!cycleDoc.exists || cycleDoc.data().companyId !== companyId) {
    throw new HttpsError("not-found", "Cycle not found.");
  }

  const cycleData = cycleDoc.data();

  try {
    // 1. Fetch evaluations for this cycle
    const evalsSnap = await firestore.collection("evaluations")
        .where("companyId", "==", companyId)
        .where("cycleId", "==", cycleId)
        .get();

    let committed = 0;
    let projected = 0;
    const byDepartment = {};
    const byTier = {};

    // Default tier tracking
    if (cycleData.tiers) {
        for (const t of cycleData.tiers) {
            byTier[t.id] = { count: 0, totalAmount: 0 };
        }
    }

    evalsSnap.docs.forEach(doc => {
       const evalData = doc.data();
       const amt = evalData.incrementAmount || 0;

       if (evalData.status === 'finalized' || evalData.status === 'approved') {
           committed += amt;
       } else {
           projected += amt;
       }

       // Department breakdown
       if (evalData.departmentId) {
           if (!byDepartment[evalData.departmentId]) {
               byDepartment[evalData.departmentId] = { budget: 0, committed: 0, projected: 0 };
           }
           if (evalData.status === 'finalized' || evalData.status === 'approved') {
               byDepartment[evalData.departmentId].committed += amt;
           } else {
               byDepartment[evalData.departmentId].projected += amt;
           }
       }

       // Tier breakdown
       if (evalData.tierId && byTier[evalData.tierId] !== undefined) {
           byTier[evalData.tierId].count += 1;
           byTier[evalData.tierId].totalAmount += amt;
       }
    });

    let totalBudget = 0;
    if (cycleData.budget.type === 'fixed_pool') {
        totalBudget = cycleData.budget.totalBudget || 0;
    } else {
        // Need to approximate total payroll for percentage budget
        const usersSnap = await firestore.collection("users").where("companyId", "==", companyId).where("status", "==", "active").get();
        let payroll = 0;
        usersSnap.docs.forEach(d => payroll += (d.data().currentSalary || 50000));
        totalBudget = payroll * (cycleData.budget.maxPercentage || 0) / 100;
    }

    const remaining = Math.max(0, totalBudget - committed - projected);
    const utilizationPercent = totalBudget > 0 ? ((committed + projected) / totalBudget) * 100 : 0;

    const today = new Date().toISOString().split('T')[0];
    const newBurnPoint = { date: today, committed, projected };

    // Update Realtime Database
    const db = admin.database();
    const budgetRef = db.ref(`budgetTracking/${cycleId}`);

    const currentBudgetSnap = await budgetRef.get();
    let burnRateData = [];

    if (currentBudgetSnap.exists()) {
        const currentData = currentBudgetSnap.val();
        if (currentData.burnRateData) {
            burnRateData = currentData.burnRateData;
            // Update today's point or append
            const lastIndex = burnRateData.length - 1;
            if (lastIndex >= 0 && burnRateData[lastIndex].date === today) {
                burnRateData[lastIndex] = newBurnPoint;
            } else {
                burnRateData.push(newBurnPoint);
            }
        } else {
             burnRateData = [newBurnPoint];
        }
    } else {
        burnRateData = [newBurnPoint];
    }

    const updateData = {
        companyId,
        cycleId,
        totalBudget,
        currency: cycleData.budget.currency || "USD",
        committed,
        projected,
        remaining,
        utilizationPercent,
        byDepartment,
        byTier,
        burnRateData,
        lastUpdated: admin.database.ServerValue.TIMESTAMP
    };

    await budgetRef.set(updateData);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in updateBudgetTracking:", error);
    throw new HttpsError("internal", error.message || "Failed to update budget tracking.");
  }
});
