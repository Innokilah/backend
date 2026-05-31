import {
  addMessageToThread,
  canUserAccessThread,
  createOrGetOwnerThread,
  createSupportThread,
  getThreadById,
  listMessages,
  listThreadsForUser,
} from "../models/messages.js";
import { findPaidConnectionFee } from "../models/payments.js";
import { sendPushToRole, sendPushToUsers } from "../services/expoPush.js";

async function notifyThreadParticipants(thread, sender, body) {
  if (!thread || !sender) return;

  const targetUserIds = [];
  let targetRole = "";
  if (thread.thread_type === "support") {
    if (sender.role === "admin") {
      if (thread.created_by_user_id) targetUserIds.push(thread.created_by_user_id);
    } else {
      targetRole = "admin";
    }
  } else if (sender.role === "owner") {
    if (thread.client_user_id) targetUserIds.push(thread.client_user_id);
  } else {
    if (thread.owner_user_id) targetUserIds.push(thread.owner_user_id);
  }

  if (!targetRole && targetUserIds.length === 0) return;

  const title =
    thread.thread_type === "support"
      ? "New support message"
      : sender.role === "client"
        ? "Message from property seeker"
        : "Owner replied to your message";

  const preview = String(body || "").trim();
  const payload = {
    title,
    body: preview || "Open eAgent to view the conversation.",
    data: {
      type: "thread_message",
      threadId: Number(thread.id),
      threadType: thread.thread_type,
    },
  };

  const senderPromise = targetRole
    ? sendPushToRole(targetRole, payload)
    : sendPushToUsers(targetUserIds, payload);

  await senderPromise.catch((error) => {
    console.warn("Failed to send thread push notification", error.message);
  });
}

export async function getMyThreads(req, res, next) {
  try {
    const items = await listThreadsForUser(req.user);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function startOwnerContactThread(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.role !== "client") {
      res.status(403).json({ error: "Only client accounts can contact owners" });
      return;
    }

    const { listingId } = req.body || {};
    if (!listingId) {
      res.status(400).json({ error: "Listing ID is required" });
      return;
    }

    const payment = await findPaidConnectionFee(user.id, listingId);
    if (!payment) {
      res.status(403).json({ error: "Pay the connection fee before messaging the owner" });
      return;
    }

    const thread = await createOrGetOwnerThread({
      listingId,
      clientUserId: user.id,
    });
    if (!thread) {
      res.status(409).json({
        error:
          "Owner chat is not available for this listing because it is not linked to an owner account yet.",
      });
      return;
    }
    res.status(201).json({ thread });
  } catch (error) {
    next(error);
  }
}

export async function startSupportThread(req, res, next) {
  try {
    const { subject, message } = req.body || {};
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const thread = await createSupportThread({
      createdByUserId: req.user.id,
      createdByRole: req.user.role,
      subject: subject || "Support request",
      body: String(message).trim(),
    });
    res.status(201).json({ thread });
  } catch (error) {
    next(error);
  }
}

export async function getThreadMessages(req, res, next) {
  try {
    const thread = await getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (!canUserAccessThread(req.user, thread)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const items = await listMessages(req.params.id);
    res.json({ thread, items });
  } catch (error) {
    next(error);
  }
}

export async function postThreadMessage(req, res, next) {
  try {
    const thread = await getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (!canUserAccessThread(req.user, thread)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const body = String(req.body?.message || "").trim();
    if (!body) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    await addMessageToThread({
      threadId: req.params.id,
      senderUserId: req.user.id,
      senderRole: req.user.role,
      body,
    });
    await notifyThreadParticipants(thread, req.user, body);

    const items = await listMessages(req.params.id);
    res.status(201).json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getAdminSupportThreads(req, res, next) {
  try {
    const adminUser = { id: 0, role: "admin" };
    const items = await listThreadsForUser(adminUser);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getAdminSupportMessages(req, res, next) {
  try {
    const thread = await getThreadById(req.params.id);
    if (!thread || thread.thread_type !== "support") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const items = await listMessages(req.params.id);
    res.json({ thread, items });
  } catch (error) {
    next(error);
  }
}

export async function postAdminSupportMessage(req, res, next) {
  try {
    const thread = await getThreadById(req.params.id);
    if (!thread || thread.thread_type !== "support") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const body = String(req.body?.message || "").trim();
    if (!body) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    await addMessageToThread({
      threadId: req.params.id,
      senderUserId: null,
      senderRole: "admin",
      body,
    });
    await notifyThreadParticipants(thread, { role: "admin" }, body);
    const items = await listMessages(req.params.id);
    res.status(201).json({ items });
  } catch (error) {
    next(error);
  }
}
