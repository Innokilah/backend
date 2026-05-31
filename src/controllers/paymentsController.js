import { createOrGetOwnerThread } from "../models/messages.js";
import {
  CONNECTION_FEE_AMOUNT,
  CONNECTION_FEE_CURRENCY,
  createPendingConnectionFeePayment,
  createPendingListingSubmissionPayment,
  findConnectionFeePaymentForUser,
  findListingSubmissionPaymentForOwner,
  findPaidListingSubmissionPayment,
  findPaidConnectionFee,
  findPaymentByProviderRef,
  LISTING_SUBMISSION_FEE_AMOUNT,
  LISTING_SUBMISSION_FEE_CURRENCY,
  markPaymentFailed,
  markPaymentPaid,
} from "../models/payments.js";
import {
  getListingById,
  getOwnerListingById,
  updateListingStatus,
} from "../models/listings.js";
import { env } from "../config/env.js";
import {
  createHostedCheckout,
  isValidWebhookSignature,
  verifyPayChanguTransaction,
} from "../services/paychangu.js";
import { sendPushToUsers } from "../services/expoPush.js";

function buildTxRef(userId, listingId) {
  return `connection-${listingId}-${userId}-${Date.now()}`;
}

function buildOwnerSubmissionTxRef(userId, listingId) {
  return `listing-submission-${listingId}-${userId}-${Date.now()}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeVerificationResult(data) {
  const details = data?.data || {};
  return {
    providerStatus: String(details.status || "").toLowerCase(),
    amount: Number(details.amount) || 0,
    currency: String(details.currency || "").toUpperCase(),
    method:
      details?.authorization?.channel ||
      details?.authorization?.provider ||
      "paychangu",
    txRef: details.tx_ref || null,
  };
}

async function finalizeSuccessfulConnectionFee(payment) {
  if (!payment) return { payment: null, thread: null };
  const shouldNotifyClient = payment.status !== "Paid";

  const paidPayment =
    payment.status === "Paid"
      ? payment
      : await markPaymentPaid({
          paymentId: payment.id,
          providerRef: payment.provider_ref,
          method: payment.method,
        });

  const thread = await createOrGetOwnerThread({
    listingId: paidPayment.listing_id,
    clientUserId: paidPayment.user_id,
  });

  if (shouldNotifyClient) {
    await sendPushToUsers([paidPayment.user_id], {
      title: "Connection fee confirmed",
      body: "Your payment was confirmed. You can now message the property owner.",
      data: {
        type: "connection_fee_confirmed",
        listingId: Number(paidPayment.listing_id),
        threadId: Number(thread?.id || 0),
      },
    }).catch((error) => {
      console.warn("Failed to send connection fee push notification", error.message);
    });
  }

  return { payment: paidPayment, thread };
}

async function finalizeSuccessfulListingSubmission(payment) {
  if (!payment) return { payment: null, listing: null };

  const paidPayment =
    payment.status === "Paid"
      ? payment
      : await markPaymentPaid({
          paymentId: payment.id,
          providerRef: payment.provider_ref,
          method: payment.method,
        });

  if (paidPayment?.listing_id) {
    await updateListingStatus(paidPayment.listing_id, "Submitted");
  }

  const listing = paidPayment?.listing_id
    ? await getListingById(paidPayment.listing_id)
    : null;

  return { payment: paidPayment, listing };
}

function ensureClientUser(user, res) {
  if (!user || user.role !== "client") {
    res
      .status(403)
      .json({ error: "Only client accounts can pay connection fees" });
    return false;
  }
  return true;
}

function ensureOwnerUser(user, res) {
  if (!user || user.role !== "owner") {
    res
      .status(403)
      .json({ error: "Only owner accounts can pay listing submission fees" });
    return false;
  }
  return true;
}

function ensurePayChanguConfig() {
  if (!env.paychangu.secretKey) {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  }
  if (!env.paychangu.callbackUrl || !env.paychangu.returnUrl) {
    throw new Error(
      "PAYCHANGU_CALLBACK_URL and PAYCHANGU_RETURN_URL must be configured"
    );
  }
}

function isMockPaymentModeEnabled() {
  const secretKey = String(env.paychangu.secretKey || "").trim();
  const isPlaceholderKey =
    !secretKey ||
    secretKey.startsWith("replace_with_") ||
    secretKey.toLowerCase().includes("your_paychangu");

  return env.paychangu.mockMode || isPlaceholderKey;
}

export async function initializeConnectionFee(req, res, next) {
  try {
    const user = req.user;
    if (!ensureClientUser(user, res)) return;

    const { listingId } = req.body || {};
    if (!listingId) {
      res.status(400).json({ error: "Listing ID is required" });
      return;
    }

    const listing = await getListingById(listingId);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const existingPaid = await findPaidConnectionFee(user.id, listingId);
    if (existingPaid) {
      const { payment, thread } = await finalizeSuccessfulConnectionFee(
        existingPaid
      );
      res.json({
        alreadyPaid: true,
        payment,
        thread,
      });
      return;
    }

    if (isMockPaymentModeEnabled()) {
      const txRef = `mock-${buildTxRef(user.id, listingId)}`;
      const pendingPayment = await createPendingConnectionFeePayment({
        userId: user.id,
        listingId,
        method: "mock",
        providerRef: txRef,
      });
      const { payment, thread } = await finalizeSuccessfulConnectionFee({
        ...pendingPayment,
        method: "mock",
      });
      res.status(201).json({
        mockMode: true,
        alreadyPaid: true,
        payment,
        thread,
        txRef,
      });
      return;
    }

    ensurePayChanguConfig();

    const txRef = buildTxRef(user.id, listingId);
    const payChanguResponse = await createHostedCheckout({
      amount: String(CONNECTION_FEE_AMOUNT),
      currency: CONNECTION_FEE_CURRENCY,
      tx_ref: txRef,
      callback_url: env.paychangu.callbackUrl,
      return_url: env.paychangu.returnUrl,
      email: user.email || undefined,
      first_name: String(user.email || "client").split("@")[0] || "Client",
      meta: {
        user_id: user.id,
        listing_id: Number(listingId),
        payment_type: "connection_fee",
      },
      customization: {
        title: "Property Owner Connection Fee",
        description: `Connection fee for ${listing.title}`,
      },
    });

    const checkoutUrl = payChanguResponse?.data?.checkout_url;
    if (!checkoutUrl) {
      throw new Error("PayChangu did not return a checkout URL");
    }

    const pendingPayment = await createPendingConnectionFeePayment({
      userId: user.id,
      listingId,
      method: "paychangu",
      providerRef: txRef,
    });

    res.status(201).json({
      payment: pendingPayment,
      checkoutUrl,
      txRef,
      callbackUrl: env.paychangu.callbackUrl,
      returnUrl: env.paychangu.returnUrl,
      provider: "paychangu",
    });
  } catch (error) {
    next(error);
  }
}

export async function initializeListingSubmissionFee(req, res, next) {
  try {
    const user = req.user;
    if (!ensureOwnerUser(user, res)) return;

    const { listingId } = req.body || {};
    if (!listingId) {
      res.status(400).json({ error: "Listing ID is required" });
      return;
    }

    const listing = await getOwnerListingById(listingId, user.id);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const existingPaid = await findPaidListingSubmissionPayment(
      user.id,
      listingId
    );
    if (existingPaid) {
      const finalized = await finalizeSuccessfulListingSubmission(existingPaid);
      res.json({
        alreadyPaid: true,
        payment: finalized.payment,
        listing: finalized.listing,
      });
      return;
    }

    if (isMockPaymentModeEnabled()) {
      const txRef = `mock-${buildOwnerSubmissionTxRef(user.id, listingId)}`;
      const pendingPayment = await createPendingListingSubmissionPayment({
        userId: user.id,
        listingId,
        method: "mock",
        providerRef: txRef,
      });
      const finalized = await finalizeSuccessfulListingSubmission({
        ...pendingPayment,
        method: "mock",
      });
      res.status(201).json({
        mockMode: true,
        alreadyPaid: true,
        payment: finalized.payment,
        listing: finalized.listing,
        txRef,
      });
      return;
    }

    ensurePayChanguConfig();

    const txRef = buildOwnerSubmissionTxRef(user.id, listingId);
    const payChanguResponse = await createHostedCheckout({
      amount: String(LISTING_SUBMISSION_FEE_AMOUNT),
      currency: LISTING_SUBMISSION_FEE_CURRENCY,
      tx_ref: txRef,
      callback_url: env.paychangu.callbackUrl,
      return_url: env.paychangu.returnUrl,
      email: user.email || undefined,
      first_name: user.name || String(user.email || "owner").split("@")[0] || "Owner",
      meta: {
        user_id: user.id,
        listing_id: Number(listingId),
        payment_type: "listing_submission",
      },
      customization: {
        title: "Property Listing Submission Fee",
        description: `Submission fee for ${listing.title}`,
      },
    });

    const checkoutUrl = payChanguResponse?.data?.checkout_url;
    if (!checkoutUrl) {
      throw new Error("PayChangu did not return a checkout URL");
    }

    const pendingPayment = await createPendingListingSubmissionPayment({
      userId: user.id,
      listingId,
      method: "paychangu",
      providerRef: txRef,
    });

    res.status(201).json({
      payment: pendingPayment,
      checkoutUrl,
      txRef,
      callbackUrl: env.paychangu.callbackUrl,
      returnUrl: env.paychangu.returnUrl,
      provider: "paychangu",
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyConnectionFee(req, res, next) {
  try {
    const user = req.user;
    if (!ensureClientUser(user, res)) return;

    const { txRef, listingId } = req.body || {};
    if (!txRef) {
      res.status(400).json({ error: "Transaction reference is required" });
      return;
    }

    const payment = await findConnectionFeePaymentForUser({
      userId: user.id,
      listingId,
      providerRef: txRef,
    });

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (payment.status === "Paid") {
      const finalized = await finalizeSuccessfulConnectionFee(payment);
      res.json({
        verified: true,
        payment: finalized.payment,
        thread: finalized.thread,
      });
      return;
    }

    ensurePayChanguConfig();

    const verification = await verifyPayChanguTransaction(txRef);
    const normalized = normalizeVerificationResult(verification);

    const expectedAmount = Number(payment.amount) || CONNECTION_FEE_AMOUNT;
    const expectedCurrency = String(payment.currency || CONNECTION_FEE_CURRENCY).toUpperCase();
    const isProviderFailed =
      normalized.providerStatus === "failed" ||
      normalized.providerStatus === "cancelled";

    const isSuccessful =
      normalized.providerStatus === "success" &&
      normalized.txRef === payment.provider_ref &&
      normalized.currency === expectedCurrency &&
      normalized.amount >= expectedAmount;

    if (!isSuccessful) {
      if (isProviderFailed) {
        await markPaymentFailed({
          paymentId: payment.id,
          method: normalized.method,
        });
      }
      res.status(409).json({
        error: "Payment is not yet confirmed",
        verification,
      });
      return;
    }

    const finalized = await finalizeSuccessfulConnectionFee({
      ...payment,
      method: normalized.method || payment.method,
    });

    res.json({
      verified: true,
      payment: finalized.payment,
      thread: finalized.thread,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyListingSubmissionFee(req, res, next) {
  try {
    const user = req.user;
    if (!ensureOwnerUser(user, res)) return;

    const { txRef, listingId } = req.body || {};
    if (!txRef) {
      res.status(400).json({ error: "Transaction reference is required" });
      return;
    }

    const payment = await findListingSubmissionPaymentForOwner({
      userId: user.id,
      listingId,
      providerRef: txRef,
    });

    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (payment.status === "Paid") {
      const finalized = await finalizeSuccessfulListingSubmission(payment);
      res.json({
        verified: true,
        payment: finalized.payment,
        listing: finalized.listing,
      });
      return;
    }

    ensurePayChanguConfig();

    const verification = await verifyPayChanguTransaction(txRef);
    const normalized = normalizeVerificationResult(verification);

    const expectedAmount =
      Number(payment.amount) || LISTING_SUBMISSION_FEE_AMOUNT;
    const expectedCurrency = String(
      payment.currency || LISTING_SUBMISSION_FEE_CURRENCY
    ).toUpperCase();
    const isProviderFailed =
      normalized.providerStatus === "failed" ||
      normalized.providerStatus === "cancelled";

    const isSuccessful =
      normalized.providerStatus === "success" &&
      normalized.txRef === payment.provider_ref &&
      normalized.currency === expectedCurrency &&
      normalized.amount >= expectedAmount;

    if (!isSuccessful) {
      if (isProviderFailed) {
        await markPaymentFailed({
          paymentId: payment.id,
          method: normalized.method,
        });
      }
      res.status(409).json({
        error: "Payment is not yet confirmed",
        verification,
      });
      return;
    }

    const finalized = await finalizeSuccessfulListingSubmission({
      ...payment,
      method: normalized.method || payment.method,
    });

    res.json({
      verified: true,
      payment: finalized.payment,
      listing: finalized.listing,
    });
  } catch (error) {
    next(error);
  }
}

export async function handlePayChanguWebhook(req, res, next) {
  try {
    const signature =
      req.headers.signature ||
      req.headers.Signature ||
      req.headers["x-paychangu-signature"];

    if (!isValidWebhookSignature(req.rawBody, signature)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    const txRef = req.body?.data?.tx_ref || req.body?.tx_ref;
    if (!txRef) {
      res.status(400).json({ error: "Transaction reference is required" });
      return;
    }

    const payment = await findPaymentByProviderRef(txRef);
    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (payment.status === "Paid") {
      res.json({ received: true, status: "already_paid" });
      return;
    }

    const verification = await verifyPayChanguTransaction(txRef);
    const normalized = normalizeVerificationResult(verification);

    const expectedAmount = Number(payment.amount) || CONNECTION_FEE_AMOUNT;
    const expectedCurrency = String(payment.currency || CONNECTION_FEE_CURRENCY).toUpperCase();
    const isProviderFailed =
      normalized.providerStatus === "failed" ||
      normalized.providerStatus === "cancelled";

    const isSuccessful =
      normalized.providerStatus === "success" &&
      normalized.txRef === payment.provider_ref &&
      normalized.currency === expectedCurrency &&
      normalized.amount >= expectedAmount;

    if (!isSuccessful) {
      if (isProviderFailed) {
        await markPaymentFailed({
          paymentId: payment.id,
          method: normalized.method,
        });
      }
      res.json({ received: true, status: "ignored" });
      return;
    }

    if (payment.payment_type === "listing_submission") {
      await finalizeSuccessfulListingSubmission({
        ...payment,
        method: normalized.method || payment.method,
      });
    } else {
      await finalizeSuccessfulConnectionFee({
        ...payment,
        method: normalized.method || payment.method,
      });
    }

    res.json({ received: true, status: "paid" });
  } catch (error) {
    next(error);
  }
}

export function payChanguCallback(req, res) {
  const txRef = req.query.tx_ref || "";
  const status = req.query.status || "success";
  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Complete</title>
  </head>
  <body>
    <p>Payment callback received.</p>
    <p>tx_ref: ${escapeHtml(txRef)}</p>
    <p>status: ${escapeHtml(status)}</p>
  </body>
</html>`);
}

export function payChanguReturn(req, res) {
  const txRef = req.query.tx_ref || "";
  const status = req.query.status || "failed";
  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Cancelled</title>
  </head>
  <body>
    <p>Payment was not completed.</p>
    <p>tx_ref: ${escapeHtml(txRef)}</p>
    <p>status: ${escapeHtml(status)}</p>
  </body>
</html>`);
}
