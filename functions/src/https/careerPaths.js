const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const firestore = admin.firestore();

// =============================================================================
// Helpers
// =============================================================================

function requireHrOrAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { role, companyId } = request.auth.token;
  if (role !== "hr_admin" && role !== "super_admin") {
    throw new HttpsError(
      "permission-denied",
      "Only HR admins and super admins can perform this action."
    );
  }
  if (!companyId) {
    throw new HttpsError("failed-precondition", "No companyId in token.");
  }
  return { uid: request.auth.uid, role, companyId };
}

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

function validateCareerPathPayload(data) {
  const { name, levels } = data;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Path name is required.");
  }

  if (!Array.isArray(levels) || levels.length < 2) {
    throw new HttpsError("invalid-argument", "At least 2 levels are required.");
  }

  // Check sequential level numbers
  for (let i = 0; i < levels.length; i++) {
    const expectedNumber = i + 1;
    if (levels[i].levelNumber !== expectedNumber) {
      throw new HttpsError(
        "invalid-argument",
        `Level numbers must be sequential starting at 1. Expected level ${expectedNumber} at index ${i}.`
      );
    }
    if (!levels[i].title || typeof levels[i].title !== "string") {
      throw new HttpsError("invalid-argument", `Title is required for level ${expectedNumber}.`);
    }
    if (!levels[i].salaryBandId) {
      throw new HttpsError("invalid-argument", `Salary band is required for level ${expectedNumber}.`);
    }
    if (typeof levels[i].requiredScore !== "number" || levels[i].requiredScore < 0 || levels[i].requiredScore > 100) {
      throw new HttpsError("invalid-argument", `Required score must be between 0 and 100 for level ${expectedNumber}.`);
    }
    if (typeof levels[i].requiredCycles !== "number" || levels[i].requiredCycles < 1) {
      throw new HttpsError("invalid-argument", `Required cycles must be at least 1 for level ${expectedNumber}.`);
    }
  }

  // Check duplicate salary bands
  const bandIds = levels.map((l) => l.salaryBandId);
  const uniqueBands = new Set(bandIds);
  if (uniqueBands.size !== bandIds.length) {
    throw new HttpsError("invalid-argument", "Duplicate salary bands are not allowed across levels.");
  }
}

async function sendNotification({ userId, type, title, message, metadata = {} }) {
  try {
    const notifRef = firestore.collection("users").doc(userId).collection("notifications").doc();
    await notifRef.set({
      type,
      title,
      message,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...metadata,
    });
  } catch (e) {
    logger.error("Failed to send notification:", e);
  }
}

// =============================================================================
// createCareerPath
// =============================================================================

exports.createCareerPath = onCall({ cors: true }, async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const data = request.data;

  validateCareerPathPayload(data);

  try {
    // Verify salary bands exist
    for (const level of data.levels) {
      const bandDoc = await firestore
        .collection("companies")
        .doc(companyId)
        .collection("salaryBands")
        .doc(level.salaryBandId)
        .get();
      if (!bandDoc.exists) {
        throw new HttpsError("not-found", `Salary band ${level.salaryBandId} not found.`);
      }
      level.salaryBandName = bandDoc.data().name || "Unknown";
    }

    const pathRef = firestore.collection("companies").doc(companyId).collection("careerPaths").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const pathData = {
      companyId,
      name: data.name.trim(),
      description: (data.description || "").trim(),
      levels: data.levels,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      isActive: data.isActive !== false,
    };

    await pathRef.set(pathData);

    await writeAuditLog({
      companyId,
      action: "CAREER_PATH_CREATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "careerPath",
      targetId: pathRef.id,
      after: { name: pathData.name, levelCount: pathData.levels.length },
    });

    return { success: true, pathId: pathRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in createCareerPath:", error);
    throw new HttpsError("internal", error.message || "Failed to create career path.");
  }
});

// =============================================================================
// updateCareerPath
// =============================================================================

exports.updateCareerPath = onCall({ cors: true }, async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { pathId, ...data } = request.data;

  if (!pathId) {
    throw new HttpsError("invalid-argument", "pathId is required.");
  }

  validateCareerPathPayload(data);

  try {
    const pathRef = firestore.collection("companies").doc(companyId).collection("careerPaths").doc(pathId);
    const pathDoc = await pathRef.get();

    if (!pathDoc.exists) {
      throw new HttpsError("not-found", "Career path not found.");
    }

    // Verify salary bands exist and denormalize names
    for (const level of data.levels) {
      const bandDoc = await firestore
        .collection("companies")
        .doc(companyId)
        .collection("salaryBands")
        .doc(level.salaryBandId)
        .get();
      if (!bandDoc.exists) {
        throw new HttpsError("not-found", `Salary band ${level.salaryBandId} not found.`);
      }
      level.salaryBandName = bandDoc.data().name || "Unknown";
    }

    const updates = {
      name: data.name.trim(),
      description: (data.description || "").trim(),
      levels: data.levels,
      isActive: data.isActive !== false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await pathRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "CAREER_PATH_UPDATED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "careerPath",
      targetId: pathId,
      before: pathDoc.data(),
      after: updates,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in updateCareerPath:", error);
    throw new HttpsError("internal", error.message || "Failed to update career path.");
  }
});

// =============================================================================
// assignCareerPath
// =============================================================================

exports.assignCareerPath = onCall({ cors: true }, async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { targetUserId, careerPathId, startingLevelId } = request.data;

  if (!targetUserId || !careerPathId) {
    throw new HttpsError("invalid-argument", "targetUserId and careerPathId are required.");
  }

  try {
    // Verify target user belongs to same company
    const userDoc = await firestore.collection("users").doc(targetUserId).get();
    if (!userDoc.exists || userDoc.data().companyId !== companyId) {
      throw new HttpsError("not-found", "Target user not found in your company.");
    }

    // Verify career path exists and is active
    const pathRef = firestore.collection("companies").doc(companyId).collection("careerPaths").doc(careerPathId);
    const pathDoc = await pathRef.get();
    if (!pathDoc.exists) {
      throw new HttpsError("not-found", "Career path not found.");
    }
    const pathData = pathDoc.data();
    if (!pathData.isActive) {
      throw new HttpsError("failed-precondition", "Career path is not active.");
    }

    const levels = pathData.levels || [];
    let startLevel = levels[0];
    if (startingLevelId) {
      const found = levels.find((l) => l.levelId === startingLevelId);
      if (!found) {
        throw new HttpsError("invalid-argument", "Starting level not found in this career path.");
      }
      startLevel = found;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Build milestone achievements
    const milestoneAchievements = (startLevel.milestones || []).map((m) => ({
      milestoneId: m.milestoneId,
      achieved: false,
    }));

    // Calculate initial progress from existing evaluations
    const evalsSnap = await firestore
      .collection("evaluations")
      .where("employeeUid", "==", targetUserId)
      .where("companyId", "==", companyId)
      .where("status", "==", "finalized")
      .orderBy("finalizedAt", "desc")
      .limit(2)
      .get();

    let avgScore = 0;
    const completedCycles = evalsSnap.size;
    if (completedCycles > 0) {
      let sum = 0;
      evalsSnap.forEach((d) => {
        sum += d.data().weightedTotalScore || 0;
      });
      avgScore = sum / completedCycles;
    }

    const nextLevel = levels.find((l) => l.levelNumber === startLevel.levelNumber + 1);
    const progressPercent = nextLevel
      ? Math.min(100, Math.round((avgScore / nextLevel.requiredScore) * 100))
      : 100;

    const careerMapData = {
      userId: targetUserId,
      companyId,
      careerPathId,
      careerPathName: pathData.name,
      currentLevelId: startLevel.levelId,
      currentLevelNumber: startLevel.levelNumber,
      currentLevelTitle: startLevel.title,
      currentSalaryBandId: startLevel.salaryBandId,
      currentSalaryBandName: startLevel.salaryBandName,
      nextLevelId: nextLevel ? nextLevel.levelId : null,
      nextLevelTitle: nextLevel ? nextLevel.title : null,
      nextRequiredScore: nextLevel ? nextLevel.requiredScore : 0,
      nextRequiredCycles: nextLevel ? nextLevel.requiredCycles : 0,
      completedCyclesAtLevel: completedCycles,
      averageScoreLastTwoCycles: avgScore,
      progressPercent,
      milestoneAchievements,
      levelHistory: [
        {
          levelId: startLevel.levelId,
          levelTitle: startLevel.title,
          salaryBandName: startLevel.salaryBandName,
          startedAt: new Date(), // Cannot use serverTimestamp inside arrays
        },
      ],
      assignedBy: uid,
      assignedAt: now,
      updatedAt: now,
    };

    await firestore.collection("users").doc(targetUserId).collection("careerMap").doc("current").set(careerMapData);

    await writeAuditLog({
      companyId,
      action: "CAREER_PATH_ASSIGNED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "user",
      targetId: targetUserId,
      after: { careerPathId, careerPathName: pathData.name, startingLevelId: startLevel.levelId },
    });

    await sendNotification({
      userId: targetUserId,
      type: "career_path_assigned",
      title: "Career Path Assigned",
      message: "Your career path has been set by HR.",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in assignCareerPath:", error);
    throw new HttpsError("internal", error.message || "Failed to assign career path.");
  }
});

// =============================================================================
// recalculateCareerMap (internal helper)
// =============================================================================

async function recalculateCareerMap(userId) {
  const careerMapRef = firestore.collection("users").doc(userId).collection("careerMap").doc("current");
  const careerMapDoc = await careerMapRef.get();

  if (!careerMapDoc.exists) {
    logger.info(`No careerMap found for user ${userId}, skipping recalculation.`);
    return;
  }

  const mapData = careerMapDoc.data();
  const { companyId, careerPathId, currentLevelId } = mapData;

  // Get career path
  const pathDoc = await firestore
    .collection("companies")
    .doc(companyId)
    .collection("careerPaths")
    .doc(careerPathId)
    .get();

  if (!pathDoc.exists) {
    logger.warn(`Career path ${careerPathId} not found for user ${userId}.`);
    return;
  }

  const pathData = pathDoc.data();
  const levels = pathData.levels || [];
  const currentLevel = levels.find((l) => l.levelId === currentLevelId);
  const nextLevel = levels.find((l) => l.levelNumber === (currentLevel?.levelNumber || 0) + 1);

  // Get last 2 finalized evaluations
  const evalsSnap = await firestore
    .collection("evaluations")
    .where("employeeUid", "==", userId)
    .where("companyId", "==", companyId)
    .where("status", "==", "finalized")
    .orderBy("finalizedAt", "desc")
    .limit(2)
    .get();

  let avgScore = 0;
  let completedCyclesAtLevel = 0;

  if (!evalsSnap.empty) {
    let sum = 0;
    evalsSnap.forEach((d) => {
      sum += d.data().weightedTotalScore || 0;
    });
    avgScore = sum / evalsSnap.size;

    // Count cycles completed at current level
    // We approximate by counting all finalized evaluations since assignment
    // A more precise approach would track per-level cycle count
    const allEvalsSnap = await firestore
      .collection("evaluations")
      .where("employeeUid", "==", userId)
      .where("companyId", "==", companyId)
      .where("status", "==", "finalized")
      .orderBy("finalizedAt", "asc")
      .get();

    // Count evaluations since the current level started
    const levelStartedAt = mapData.levelHistory?.[mapData.levelHistory.length - 1]?.startedAt;
    if (levelStartedAt) {
      allEvalsSnap.forEach((d) => {
        const finalizedAt = d.data().finalizedAt;
        if (finalizedAt && finalizedAt.toMillis() >= levelStartedAt.toMillis()) {
          completedCyclesAtLevel++;
        }
      });
    } else {
      completedCyclesAtLevel = allEvalsSnap.size;
    }
  }

  const progressPercent = nextLevel
    ? Math.min(100, Math.round((avgScore / nextLevel.requiredScore) * 100))
    : 100;

  // Evaluate milestones
  const milestoneAchievements = [];
  if (currentLevel && currentLevel.milestones) {
    for (const m of currentLevel.milestones) {
      let achieved = false;
      switch (m.type) {
        case "cycle_count":
          achieved = completedCyclesAtLevel >= m.targetValue;
          break;
        case "score_threshold":
          achieved = avgScore >= m.targetValue;
          break;
        case "tenure_months": {
          const startedAt = mapData.levelHistory?.[mapData.levelHistory.length - 1]?.startedAt;
          if (startedAt) {
            const months = (Date.now() - startedAt.toMillis()) / (1000 * 60 * 60 * 24 * 30);
            achieved = months >= m.targetValue;
          }
          break;
        }
        case "manual":
          // Keep previous state if exists
          const prev = mapData.milestoneAchievements?.find((ma) => ma.milestoneId === m.milestoneId);
          achieved = prev ? prev.achieved : false;
          break;
      }

      const existing = mapData.milestoneAchievements?.find((ma) => ma.milestoneId === m.milestoneId);
      milestoneAchievements.push({
        milestoneId: m.milestoneId,
        achieved,
        achievedAt: achieved && existing && existing.achievedAt ? existing.achievedAt : achieved ? new Date() : null,
      });
    }
  }

  const updates = {
    averageScoreLastTwoCycles: avgScore,
    progressPercent,
    completedCyclesAtLevel,
    milestoneAchievements,
    nextLevelId: nextLevel ? nextLevel.levelId : null,
    nextLevelTitle: nextLevel ? nextLevel.title : null,
    nextRequiredScore: nextLevel ? nextLevel.requiredScore : 0,
    nextRequiredCycles: nextLevel ? nextLevel.requiredCycles : 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await careerMapRef.update(updates);

  // Check promotion threshold
  if (nextLevel && progressPercent >= 100 && completedCyclesAtLevel >= nextLevel.requiredCycles) {
    const userDoc = await firestore.collection("users").doc(userId).get();
    const userName = userDoc.exists ? userDoc.data().name : "An employee";

    // Notify HR admins
    const hrAdmins = await firestore
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "in", ["hr_admin", "super_admin"])
      .get();

    const notifBatch = firestore.batch();
    hrAdmins.forEach((hrDoc) => {
      const notifRef = firestore.collection("users").doc(hrDoc.id).collection("notifications").doc();
      notifBatch.set(notifRef, {
        type: "promotion_ready",
        title: "Promotion Ready for Review",
        message: `${userName} has met the criteria for promotion to ${nextLevel.title}. Review and approve.`,
        metadata: { targetUserId: userId, newLevelId: nextLevel.levelId },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await notifBatch.commit();
  }
}

exports.recalculateCareerMap = recalculateCareerMap;

// =============================================================================
// approvePromotion
// =============================================================================

exports.approvePromotion = onCall({ cors: true }, async (request) => {
  const { uid, role, companyId } = requireHrOrAdmin(request);
  const { targetUserId, newLevelId } = request.data;

  if (!targetUserId || !newLevelId) {
    throw new HttpsError("invalid-argument", "targetUserId and newLevelId are required.");
  }

  try {
    const careerMapRef = firestore.collection("users").doc(targetUserId).collection("careerMap").doc("current");
    const careerMapDoc = await careerMapRef.get();

    if (!careerMapDoc.exists) {
      throw new HttpsError("not-found", "Career map not found for this employee.");
    }

    const mapData = careerMapDoc.data();
    if (mapData.companyId !== companyId) {
      throw new HttpsError("permission-denied", "Employee not in your company.");
    }

    const pathDoc = await firestore
      .collection("companies")
      .doc(companyId)
      .collection("careerPaths")
      .doc(mapData.careerPathId)
      .get();

    if (!pathDoc.exists) {
      throw new HttpsError("not-found", "Career path not found.");
    }

    const pathData = pathDoc.data();
    const levels = pathData.levels || [];
    const newLevel = levels.find((l) => l.levelId === newLevelId);

    if (!newLevel) {
      throw new HttpsError("not-found", "New level not found in career path.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const beforeState = { ...mapData };

    // Update current level in levelHistory
    const levelHistory = mapData.levelHistory || [];
    if (levelHistory.length > 0) {
      levelHistory[levelHistory.length - 1].promotedAt = new Date(); // Cannot use serverTimestamp inside arrays
    }

    levelHistory.push({
      levelId: newLevel.levelId,
      levelTitle: newLevel.title,
      salaryBandName: newLevel.salaryBandName,
      startedAt: new Date(), // Cannot use serverTimestamp inside arrays
    });

    const nextLevel = levels.find((l) => l.levelNumber === newLevel.levelNumber + 1);

    // Reset milestone achievements for new level
    const milestoneAchievements = (newLevel.milestones || []).map((m) => ({
      milestoneId: m.milestoneId,
      achieved: false,
    }));

    const updates = {
      currentLevelId: newLevel.levelId,
      currentLevelNumber: newLevel.levelNumber,
      currentLevelTitle: newLevel.title,
      currentSalaryBandId: newLevel.salaryBandId,
      currentSalaryBandName: newLevel.salaryBandName,
      nextLevelId: nextLevel ? nextLevel.levelId : null,
      nextLevelTitle: nextLevel ? nextLevel.title : null,
      nextRequiredScore: nextLevel ? nextLevel.requiredScore : 0,
      nextRequiredCycles: nextLevel ? nextLevel.requiredCycles : 0,
      completedCyclesAtLevel: 0,
      progressPercent: nextLevel ? Math.min(100, Math.round((mapData.averageScoreLastTwoCycles / nextLevel.requiredScore) * 100)) : 100,
      milestoneAchievements,
      levelHistory,
      updatedAt: now,
    };

    await careerMapRef.update(updates);

    await writeAuditLog({
      companyId,
      action: "PROMOTION_APPROVED",
      actorUid: uid,
      actorEmail: request.auth.token.email || "",
      actorRole: role,
      targetType: "user",
      targetId: targetUserId,
      before: beforeState,
      after: updates,
    });

    await sendNotification({
      userId: targetUserId,
      type: "promotion_approved",
      title: "Congratulations!",
      message: `You have been promoted to ${newLevel.title}.`,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in approvePromotion:", error);
    throw new HttpsError("internal", error.message || "Failed to approve promotion.");
  }
});

// =============================================================================
// getCareerMapForEmployee
// =============================================================================

exports.getCareerMapForEmployee = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerUid = request.auth.uid;
  const callerRole = request.auth.token.role;
  const callerCompanyId = request.auth.token.companyId;
  const { targetUserId } = request.data;

  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "targetUserId is required.");
  }

  // Employees can only fetch their own
  if (callerRole === "employee" && callerUid !== targetUserId) {
    throw new HttpsError("permission-denied", "You can only view your own career map.");
  }

  try {
    const careerMapRef = firestore.collection("users").doc(targetUserId).collection("careerMap").doc("current");
    const careerMapDoc = await careerMapRef.get();

    if (!careerMapDoc.exists) {
      return { success: true, data: null };
    }

    const careerMap = careerMapDoc.data();

    // Verify company access for HR
    if (callerRole !== "employee" && careerMap.companyId !== callerCompanyId) {
      throw new HttpsError("permission-denied", "Employee not in your company.");
    }

    // Fetch full career path with levels
    const pathDoc = await firestore
      .collection("companies")
      .doc(careerMap.companyId)
      .collection("careerPaths")
      .doc(careerMap.careerPathId)
      .get();

    const careerPath = pathDoc.exists ? { id: pathDoc.id, ...pathDoc.data() } : null;

    return {
      success: true,
      data: {
        careerMap,
        careerPath,
      },
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in getCareerMapForEmployee:", error);
    throw new HttpsError("internal", error.message || "Failed to fetch career map.");
  }
});
