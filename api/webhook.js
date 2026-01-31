import axios from "axios";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Quick replies (same for both languages)
const quickReplies = [
  { content_type: "text", title: "Properties & Packages", payload: "house" },
  { content_type: "text", title: "Pricelist & Amortization", payload: "pricelist" },
  { content_type: "text", title: "Requirements", payload: "requirement" },
  { content_type: "text", title: "Location", payload: "location" },
  { content_type: "text", title: "Contact Info", payload: "contact_info" },
  { content_type: "text", title: "Hours", payload: "open_hour" },
];

// --------------------
// SENDERS
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
  // Very simple: if text contains common Tagalog words, treat as Tagalog
  const tagalogKeywords = [
    "kumusta", "magandang", "ano", "saan", "paano", "salamat", "po", "kayo"
  ];

  const lower = text.toLowerCase();
  return tagalogKeywords.some((word) => lower.includes(word)) ? "tl" : "en";
}

// --------------------
// WEBHOOK
// --------------------
export default async (req, res) => {
  try {
    if (req.method === "GET") return res.status(200).send("Webhook alive");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const body = req.body;
    const intentName = body.queryResult?.intent?.displayName || "UnknownIntent";
    const psid = body.originalDetectIntentRequest?.payload?.data?.sender?.id;
    const userMessage = body.queryResult?.queryText || "";

    if (!psid) return res.status(200).json({ fulfillmentText: "" });

    // Fetch first name
    let firstName = "there";
    try {
      const fbRes = await axios.get(`https://graph.facebook.com/${psid}`, {
        params: { fields: "first_name", access_token: PAGE_ACCESS_TOKEN },
      });
      firstName = fbRes.data.first_name || "there";
    } catch {}

    // Detect language based on user message
    const lang = detectLanguage(userMessage);

    // Greeting texts
    const greetingText = lang === "tl"
      ? `Magandang araw, ${firstName}! 👋\n\nMaligayang pagdating sa Valeenvista Residences – kinilala ng Pag-IBIG Fund bilang isa sa mga top developers sa Mindanao! 🏡✨\n\nPaano namin kayo matutulungan sa paghahanap ng inyong dream home ngayon?`
      : `Good day, ${firstName}! 👋\n\nWelcome to Valeenvista Residences – proudly awarded by Pag-IBIG Fund as one of the top developers in Mindanao! 🏡✨\n\nHow can we assist you in finding your dream home today?`;

    // --------------------
    // GREETING INTENT
    // --------------------
    if (intentName === "Greeting") {
      await sendMessage(psid, greetingText, quickReplies);
      return res.status(200).json({ fulfillmentText: "" });
    }

    // --------------------
    // FALLBACK
    // --------------------
    const fallbackText = lang === "tl"
      ? "Kamusta! 👋 Pumili ng opsyon sa itaas o i-type ang inyong tanong."
      : "Hello! 👋 Please choose an option above or type your question.";

    await sendMessage(psid, fallbackText, quickReplies);
    return res.status(200).json({ fulfillmentText: "" });

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    return res.status(500).json({ fulfillmentText: "" });
  }
};

