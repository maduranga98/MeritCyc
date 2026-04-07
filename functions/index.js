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
