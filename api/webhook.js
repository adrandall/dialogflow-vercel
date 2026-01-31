import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// --------------------
// SUPABASE INIT
// --------------------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --------------------
// QUICK REPLIES TRANSLATIONS
// --------------------
const quickRepliesMap = {
  en: [
    { content_type: "text", title: "Properties & Packages", payload: "house" },
    { content_type: "text", title: "Pricelist & Amortization", payload: "pricelist" },
    { content_type: "text", title: "Requirements", payload: "requirement" },
    { content_type: "text", title: "Location", payload: "location" },
    { content_type: "text", title: "Contact Info", payload: "contact_info" },
    { content_type: "text", title: "Hours", payload: "open_hour" },
  ],
  tl: [
    { content_type: "text", title: "Ari-arian & Packages", payload: "house" },
    { content_type: "text", title: "Presyo & Amortization", payload: "pricelist" },
    { content_type: "text", title: "Mga Kailangan", payload: "requirement" },
    { content_type: "text", title: "Lokasyon", payload: "location" },
    { content_type: "text", title: "Kontak", payload: "contact_info" },
    { content_type: "text", title: "Oras", payload: "open_hour" },
  ],
};

// --------------------
// SEND IDLE AUTORESPONSE
// --------------------
async function sendIdleMessages() {
  try {
    // Set inactivity threshold (e.g., 15 minutes)
    const now = new Date();
    const threshold = new Date(now.getTime() - 30 * 1000).toISOString();

    // Fetch users inactive since threshold
    const { data: inactiveUsers, error } = await supabase
      .from("user_activity")
      .select("psid, last_active")
      .lt("last_active", threshold);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return;
    }

    for (const user of inactiveUsers) {
      // Send idle message
      const idleText = "Thank you for your time! 👋 Please come back again.";
      await sendMessage(user.psid, idleText);

      // Optionally update last_active to now so we don't spam
      await supabase
        .from("user_activity")
        .update({ last_active: now.toISOString() })
        .eq("psid", user.psid);
    }
  } catch (err) {
    console.error("🔥 Idle message error:", err);
  }
}
// Export for cron use
export { sendIdleMessages }

// --------------------
// SEND MESSAGE
// --------------------
async function sendMessage(psid, text, quickReplies = null) {
  try {
    const messagePayload = { recipient: { id: psid }, message: { text } };
    if (quickReplies) messagePayload.message.quick_replies = quickReplies;

    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages`,
      messagePayload,
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
  } catch (err) {
    console.error("❌ Send message error:", err.response?.data || err.message);
  }
}

// --------------------
// LANGUAGE DETECTION
// --------------------
function detectLanguage(text) {
  const tagalogKeywords = ["kumusta","magandang","ano","saan","paano","salamat","po","kayo"];
  const lower = text.toLowerCase();
  return tagalogKeywords.some(word => lower.includes(word)) ? "tl" : "en";
}

// --------------------
// UPDATE LAST ACTIVITY
// --------------------
async function updateLastActivity(psid) {
  try {
    await supabase
      .from("user_activity")
      .upsert({ psid, last_active: new Date().toISOString() });
  } catch (err) {
    console.error("❌ Supabase upsert error:", err);
  }
}

// --------------------
// WEBHOOK
// --------------------
export default async (req, res) => {
  try {
    if (req.method === "GET") return res.status(200).send("Webhook alive");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const body = req.body;

    // Dialogflow intent
    const intentName = body.queryResult?.intent?.displayName || "UnknownIntent";

    // PSID extraction
    let psid = body.originalDetectIntentRequest?.payload?.data?.sender?.id;
    if (!psid && body.originalDetectIntentRequest?.payload?.sender?.id) {
      psid = body.originalDetectIntentRequest.payload.sender.id;
    }

    const userMessage = body.queryResult?.queryText || "";

    if (!psid) return res.status(200).json({ fulfillmentText: "" });

    // Update user last activity in Supabase
    await updateLastActivity(psid);

    // Fetch first name
    let firstName = "there";
    try {
      const fbRes = await axios.get(`https://graph.facebook.com/${psid}`, {
        params: { fields: "first_name", access_token: PAGE_ACCESS_TOKEN },
      });
      firstName = fbRes.data.first_name || "there";
    } catch (err) {
      console.warn("⚠️ Failed to fetch first name");
    }

    // Detect language
    const lang = detectLanguage(userMessage);

    // Greeting text
    const greetingText = lang === "tl"
      ? `Magandang araw, ${firstName}! 👋\n\nMaligayang pagdating sa Valeenvista Residences – kinilala ng Pag-IBIG Fund bilang isa sa mga top developers sa Mindanao! 🏡✨\n\nPaano namin kayo matutulungan sa paghahanap ng inyong dream home ngayon?`
      : `Good day, ${firstName}! 👋\n\nWelcome to Valeenvista Residences – proudly awarded by Pag-IBIG Fund as one of the top developers in Mindanao! 🏡✨\n\nHow can we assist you in finding your dream home today?`;

    // --------------------
    // GREETING INTENT
    // --------------------
    if (intentName === "Greeting" || intentName === "Default Welcome Intent") {
      await sendMessage(psid, greetingText, quickRepliesMap[lang]);
      return res.status(200).json({ fulfillmentText: "" });
    }

    // --------------------
    // FALLBACK
    // --------------------
    const fallbackText = lang === "tl"
      ? "Kamusta! 👋 Pumili ng opsyon sa itaas o i-type ang inyong tanong."
      : "Hello! 👋 Please choose an option above or type your question.";

    await sendMessage(psid, fallbackText, quickRepliesMap[lang]);
    return res.status(200).json({ fulfillmentText: "" });

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ fulfillmentText: "" });
  }
};



