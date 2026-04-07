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
// Feature 1.3 — QR Self-Registration Cloud Functions
// =============================================================================

const crypto = require("crypto");
const brevo = require("@getbrevo/brevo");

// Brevo transactional email client (key from environment)
const brevoClient = brevo.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey =
  process.env.BREVO_API_KEY || "";
const transactionalEmailApi = new brevo.TransactionalEmailsApi();

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
  const email = new brevo.SendSmtpEmail();
  email.sender = { name: "MeritCyc", email: "noreply@meritcyc.com" };
  email.to = [{ email: toEmail, name: toName }];
  email.subject = "Your MeritCyc Verification Code";
  email.htmlContent = `
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
    </div>`;

  try {
    await transactionalEmailApi.sendTransacEmail(email);
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