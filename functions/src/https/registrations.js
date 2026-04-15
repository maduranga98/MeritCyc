const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { BrevoClient } = require("@getbrevo/brevo");

const firestore = admin.firestore();

// Set up Brevo v5.x client
const transactionalEmailsApi = new BrevoClient({ apiKey: process.env.BREVO_API_KEY || "" }).transactionalEmails;

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
// validateCompanyCode — Validate company code for self-registration
// =============================================================================

exports.validateCompanyCode = onCall(async (request) => {
  const { companyCode } = request.data;

  if (!companyCode) {
    throw new HttpsError("invalid-argument", "Missing companyCode.");
  }

  try {
    const regDocsSnapshot = await firestore
      .collectionGroup("registration")
      .where("companyCode", "==", companyCode.toUpperCase())
      .limit(1)
      .get();

    if (regDocsSnapshot.empty) {
      return {
        success: false,
        error: {
          code: "INVALID_CODE",
          message: "Company code not found.",
        },
      };
    }

    const regDoc = regDocsSnapshot.docs[0];
    const companyId = regDoc.ref.parent.parent?.id;

    if (!companyId) {
      return {
        success: false,
        error: {
          code: "INVALID_CODE",
          message: "Could not determine company.",
        },
      };
    }

    const regData = regDoc.data();

    if (!regData.qrEnabled) {
      const companyDoc = await firestore.collection("companies").doc(companyId).get();
      const companyName = companyDoc.exists ? companyDoc.data().name : "Your Company";

      return {
        success: false,
        error: {
          code: "REGISTRATION_DISABLED",
          message: "Registration is disabled for this company.",
        },
        companyName,
      };
    }

    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "Your Company";

    return {
      success: true,
      companyId,
      companyName,
    };
  } catch (error) {
    logger.error("Error in validateCompanyCode:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

// =============================================================================
// submitSelfRegistration — Self-registration via QR code
// =============================================================================

exports.submitSelfRegistration = onCall(async (request) => {
  const { companyCode, name, email, departmentId, jobTitle, password, phoneNumber, employeeId } = request.data;

  if (!companyCode || !name || !email || !jobTitle || !password) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: companyCode, name, email, jobTitle, password."
    );
  }

  try {
    // 1. Validate company code
    const regDocsSnapshot = await firestore
      .collectionGroup("registration")
      .where("companyCode", "==", companyCode.toUpperCase())
      .where("qrEnabled", "==", true)
      .limit(1)
      .get();

    if (regDocsSnapshot.empty) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid or disabled company code."
      );
    }

    const regDoc = regDocsSnapshot.docs[0];
    const companyId = regDoc.ref.parent.parent?.id;

    if (!companyId) {
      throw new HttpsError("internal", "Could not determine company.");
    }

    // 2. Check if email already exists in this company's users
    const userSnapshot = await firestore
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .where("companyId", "==", companyId)
      .limit(1)
      .get();

    if (!userSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "An account with this email already exists in this company."
      );
    }

    // 3. Check if there's already a pending registration for this email
    const pendingSnapshot = await firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .where("email", "==", email.toLowerCase())
      .where("status", "in", ["pending_approval", "info_requested"])
      .limit(1)
      .get();

    if (!pendingSnapshot.empty) {
      throw new HttpsError(
        "already-exists",
        "A registration request with this email is already pending."
      );
    }

    // 4. Create pending registration document
    const pendingId = firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc().id;

    const pendingData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      companyId,
      companyCode: companyCode.toUpperCase(),
      departmentId: departmentId || "",
      jobTitle: jobTitle.trim(),
      status: "pending_approval",
      phoneNumber: phoneNumber?.trim() || "",
      employeeId: employeeId?.trim() || "",
      registrationMethod: "self_registration",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc(pendingId)
      .set(pendingData);

    // 5. Notify HR admins
    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

    const hrAdminsSnapshot = await firestore
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "hr_admin")
      .where("status", "==", "active")
      .get();

    if (!hrAdminsSnapshot.empty) {
      const toEmails = hrAdminsSnapshot.docs.map(doc => ({
        email: doc.data().email,
        name: doc.data().name
      }));

      try {
        await transactionalEmailsApi.sendTransacEmail({
          subject: `New self-registration pending approval at ${companyName}`,
          htmlContent: `
        <html>
          <body>
            <h2>New Registration Request</h2>
            <p>A new employee has registered via QR code and is waiting for approval.</p>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Job Title:</strong> ${jobTitle}</p>
            <p>Please log in to MeritCyc to review and approve this registration.</p>
          </body>
        </html>
      `,
          sender: { name: companyName, email: "noreply@meritcyc.com" },
          to: toEmails,
        });
      } catch (e) {
        logger.error("Failed to send HR notification email", e);
      }
    }

    // 6. Audit log
    await writeAuditLog({
      companyId,
      action: "SELF_REGISTRATION_SUBMITTED",
      actorUid: "system",
      actorEmail: email,
      actorRole: "employee",
      targetType: "pendingRegistration",
      targetId: pendingId,
      after: pendingData,
    });

    return { success: true, message: "Registration submitted successfully." };
  } catch (error) {
    logger.error("Error in submitSelfRegistration:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

exports.approveRegistration = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { pendingId, departmentId, salaryBandId, role } = request.data;

  if (!pendingId) {
    throw new HttpsError("invalid-argument", "Missing pendingId.");
  }

  try {
    const pendingRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc(pendingId);

    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      throw new HttpsError("not-found", "Pending registration not found.");
    }

    const pendingData = pendingDoc.data();

    if (pendingData.status !== "pending_approval" && pendingData.status !== "info_requested") {
      throw new HttpsError("failed-precondition", "Registration is not pending approval.");
    }

    const finalRole = role || pendingData.role || "employee";
    const finalDept = departmentId !== undefined ? departmentId : (pendingData.departmentId || null);
    const finalBand = salaryBandId !== undefined ? salaryBandId : (pendingData.salaryBandId || null);

    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: pendingData.email,
      password: tempPassword,
      displayName: pendingData.name,
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: finalRole,
      companyId: companyId,
      approved: true,
    });

    // Create user document
    await firestore.collection("users").doc(userRecord.uid).set({
      email: pendingData.email,
      name: pendingData.name,
      role: finalRole,
      companyId: companyId,
      departmentId: finalDept,
      salaryBandId: finalBand,
      jobTitle: pendingData.jobTitle || "",
      approved: true,
      approvedBy: request.auth.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      registrationMethod: pendingData.registrationMethod || "self_registration",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update pending registration
    await pendingRef.update({
      status: "approved",
      approvedBy: request.auth.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      departmentId: finalDept,
      salaryBandId: finalBand,
      role: finalRole,
    });

    // Increment employee count
    await firestore.collection("companies").doc(companyId).update({
      employeeCount: admin.firestore.FieldValue.increment(1)
    });

    // Send email
    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

    try {
      await transactionalEmailsApi.sendTransacEmail({
        subject: `Welcome to ${companyName} on MeritCyc!`,
        htmlContent: `
      <html>
        <body>
          <h1>Welcome to ${companyName}!</h1>
          <p>Hi ${pendingData.name},</p>
          <p>Your registration has been approved. You can now log in to MeritCyc.</p>
          <p><strong>Login URL:</strong> <a href="https://app.meritcyc.com">https://app.meritcyc.com</a></p>
          <p><strong>Email:</strong> ${pendingData.email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><em>Please change your password after your first login.</em></p>
        </body>
      </html>
    `,
        sender: { name: companyName, email: "noreply@meritcyc.com" },
        to: [{ email: pendingData.email, name: pendingData.name }],
      });
    } catch (e) {
      logger.error("Failed to send approval email", e);
    }

    // Audit log
    await writeAuditLog({
      companyId,
      action: "REGISTRATION_APPROVED",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "pendingRegistration",
      targetId: pendingId,
    });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    logger.error("Error in approveRegistration:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

exports.bulkApprove = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { pendingIds } = request.data;

  if (!pendingIds || !Array.isArray(pendingIds) || pendingIds.length === 0) {
    throw new HttpsError("invalid-argument", "Missing or invalid pendingIds.");
  }

  if (pendingIds.length > 50) {
    throw new HttpsError("invalid-argument", "Maximum 50 registrations can be approved at once.");
  }

  const failed = [];
  let approvedCount = 0;

  for (const pendingId of pendingIds) {
    try {
      // Reusing the same logic by calling the inner implementation
      // For simplicity, we implement it inline here as it requires individual auth creates
      const pendingRef = firestore
        .collection("companies")
        .doc(companyId)
        .collection("pendingRegistrations")
        .doc(pendingId);

      const pendingDoc = await pendingRef.get();

      if (!pendingDoc.exists) {
        failed.push({ id: pendingId, reason: "Not found" });
        continue;
      }

      const pendingData = pendingDoc.data();

      if (pendingData.status !== "pending_approval" && pendingData.status !== "info_requested") {
        failed.push({ id: pendingId, reason: "Not pending approval" });
        continue;
      }

      const finalRole = pendingData.role || "employee";
      const tempPassword = crypto.randomUUID().slice(0, 12);

      const userRecord = await admin.auth().createUser({
        email: pendingData.email,
        password: tempPassword,
        displayName: pendingData.name,
      });

      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: finalRole,
        companyId: companyId,
        approved: true,
      });

      const batch = firestore.batch();

      batch.set(firestore.collection("users").doc(userRecord.uid), {
        email: pendingData.email,
        name: pendingData.name,
        role: finalRole,
        companyId: companyId,
        departmentId: pendingData.departmentId || null,
        salaryBandId: pendingData.salaryBandId || null,
        jobTitle: pendingData.jobTitle || "",
        approved: true,
        approvedBy: request.auth.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        registrationMethod: pendingData.registrationMethod || "self_registration",
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      batch.update(pendingRef, {
        status: "approved",
        approvedBy: request.auth.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        role: finalRole,
      });

      batch.update(firestore.collection("companies").doc(companyId), {
        employeeCount: admin.firestore.FieldValue.increment(1)
      });

      await batch.commit();

      const companyDoc = await firestore.collection("companies").doc(companyId).get();
      const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

      try {
        await transactionalEmailsApi.sendTransacEmail({
          subject: `Welcome to ${companyName} on MeritCyc!`,
          htmlContent: `
        <html>
          <body>
            <h1>Welcome to ${companyName}!</h1>
            <p>Hi ${pendingData.name},</p>
            <p>Your registration has been approved. You can now log in to MeritCyc.</p>
            <p><strong>Login URL:</strong> <a href="https://app.meritcyc.com">https://app.meritcyc.com</a></p>
            <p><strong>Email:</strong> ${pendingData.email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p><em>Please change your password after your first login.</em></p>
          </body>
        </html>
      `,
          sender: { name: companyName, email: "noreply@meritcyc.com" },
          to: [{ email: pendingData.email, name: pendingData.name }],
        });
      } catch (e) {
        logger.error("Failed to send approval email", e);
      }

      await writeAuditLog({
        companyId,
        action: "REGISTRATION_APPROVED",
        actorUid: request.auth.uid,
        actorEmail: token.email || "",
        actorRole: token.role,
        targetType: "pendingRegistration",
        targetId: pendingId,
        metadata: { bulk: true }
      });

      approvedCount++;
    } catch (e) {
      logger.error(`Error bulk approving ${pendingId}:`, e);
      failed.push({ id: pendingId, reason: e.message });
    }
  }

  return { success: true, approved: approvedCount, failed };
});

exports.bulkReject = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { pendingIds, reason } = request.data;

  if (!pendingIds || !Array.isArray(pendingIds) || pendingIds.length === 0) {
    throw new HttpsError("invalid-argument", "Missing or invalid pendingIds.");
  }
  if (!reason || reason.trim() === "") {
    throw new HttpsError("invalid-argument", "Reason is required for rejection.");
  }

  let rejectedCount = 0;
  const emailsToSend = [];
  const batch = firestore.batch();

  for (const pendingId of pendingIds) {
    const pendingRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc(pendingId);

    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) continue;

    const pendingData = pendingDoc.data();

    if (pendingData.status !== "pending_approval" && pendingData.status !== "info_requested") {
      continue;
    }

    batch.update(pendingRef, {
      status: "rejected",
      rejectedReason: reason,
      rejectedBy: request.auth.uid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    emailsToSend.push({
      email: pendingData.email,
      name: pendingData.name
    });

    rejectedCount++;
  }

  if (rejectedCount > 0) {
    await batch.commit();

    await Promise.all(emailsToSend.map(async (u) => {
      try {
        await transactionalEmailsApi.sendTransacEmail({
          subject: "Your MeritCyc registration was not approved",
          htmlContent: `
        <html>
          <body>
            <p>Hi ${u.name},</p>
            <p>Unfortunately your registration request was not approved.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Contact your HR team for more information.</p>
          </body>
        </html>
      `,
          sender: { name: "MeritCyc", email: "noreply@meritcyc.com" },
          to: [{ email: u.email, name: u.name }],
        });
      } catch (e) {
        logger.error("Failed to send rejection email", e);
      }
    }));

    await writeAuditLog({
      companyId,
      action: "REGISTRATION_REJECTED",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "pendingRegistration",
      targetId: "bulk",
      metadata: { count: rejectedCount, reason }
    });
  }

  return { success: true, rejected: rejectedCount };
});

exports.rejectRegistration = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { pendingId, reason } = request.data;

  if (!pendingId || !reason || reason.trim() === "") {
    throw new HttpsError("invalid-argument", "Missing pendingId or reason.");
  }

  try {
    const pendingRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc(pendingId);

    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      throw new HttpsError("not-found", "Pending registration not found.");
    }

    const pendingData = pendingDoc.data();

    if (pendingData.status !== "pending_approval" && pendingData.status !== "info_requested") {
      throw new HttpsError("failed-precondition", "Registration is not pending approval.");
    }

    await pendingRef.update({
      status: "rejected",
      rejectedReason: reason,
      rejectedBy: request.auth.uid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
      await transactionalEmailsApi.sendTransacEmail({
        subject: "Your MeritCyc registration was not approved",
        htmlContent: `
      <html>
        <body>
          <p>Hi ${pendingData.name},</p>
          <p>Unfortunately your registration request was not approved.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Contact your HR team for more information.</p>
        </body>
      </html>
    `,
        sender: { name: "MeritCyc", email: "noreply@meritcyc.com" },
        to: [{ email: pendingData.email, name: pendingData.name }],
      });
    } catch (e) {
      logger.error("Failed to send rejection email", e);
    }

    await writeAuditLog({
      companyId,
      action: "REGISTRATION_REJECTED",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "pendingRegistration",
      targetId: pendingId,
      metadata: { reason }
    });

    return { success: true };
  } catch (error) {
    logger.error("Error in rejectRegistration:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});

exports.pendingApprovalReminder = onSchedule("every 12 hours", async (event) => {
  try {
    const companiesSnapshot = await firestore.collection("companies").get();

    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

      const pendingSnapshot = await firestore
        .collection("companies")
        .doc(companyId)
        .collection("pendingRegistrations")
        .where("status", "==", "pending_approval")
        .where("createdAt", "<", twentyFourHoursAgo)
        .get();

      const count = pendingSnapshot.size;

      if (count > 0) {
        // Get HR admins for this company
        const hrAdminsSnapshot = await firestore
          .collection("users")
          .where("companyId", "==", companyId)
          .where("role", "==", "hr_admin")
          .where("status", "==", "active")
          .get();

        if (!hrAdminsSnapshot.empty) {
          const toEmails = hrAdminsSnapshot.docs.map(doc => ({ email: doc.data().email, name: doc.data().name }));

          try {
            await transactionalEmailsApi.sendTransacEmail({
              subject: "Pending Registration Reminders",
              htmlContent: `
            <html>
              <body>
                <p>Hello,</p>
                <p>You have ${count} pending registration(s) waiting for approval in MeritCyc.</p>
                <p>Please log in to review them.</p>
              </body>
            </html>
          `,
              sender: { name: "MeritCyc", email: "noreply@meritcyc.com" },
              to: toEmails,
            });
          } catch (e) {
            logger.error(`Failed to send reminder email for company ${companyId}`, e);
          }
        }
      }
    }
  } catch (error) {
    logger.error("Error in pendingApprovalReminder:", error);
  }
});

exports.requestMoreInfo = onCall(async (request) => {
  const token = await requireHrOrSuperAdmin(request);
  const companyId = token.companyId;

  const { pendingId, message } = request.data;

  if (!pendingId || !message || message.trim() === "") {
    throw new HttpsError("invalid-argument", "Missing pendingId or message.");
  }

  try {
    const pendingRef = firestore
      .collection("companies")
      .doc(companyId)
      .collection("pendingRegistrations")
      .doc(pendingId);

    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      throw new HttpsError("not-found", "Pending registration not found.");
    }

    const pendingData = pendingDoc.data();

    if (pendingData.status !== "pending_approval" && pendingData.status !== "info_requested") {
      throw new HttpsError("failed-precondition", "Registration is not pending approval.");
    }

    await pendingRef.update({
      status: "info_requested",
      infoRequestedMessage: message
    });

    const companyDoc = await firestore.collection("companies").doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : "MeritCyc";

    try {
      await transactionalEmailsApi.sendTransacEmail({
        subject: `Information requested for your ${companyName} registration`,
        htmlContent: `
      <html>
        <body>
          <p>Hi ${pendingData.name},</p>
          <p>Your HR team has requested more information regarding your registration to ${companyName} on MeritCyc.</p>
          <p><strong>Message from HR:</strong></p>
          <blockquote>${message}</blockquote>
          <p>Please contact your HR team with the requested information.</p>
        </body>
      </html>
    `,
        sender: { name: companyName, email: "noreply@meritcyc.com" },
        to: [{ email: pendingData.email, name: pendingData.name }],
      });
    } catch (e) {
      logger.error("Failed to send info requested email", e);
    }

    await writeAuditLog({
      companyId,
      action: "REGISTRATION_INFO_REQUESTED",
      actorUid: request.auth.uid,
      actorEmail: token.email || "",
      actorRole: token.role,
      targetType: "pendingRegistration",
      targetId: pendingId,
      metadata: { message }
    });

    return { success: true };
  } catch (error) {
    logger.error("Error in requestMoreInfo:", error);
    throw new HttpsError("internal", error.message || "An error occurred.");
  }
});
