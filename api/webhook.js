import axios from "axios";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// --------------------
// MESSENGER SENDERS
// --------------------
async function sendMessage(psid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages`,
      {
        recipient: { id: psid },
        message: { text },
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
  } catch (err) {
    console.error("❌ Send message error:", err.response?.data || err.message);
  }
}

async function sendGreetingWithQuickReplies(psid, firstName) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages`,
      {
        recipient: { id: psid },
        message: {
          text: `Good day, ${firstName}! 👋

Welcome to Valeenvista Residences – proudly awarded by Pag-IBIG Fund as one of the top developers in Mindanao! 🏡✨

How can we assist you in finding your dream home today?`,
          quick_replies: [
            { content_type: "text", title: "Properties & Packages", payload: "house" },
            { content_type: "text", title: "Pricelist & Amortization", payload: "pricelist" },
            { content_type: "text", title: "Requirements", payload: "requirement" },
            { content_type: "text", title: "Location", payload: "location" },
            { content_type: "text", title: "Contact Info", payload: "contact_info" },
            { content_type: "text", title: "Hours", payload: "open_hour" },
          ],
        },
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
  } catch (err) {
    console.error("❌ Greeting quick reply error:", err.response?.data || err.message);
  }
}

// --------------------
// WEBHOOK HANDLER
// --------------------
export default async (req, res) => {
  try {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

    if (req.method === "GET") {
      return res.status(200).send("Webhook alive");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const body = req.body;
    const intentName = body.queryResult?.intent?.displayName || "UnknownIntent";
    const psid = body.originalDetectIntentRequest?.payload?.data?.sender?.id;

    if (!psid) {
      console.warn("⚠️ PSID missing");
      return res.status(200).json({ fulfillmentText: "" });
    }

    // --------------------
    // FETCH FIRST NAME
    // --------------------
    let firstName = "there";
    try {
      const fbRes = await axios.get(`https://graph.facebook.com/${psid}`, {
        params: {
          fields: "first_name",
          access_token: PAGE_ACCESS_TOKEN,
        },
      });
      firstName = fbRes.data.first_name || "there";
    } catch (err) {
      console.warn("⚠️ Failed to fetch first name");
    }

    // --------------------
    // GREETING INTENT
    // --------------------
    if (intentName === "Greeting") {
      await sendGreetingWithQuickReplies(psid, firstName);
      return res.status(200).json({ fulfillmentText: "" });
    }

    // --------------------
    // FALLBACK
    // --------------------
    await sendMessage(
      psid,
      "Hello! 👋 Please choose an option above or type your question."
    );
    return res.status(200).json({ fulfillmentText: "" });

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ fulfillmentText: "" });
  }
};
