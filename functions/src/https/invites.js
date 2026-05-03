const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { sendEmail } = require("../utils/mailer");

// We assume firebase-admin is initialized in index.js
const firestore = admin.firestore();

// =============================================================================
// Helper: write audit log entry
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
// Helper: check HR/Super Admin role
// =============================================================================

async function requireHrOrSuperAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const token = request.auth.token;
  if (token.role !== "super_admin" && token.role !== "hr_admin") {
    throw new HttpsError(
      "permission-denied",
      "Only HR or Super Admins can perform this action."
    );
  }

  if (!token.companyId) {
     throw new HttpsError(
      "failed-precondition",
      "No company ID found for the user."
    );
  }

  return token;
}

// =============================================================================
// sendEmployeeInvite
// =============================================================================

exports.sendEmployeeInvite = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { email, name, departmentId, salaryBandId, role } = request.data;

  if (!email || !name || !role) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  if (role !== "employee" && role !== "manager") {
    throw new HttpsError("invalid-argument", "Invalid role for invite.");
  }

  // Validate: email not already in users collection
  const userSnapshot = await firestore
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    throw new HttpsError("already-exists", "A user with this email already exists.");
  }

  // Generate invite token
  const inviteToken = crypto.randomUUID();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  const inviteData = {
    email,
    name,
    departmentId: departmentId || "",
    salaryBandId: salaryBandId || "",
    role,
    token: inviteToken,
    status: "pending",
    resendCount: 0,
    createdAt: Date.now(),
    expiresAt,
    createdBy: request.auth.uid,
    companyId,
  };

  try {
    // Write invite document
    const inviteRef = await firestore
      .collection("companies")
      .doc(companyId)
      .collection("invites")
      .add(inviteData);

    const inviteId = inviteRef.id;

    // Write flat token lookup — avoids collection-group query in preview/accept
    await firestore.collection("inviteTokens").doc(inviteToken).set({
      companyId,
      inviteId,
      expiresAt,
    });

    // Send email
    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

    await sendEmail({
      subject: `You've been invited to ${companyName}`,
      htmlContent: `
      <html>
        <body>
          <h1>Welcome to ${companyName}!</h1>
          <p>Hi ${name},</p>
          <p>You have been invited to join ${companyName} on MeritCyc as a ${role}.</p>
          <p>Please click the link below to accept your invitation:</p>
          <a href="${process.env.APP_URL || "https://meritcyc-7a683.web.app"}/accept-invite?token=${inviteToken}">Accept Invitation</a>
          <p>This link expires in 7 days.</p>
        </body>
      </html>
    `,
      sender: { name: companyName, email: "invites@meritcyc.com" },
      to: [{ email: email, name: name }],
    });

    // Audit log
    await writeAuditLog({
      companyId,
      action: "user_invited",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "user",
      targetId: inviteId,
      after: inviteData,
    });

    return { success: true, inviteId };
  } catch (error) {
    logger.error("Error in sendEmployeeInvite:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

// =============================================================================
// getInvitePreview
// =============================================================================

exports.getInvitePreview = onCall(async (request) => {
  const { token } = request.data;

  if (!token) {
    throw new HttpsError("invalid-argument", "Missing token.");
  }

  try {
    // Direct single-doc lookup — no index required
    const tokenDoc = await firestore.collection("inviteTokens").doc(token).get();
    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Invalid, expired, or already accepted invitation.");
    }

    const { companyId, inviteId } = tokenDoc.data();
    const inviteRef = firestore.collection("companies").doc(companyId).collection("invites").doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists || inviteDoc.data().status !== "pending") {
      throw new HttpsError("not-found", "Invalid, expired, or already accepted invitation.");
    }

    const invite = inviteDoc.data();

    if (Date.now() > invite.expiresAt) {
      await inviteRef.update({ status: "expired" });
      await tokenDoc.ref.delete();
      throw new HttpsError("failed-precondition", "Invitation has expired.");
    }

    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "Unknown Company";

    return {
      name: invite.name,
      role: invite.role,
      email: invite.email,
      companyName: companyName,
    };
  } catch (error) {
    logger.error("Error in getInvitePreview:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred fetching the invite preview.");
  }
});

// =============================================================================
// acceptInvite
// =============================================================================

exports.acceptInvite = onCall(async (request) => {
  const { token, password } = request.data;

  if (!token) {
    throw new HttpsError("invalid-argument", "Missing token.");
  }

  try {
    // 1. Resolve token → invite via flat lookup (no index required)
    const tokenDoc = await firestore.collection("inviteTokens").doc(token).get();
    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Invalid, expired, or already accepted invitation.");
    }

    const { companyId, inviteId } = tokenDoc.data();
    const inviteRef = firestore.collection("companies").doc(companyId).collection("invites").doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists || inviteDoc.data().status !== "pending") {
      throw new HttpsError("not-found", "Invalid, expired, or already accepted invitation.");
    }

    const invite = inviteDoc.data();

    if (Date.now() > invite.expiresAt) {
      await inviteRef.update({ status: "expired" });
      await tokenDoc.ref.delete();
      throw new HttpsError("failed-precondition", "Invitation has expired.");
    }

    let uid;
    let authUserRecord;
    let isNewUser = false;

    // 2. Check if email already has a Firebase Auth account
    try {
      authUserRecord = await admin.auth().getUserByEmail(invite.email);
      uid = authUserRecord.uid;
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        isNewUser = true;
      } else {
        throw error;
      }
    }

    // 3. Create auth user if not exists
    if (isNewUser) {
      if (!password || password.length < 6) {
        throw new HttpsError(
          "invalid-argument",
          "Password is required for new users and must be at least 6 characters."
        );
      }
      authUserRecord = await admin.auth().createUser({
        email: invite.email,
        password: password,
        displayName: invite.name,
      });
      uid = authUserRecord.uid;
    }

    // 4. Set custom claims
    await admin.auth().setCustomUserClaims(uid, {
      role: invite.role,
      companyId: companyId,
      approved: true, // HR invites are auto-approved
    });

    // 5. Create/update /users/{uid} document
    await firestore.collection("users").doc(uid).set({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      companyId: companyId,
      departmentId: invite.departmentId || null,
      salaryBandId: invite.salaryBandId || null,
      approved: true,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 6. Update invite status to accepted and clean up token lookup
    await inviteRef.update({ status: "accepted" });
    await tokenDoc.ref.delete();

    // 7. Audit log
    await writeAuditLog({
      companyId,
      action: "user_approved",
      actorUid: uid,
      actorEmail: invite.email,
      actorRole: invite.role,
      targetType: "user",
      targetId: uid,
      metadata: { source: "invite", inviteId },
    });

    return { success: true };
  } catch (error) {
    logger.error("Error in acceptInvite:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

// =============================================================================
// resendInvite
// =============================================================================

exports.resendInvite = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { inviteId } = request.data;

  if (!inviteId) {
    throw new HttpsError("invalid-argument", "Missing inviteId.");
  }

  try {
    const inviteRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("invites")
      .doc(inviteId);

    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      throw new HttpsError("not-found", "Invite not found.");
    }

    const invite = inviteDoc.data();

    if (invite.status !== "pending") {
      throw new HttpsError("failed-precondition", "Only pending invites can be resent.");
    }

    if (invite.resendCount >= 3) {
      throw new HttpsError("failed-precondition", "Maximum resend limit reached.");
    }

    const oldToken = invite.token;
    const newInviteToken = crypto.randomUUID();
    const newExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await inviteRef.update({
      token: newInviteToken,
      expiresAt: newExpiresAt,
      resendCount: admin.firestore.FieldValue.increment(1),
    });

    // Swap the flat token lookup
    await firestore.collection("inviteTokens").doc(oldToken).delete();
    await firestore.collection("inviteTokens").doc(newInviteToken).set({
      companyId,
      inviteId,
      expiresAt: newExpiresAt,
    });

    // Send email
    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

    await sendEmail({
      subject: `Reminder: You've been invited to ${companyName}`,
      htmlContent: `
      <html>
        <body>
          <h1>Welcome to ${companyName}!</h1>
          <p>Hi ${invite.name},</p>
          <p>You have been invited to join ${companyName} on MeritCyc as a ${invite.role}.</p>
          <p>Please click the link below to accept your invitation:</p>
          <a href="${process.env.APP_URL || "https://meritcyc-7a683.web.app"}/accept-invite?token=${newInviteToken}">Accept Invitation</a>
          <p>This link expires in 7 days.</p>
        </body>
      </html>
    `,
      sender: { name: companyName, email: "invites@meritcyc.com" },
      to: [{ email: invite.email, name: invite.name }],
    });

    // Audit log
    await writeAuditLog({
      companyId,
      action: "user_invited", // Use same action, but mention resend
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "user",
      targetId: inviteId,
      metadata: { resend: true, count: invite.resendCount + 1 },
    });

    return { success: true };
  } catch (error) {
    logger.error("Error in resendInvite:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

// =============================================================================
// revokeInvite
// =============================================================================

exports.revokeInvite = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { inviteId } = request.data;

  if (!inviteId) {
    throw new HttpsError("invalid-argument", "Missing inviteId.");
  }

  try {
    const inviteRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("invites")
      .doc(inviteId);

    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      throw new HttpsError("not-found", "Invite not found.");
    }

    const invite = inviteDoc.data();

    if (invite.status !== "pending") {
      throw new HttpsError("failed-precondition", "Only pending invites can be revoked.");
    }

    await inviteRef.update({
      status: "revoked",
    });

    // Remove the flat token lookup so the link no longer works
    await firestore.collection("inviteTokens").doc(invite.token).delete();

    // Audit log
    await writeAuditLog({
      companyId,
      action: "user_deactivated", // Nearest standard action for revoked
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "user",
      targetId: inviteId,
      metadata: { revoked: true },
    });

    return { success: true };
  } catch (error) {
    logger.error("Error in revokeInvite:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

// =============================================================================
// bulkImportEmployees
// =============================================================================

exports.bulkImportEmployees = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { employees } = request.data;

  if (!employees || !Array.isArray(employees)) {
    throw new HttpsError("invalid-argument", "Invalid employees array.");
  }

  if (employees.length > 200) {
    throw new HttpsError("invalid-argument", "Maximum 200 employees per batch.");
  }

  const failed = [];
  const validInvites = [];

  const companyDoc = await firestore.collection("companies").doc(companyId).get();
  const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

  // Validate all rows
  for (let i = 0; i < employees.length; i++) {
    const row = employees[i];

    if (!row.email || !row.name || !row.role) {
      failed.push({ row, reason: "Missing required fields" });
      continue;
    }

    if (row.role !== "employee" && row.role !== "manager") {
      failed.push({ row, reason: "Invalid role" });
      continue;
    }

    // In a real scenario, we might want to batch query emails to avoid N queries,
    // but for simplicity and within limits we can do it here, or gather all emails first.
    const userSnapshot = await firestore
      .collection("users")
      .where("email", "==", row.email)
      .limit(1)
      .get();

    if (!userSnapshot.empty) {
      failed.push({ row, reason: "User with this email already exists" });
      continue;
    }

    validInvites.push(row);
  }

  if (validInvites.length === 0) {
    return { success: true, sent: 0, failed };
  }

  const batch = firestore.batch();
  const emailsToSend = [];
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const invitesCol = firestore.collection("companies").doc(companyId).collection("invites");

  const newInviteIds = [];

  for (const row of validInvites) {
    const inviteToken = crypto.randomUUID();
    const inviteRef = invitesCol.doc();

    const inviteData = {
      email: row.email,
      name: row.name,
      departmentId: row.departmentId || "",
      salaryBandId: row.salaryBandId || "",
      role: row.role,
      token: inviteToken,
      status: "pending",
      resendCount: 0,
      createdAt: Date.now(),
      expiresAt,
      createdBy: request.auth.uid,
      companyId,
    };

    batch.set(inviteRef, inviteData);
    newInviteIds.push(inviteRef.id);

    // Flat token lookup for index-free resolution
    batch.set(firestore.collection("inviteTokens").doc(inviteToken), {
      companyId,
      inviteId: inviteRef.id,
      expiresAt,
    });

    emailsToSend.push({
      subject: `You've been invited to ${companyName}`,
      htmlContent: `
        <html>
          <body>
            <h1>Welcome to ${companyName}!</h1>
            <p>Hi ${row.name},</p>
            <p>You have been invited to join ${companyName} on MeritCyc as a ${row.role}.</p>
            <p>Please click the link below to accept your invitation:</p>
            <a href="${process.env.APP_URL || "https://meritcyc-7a683.web.app"}/accept-invite?token=${inviteToken}">Accept Invitation</a>
            <p>This link expires in 7 days.</p>
          </body>
        </html>
      `,
      sender: { name: companyName, email: "invites@meritcyc.com" },
      to: [{ email: row.email, name: row.name }]
    });
  }

  try {
    await batch.commit();

    // Send emails in parallel via SMTP
    await Promise.all(emailsToSend.map(async (emailObj) => {
      try {
        await sendEmail({
          subject: emailObj.subject,
          htmlContent: emailObj.htmlContent,
          sender: emailObj.sender,
          to: emailObj.to,
        });
      } catch (e) {
        logger.error("Failed to send invite email", e);
      }
    }));

    // Audit log
    await writeAuditLog({
      companyId,
      action: "user_invited",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "user",
      targetId: "bulk",
      metadata: { count: validInvites.length },
    });

    return { success: true, sent: validInvites.length, failed };
  } catch (error) {
    logger.error("Error in bulkImportEmployees:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});
